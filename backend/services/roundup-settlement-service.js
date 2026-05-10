const crypto = require('crypto');
const Stripe = require('stripe');

const RoundUp = require('../models/RoundUp');
const User = require('../models/User');
const Charity = require('../models/Charity');
const Transaction = require('../models/Transaction');
const resilientDB = require('./resilientdb-client');
const donationValidator = require('./donation-validator');
const solanaLedger = require('./solana-ledger-client');
const usdcConversion = require('./usdc-conversion-service');


const stripe = Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_missing');

class RoundupSettlementService {
  buildMockSolanaSignature(batchId, userEmail) {
    return `mock_usdc_${crypto
      .createHash('sha256')
      .update(`${batchId}:${userEmail}:${Date.now()}`)
      .digest('hex')
      .slice(0, 48)}`;
  }

  async recordTransactionLedgers({ transaction, userEmail, charity, stripeTransferId, stripePaymentIntentId, usdcSignature }) {
    try {
      const donationData = {
        amount: transaction.amount,
        charities: [charity._id.toString()]
      };
      const validationResult = donationValidator.validateDonation(donationData);

      const ledgerKey = resilientDB.generateKey('transaction', transaction._id.toString());
      const ledgerData = {
        transactionId: transaction._id.toString(),
        stripeTransferId: stripeTransferId || transaction.stripeTransactionId || '',
        stripePaymentIntentId: stripePaymentIntentId || transaction.stripePaymentIntentId || '',
        usdcSignature: usdcSignature || transaction.solana?.signature || '',
        userId: resilientDB.hashSensitiveData(userEmail),
        amount: transaction.amount.toFixed(2),
        amountCents: transaction.amountCents || Math.round(transaction.amount * 100),
        charityId: charity._id.toString(),
        charityName: charity.name,
        paymentRail: transaction.paymentRail,
        currency: transaction.currency,
        timestamp: new Date().toISOString(),
        status: transaction.settlementStatus,
        validated: validationResult.valid,
        validationRules: validationResult.appliedRules,
        blockchainVersion: '3.0-solana-parallel'
      };

      const txId = await resilientDB.set(ledgerKey, ledgerData);
      if (txId) {
        transaction.blockchainTxKey = ledgerKey;
        transaction.blockchainTxId = txId;
        transaction.blockchainVerified = true;
        transaction.blockchainTimestamp = new Date();
      }
    } catch (blockchainError) {
      console.error('[Charitap] WARNING ResilientDB transaction write failed:', blockchainError.message);
      transaction.blockchainError = blockchainError.message;
    }

    try {
      const solanaResult = await solanaLedger.recordReceipt({
        transactionId: transaction._id.toString(),
        userEmail,
        amount: transaction.amount,
        amountCents: transaction.amountCents,
        charityId: charity._id.toString(),
        charityName: charity.name,
        paymentRail: transaction.paymentRail,
        currency: transaction.currency,
        stripeTransferId: stripeTransferId || transaction.stripeTransactionId,
        stripePaymentIntentId: stripePaymentIntentId || transaction.stripePaymentIntentId,
        usdcSignature,
        timestamp: transaction.timestamp,
        status: transaction.settlementStatus
      });

      transaction.solana = {
        enabled: solanaResult.enabled,
        signature: solanaResult.signature || transaction.solana?.signature,
        paymentSignature: transaction.solana?.paymentSignature,
        receiptSignature: solanaResult.signature,
        memo: solanaResult.memo,
        memoHash: solanaResult.memoHash,
        receiptId: solanaResult.receiptId,
        receiptPda: solanaResult.receiptPda,
        charityTotalPda: solanaResult.charityTotalPda,
        programId: solanaResult.programId,
        usdcMint: solanaResult.usdcMint,
        verified: Boolean(solanaResult.verified),
        recordedAt: solanaResult.recordedAt || (solanaResult.signature ? new Date() : undefined),
        error: solanaResult.error
      };
    } catch (solanaError) {
      console.error('[Charitap] WARNING Solana transaction write failed:', solanaError.message);
      transaction.solana = {
        ...(transaction.solana || {}),
        enabled: solanaLedger.enabled,
        verified: false,
        error: solanaError.message
      };
    }

    await transaction.save();
    return transaction;
  }

  async processMockSolanaRoundups({ user, charities, unpaidRoundUps, totalAmount, batchId, roundupIds }) {
    const perCharityAmount = totalAmount / charities.length;
    const perCharityCents = Math.round((totalAmount * 100) / charities.length);
    const mockSignature = this.buildMockSolanaSignature(batchId, user.email);
    const transactions = [];

    for (const charity of charities) {
      const transaction = await Transaction.create({
        userEmail: user.email,
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
          signature: mockSignature,
          paymentSignature: mockSignature,
          usdcMint: solanaLedger.usdcMint,
          verified: true,
          recordedAt: new Date(),
          memo: `charitap:mock-usdc:${batchId}`,
          memoHash: crypto.createHash('sha256').update(`charitap:mock-usdc:${batchId}`).digest('hex')
        }
      });

      await this.recordTransactionLedgers({
        transaction,
        userEmail: user.email,
        charity,
        usdcSignature: mockSignature
      });

      try {
        await usdcConversion.handleConversionIfNeeded(transaction, charity);
      } catch (convErr) {
        console.warn('[Settlement] USDC conversion step failed (non-fatal):', convErr.message);
      }

      transactions.push(transaction);
    }

    const now = new Date();
    await RoundUp.updateMany(
      { _id: { $in: roundupIds }, processingBatchId: batchId },
      {
        $set: {
          isPaid: true,
          paymentRail: 'solana',
          currency: 'usdc',
          chargedAt: now,
          processedAt: now,
          settlementStatus: 'settled',
          'solana.enabled': solanaLedger.enabled,
          'solana.signature': mockSignature,
          'solana.paymentSignature': mockSignature,
          'solana.usdcMint': solanaLedger.usdcMint,
          'solana.verified': true,
          'solana.recordedAt': now
        }
      }
    );

    return {
      processed: true,
      batchId,
      paymentRail: 'solana',
      mockSignature,
      totalAmount,
      transactionCount: transactions.length,
      roundupCount: unpaidRoundUps.length
    };
  }

  async processUserRoundups(userOrEmail, options = {}) {
    const user = typeof userOrEmail === 'string'
      ? await User.findOne({ email: userOrEmail })
      : userOrEmail;

    if (!user) {
      return { processed: false, reason: 'user_not_found' };
    }

    const unpaidRoundUps = await RoundUp.find({
      user: user.email,
      isPaid: false,
      $or: [
        { settlementStatus: 'pending' },
        { settlementStatus: { $exists: false } }
      ]
    });

    if (!unpaidRoundUps.length) {
      return { processed: false, reason: 'no_pending_roundups' };
    }

    const totalAmount = unpaidRoundUps.reduce((sum, ru) => sum + ru.roundUpAmount, 0);

    if (!options.force) {
      if (user.paymentPreference === 'threshold' && totalAmount < 5) {
        return { processed: false, reason: 'below_threshold', totalAmount };
      }
      // Stripe has a minimum amount (usually $0.50), skip if too low
      if (totalAmount < 0.50) {
        return { processed: false, reason: 'amount_too_low', totalAmount };
      }
    }

    const charities = await Charity.find({ _id: { $in: user.selectedCharities } });
    if (!charities.length) {
      return { processed: false, reason: 'no_charities_selected' };
    }

    const wantsSolana = user.paymentRailPreference === 'solana';
    const paymentRail = wantsSolana ? 'solana' : 'stripe';

    if (wantsSolana && !user.solanaWalletAddress) {
      return { processed: false, reason: 'missing_solana_wallet', totalAmount };
    }

    if (paymentRail === 'stripe' && (!user.defaultPaymentMethod || !user.stripeCustomerId)) {
      return { processed: false, reason: 'missing_stripe_payment_method' };
    }

    const batchId = options.batchId || `settlement_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const roundupIds = unpaidRoundUps.map(ru => ru._id);
    const lockResult = await RoundUp.updateMany(
      {
        _id: { $in: roundupIds },
        isPaid: false,
        $or: [
          { processingBatchId: { $exists: false } },
          { processingBatchId: null }
        ]
      },
      {
        $set: {
          processingBatchId: batchId,
          settlementStatus: 'processing'
        }
      }
    );

    if (lockResult.modifiedCount === 0) {
      return { processed: false, reason: 'already_processing' };
    }

    if (paymentRail === 'solana') {
      try {
        return await this.processMockSolanaRoundups({
          user,
          charities,
          unpaidRoundUps,
          totalAmount,
          batchId,
          roundupIds
        });
      } catch (error) {
        console.error(`[Settlement] Mock Solana processing error for ${user.email}:`, error.message);
        await RoundUp.updateMany(
          { _id: { $in: roundupIds }, processingBatchId: batchId },
          {
            $set: { settlementStatus: 'failed' },
            $unset: { processingBatchId: '' }
          }
        );
        return { processed: false, reason: 'solana_mock_settlement_failed', error: error.message, batchId };
      }
    }

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalAmount * 100),
        currency: 'usd',
        customer: user.stripeCustomerId,
        payment_method: user.defaultPaymentMethod,
        off_session: true,
        confirm: true,
        description: `Charitap donation - ${unpaidRoundUps.length} roundups`,
        metadata: {
          userEmail: user.email,
          roundupCount: unpaidRoundUps.length.toString(),
          totalAmount: totalAmount.toString(),
          batchId
        }
      });

      const perCharityAmount = totalAmount / charities.length;
      const transactions = [];

      for (const charity of charities) {
        let transfer = null;
        if (charity.stripeAccountId) {
          transfer = await stripe.transfers.create({
            amount: Math.round(perCharityAmount * 100),
            currency: 'usd',
            destination: charity.stripeAccountId,
            transfer_group: `payment_${paymentIntent.id}`,
            description: `Donation from ${user.email}`,
            metadata: {
              userEmail: user.email,
              charityId: charity._id.toString(),
              batchId
            }
          });
        }

        const transaction = await Transaction.create({
          stripeTransactionId: transfer?.id || `pending_transfer_${batchId}_${charity._id}`,
          stripePaymentIntentId: paymentIntent.id,
          userEmail: user.email,
          amount: perCharityAmount,
          amountCents: Math.round(perCharityAmount * 100),
          paymentRail: 'stripe',
          currency: 'usd',
          settlementStatus: 'settled',
          conversionStatus: charity.payoutPreference === 'usdc' ? 'pending_provider' : 'not_required',
          charity: charity._id
        });

        await this.recordTransactionLedgers({
          transaction,
          userEmail: user.email,
          charity,
          stripeTransferId: transfer?.id,
          stripePaymentIntentId: paymentIntent.id
        });

        // Trigger USD->USDC conversion if charity prefers USDC
        try {
          await usdcConversion.handleConversionIfNeeded(transaction, charity);
        } catch (convErr) {
          console.warn('[Settlement] Conversion step failed (non-fatal):', convErr.message);
        }

        transactions.push(transaction);
      }

      const now = new Date();
      await RoundUp.updateMany(
        { _id: { $in: roundupIds }, processingBatchId: batchId },
        {
          $set: {
            isPaid: true,
            stripePaymentIntentId: paymentIntent.id,
            chargedAt: now,
            processedAt: now,
            settlementStatus: 'settled'
          }
        }
      );

      return {
        processed: true,
        batchId,
        paymentIntentId: paymentIntent.id,
        paymentRail: 'stripe',
        totalAmount,
        transactionCount: transactions.length,
        roundupCount: unpaidRoundUps.length
      };
    } catch (error) {
      console.error(`[Settlement] Error processing ${user.email}:`, error.message);
      await RoundUp.updateMany(
        { _id: { $in: roundupIds }, processingBatchId: batchId },
        {
          $set: {
            settlementStatus: 'failed'
          },
          $unset: {
            processingBatchId: ''
          }
        }
      );
      return { processed: false, reason: 'settlement_failed', error: error.message, batchId };
    }
  }
}

module.exports = new RoundupSettlementService();
