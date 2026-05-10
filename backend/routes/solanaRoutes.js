const crypto = require('crypto');
const express = require('express');

const router = express.Router();

const Charity = require('../models/Charity');
const SolanaPaymentIntent = require('../models/SolanaPaymentIntent');
const Transaction = require('../models/Transaction');
const { authenticateToken } = require('../middleware/auth');
const solanaLedger = require('../services/solana-ledger-client');
const settlementService = require('../services/roundup-settlement-service');
const usdcConversion = require('../services/usdc-conversion-service');


function requireConnectedGoogleWallet(req, res, next) {
  if (req.user.authProvider !== 'google') {
    return res.status(403).json({ error: 'USDC donations require Google OAuth sign-in.' });
  }
  if (!req.user.solanaWalletAddress) {
    return res.status(400).json({ error: 'Connect a Solana wallet before making USDC donations.' });
  }
  next();
}

function hashMemo(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

router.post('/payments/create-intent', authenticateToken, requireConnectedGoogleWallet, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const charityIds = Array.isArray(req.body.charityIds) && req.body.charityIds.length
      ? req.body.charityIds
      : (req.user.selectedCharities || []);

    if (!Number.isFinite(amount) || amount < 0.01 || amount > 10000) {
      return res.status(400).json({ error: 'Amount must be between $0.01 and $10,000' });
    }
    if (!charityIds.length) {
      return res.status(400).json({ error: 'Select at least one charity before donating USDC' });
    }

    const charities = await Charity.find({ _id: { $in: charityIds } }).select('_id name');
    if (!charities.length) {
      return res.status(400).json({ error: 'No valid charities selected' });
    }

    const recipientWallet = solanaLedger.treasuryWallet;
    if (!recipientWallet) {
      return res.status(400).json({
        error: 'SOLANA_TREASURY_WALLET is not configured for local USDC payment testing'
      });
    }

    const amountCents = Math.round(amount * 100);
    const usdcBaseUnits = solanaLedger.centsToUsdcBaseUnits(amountCents);
    const intent = new SolanaPaymentIntent({
      userEmail: req.user.email,
      walletAddress: req.user.solanaWalletAddress,
      amount,
      amountCents,
      usdcBaseUnits,
      charityIds: charities.map(charity => charity._id),
      recipientWallet,
      usdcMint: solanaLedger.usdcMint,
      memo: 'pending',
      memoHash: 'pending',
      expiresAt: new Date(Date.now() + 20 * 60 * 1000)
    });

    const memo = [
      'charitap',
      'usdc-intent',
      intent._id.toString(),
      amountCents,
      charities.map(charity => charity._id.toString()).join(',')
    ].join(':');
    intent.memo = memo;
    intent.memoHash = hashMemo(memo);
    await intent.save();

    res.status(201).json({
      intentId: intent._id,
      walletAddress: req.user.solanaWalletAddress,
      recipientWallet,
      usdcMint: intent.usdcMint,
      amount,
      amountCents,
      usdcBaseUnits,
      memo,
      memoHash: intent.memoHash,
      expiresAt: intent.expiresAt,
      charities
    });
  } catch (error) {
    console.error('[Solana] Create intent error:', error);
    res.status(500).json({ error: 'Failed to create Solana payment intent' });
  }
});

router.post('/payments/confirm', authenticateToken, requireConnectedGoogleWallet, async (req, res) => {
  try {
    const { intentId, signature } = req.body;
    if (!intentId || !signature) {
      return res.status(400).json({ error: 'intentId and signature are required' });
    }

    const intent = await SolanaPaymentIntent.findOne({
      _id: intentId,
      userEmail: req.user.email
    });
    if (!intent) return res.status(404).json({ error: 'Payment intent not found' });
    if (intent.status === 'confirmed') {
      return res.json({ message: 'Payment already confirmed', intent });
    }
    if (intent.expiresAt < new Date()) {
      intent.status = 'expired';
      await intent.save();
      return res.status(400).json({ error: 'Payment intent expired' });
    }

    const verification = await solanaLedger.verifyUsdcPayment({
      signature,
      expectedRecipient: intent.recipientWallet,
      expectedAmountBaseUnits: intent.usdcBaseUnits,
      expectedMemoHash: intent.memoHash
    });

    intent.verification = {
      checkedAt: new Date(),
      valid: verification.valid,
      error: verification.error
    };

    if (!verification.valid) {
      intent.status = 'failed';
      await intent.save();
      return res.status(400).json({ error: verification.error || 'Solana payment verification failed' });
    }

    const charities = await Charity.find({ _id: { $in: intent.charityIds } });
    const perCharityAmount = intent.amount / charities.length;
    const perCharityCents = Math.round(intent.amountCents / charities.length);
    const transactions = [];

    for (const charity of charities) {
      const transaction = await Transaction.create({
        userEmail: req.user.email,
        amount: perCharityAmount,
        amountCents: perCharityCents,
        paymentRail: 'solana',
        currency: 'usdc',
        usdcBaseUnits: solanaLedger.centsToUsdcBaseUnits(perCharityCents),
        settlementStatus: 'settled',
        conversionStatus: charity.payoutPreference === 'usd' ? 'pending_provider' : 'not_required',
        charity: charity._id,
        solana: {
          enabled: solanaLedger.enabled,
          signature,
          paymentSignature: signature,
          memo: intent.memo,
          memoHash: intent.memoHash,
          usdcMint: intent.usdcMint,
          verified: true,
          recordedAt: new Date()
        }
      });

      await settlementService.recordTransactionLedgers({
        transaction,
        userEmail: req.user.email,
        charity,
        usdcSignature: signature
      });

      // Trigger USDC->USD conversion if charity prefers USD
      try {
        await usdcConversion.handleConversionIfNeeded(transaction, charity);
      } catch (convErr) {
        console.warn('[Solana] Conversion step failed (non-fatal):', convErr.message);
      }

      transactions.push(transaction);

    }

    intent.status = 'confirmed';
    intent.signature = signature;
    intent.confirmedAt = new Date();
    await intent.save();

    res.json({
      message: 'USDC donation confirmed',
      intent,
      transactions
    });
  } catch (error) {
    console.error('[Solana] Confirm payment error:', error);
    res.status(500).json({ error: 'Failed to confirm Solana payment' });
  }
});

router.get('/receipts/:transactionId', authenticateToken, async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.transactionId,
      userEmail: req.user.email
    }).populate('charity', 'name type');

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({
      transactionId: transaction._id,
      amount: transaction.amount,
      amountCents: transaction.amountCents,
      paymentRail: transaction.paymentRail,
      currency: transaction.currency,
      charity: transaction.charity,
      solana: transaction.solana || {}
    });
  } catch (error) {
    console.error('[Solana] Receipt fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch Solana receipt' });
  }
});

// Describe what conversion will happen for a given payment rail + charity preference
// GET /api/solana/conversion-info?rail=stripe&charityId=...
router.get('/conversion-info', async (req, res) => {
  try {
    const { rail, charityId } = req.query;
    if (!rail || !charityId) {
      return res.status(400).json({ error: 'rail and charityId are required' });
    }
    const charity = await require('../models/Charity').findById(charityId).select('name payoutPreference');
    if (!charity) return res.status(404).json({ error: 'Charity not found' });

    const info = usdcConversion.describeConversion(rail, charity.payoutPreference);
    res.json({
      ...info,
      charityName: charity.name,
      charityPayoutPreference: charity.payoutPreference,
      paymentRail: rail,
      usdcMint: process.env.SOLANA_USDC_MINT,
      note: '1 USDC = 1 USD — stablecoin peg, no exchange rate calculation needed'
    });
  } catch (error) {
    console.error('[Solana] Conversion-info error:', error);
    res.status(500).json({ error: 'Failed to get conversion info' });
  }
});

module.exports = router;

