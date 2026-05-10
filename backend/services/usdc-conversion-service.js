/**
 * USDC <-> USD Conversion Service
 *
 * Since USDC is a stablecoin permanently pegged 1:1 to USD, there is NO
 * exchange-rate calculation needed. The "conversion" is purely a settlement-rail
 * switch: funds move from one rail (Stripe USD or Solana USDC) to the other at
 * exactly the same dollar value.
 *
 * Architecture:
 *  - USD  -> USDC: user paid via Stripe; charity wants USDC.
 *    Backend records conversion in MongoDB and marks it settled.
 *    In production: treasury holds USDC and pays charity wallet.
 *    On devnet/test: simulated (SOLANA_ALLOW_UNVERIFIED_LOCAL_PAYMENTS=true).
 *
 *  - USDC -> USD:  user paid via Solana USDC; charity wants USD.
 *    Backend creates a Stripe transfer to charity's connected account using
 *    the equivalent dollar amount (same number since 1 USDC = $1).
 *    On test mode: uses Stripe test keys, so no real money moves.
 *
 * No Coinbase, no DEX, no oracle — the peg IS the rate.
 */

const Stripe = require('stripe');
const Transaction = require('../models/Transaction');
const Charity = require('../models/Charity');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_missing');

const ENABLED = process.env.USDC_CONVERSION_ENABLED !== 'false';
const FAIL_SILENTLY = process.env.USDC_CONVERSION_FAIL_SILENTLY !== 'false';

class UsdcConversionService {
  /**
   * Record a USD -> USDC conversion.
   * Called after a Stripe payment settles when the charity prefers USDC.
   *
   * @param {Object} opts
   * @param {string} opts.transactionId   - MongoDB Transaction _id
   * @param {number} opts.amountCents     - Amount in cents (= same in USDC base units * 10^4)
   * @param {string} opts.charityId       - Charity MongoDB _id
   * @param {string} opts.charityWallet   - Charity Solana wallet address (if any)
   * @param {string} opts.userEmail       - Hashed/tracked for ledger only
   * @returns {Object} conversion result
   */
  async convertUsdToUsdc({ transactionId, amountCents, charityId, charityWallet, userEmail }) {
    const result = {
      enabled: ENABLED,
      direction: 'usd_to_usdc',
      amountCents,
      // 1 USDC = $0.000001 base units (6 decimals) — so cents * 10^4 = base units
      usdcBaseUnits: String(BigInt(amountCents) * 10000n),
      charityId,
      charityWallet: charityWallet || null,
      status: 'pending',
      simulatedAt: null,
      error: null
    };

    if (!ENABLED) {
      result.status = 'disabled';
      return result;
    }

    try {
      // Since 1 USDC == 1 USD, we record the conversion as complete.
      // In production: initiate a Solana USDC transfer from treasury wallet to charityWallet.
      // On devnet (SOLANA_ALLOW_UNVERIFIED_LOCAL_PAYMENTS=true): record as simulated.
      const isSimulated = process.env.SOLANA_ALLOW_UNVERIFIED_LOCAL_PAYMENTS === 'true';

      if (isSimulated || !charityWallet) {
        result.status = 'simulated';
        result.simulatedAt = new Date().toISOString();
        result.note = charityWallet
          ? `Devnet simulation: would transfer ${amountCents / 100} USDC to ${charityWallet}`
          : 'No charity USDC wallet configured; conversion recorded as pending_wallet';
      } else {
        // Production path: trigger Solana USDC transfer via ledger client
        const solanaLedger = require('./solana-ledger-client');
        if (solanaLedger.loadDeps() && solanaLedger.feePayer) {
          const { PublicKey, Transaction: SolanaTx } = solanaLedger._web3;
          const { createTransferCheckedInstruction, getOrCreateAssociatedTokenAccount } = solanaLedger._splToken;

          const mintPk = new PublicKey(solanaLedger.usdcMint);
          const treasuryKp = solanaLedger.feePayer;
          const charityPk = new PublicKey(charityWallet);

          const sourceAta = await getOrCreateAssociatedTokenAccount(
            solanaLedger.connection, treasuryKp, mintPk, treasuryKp.publicKey
          );
          const destAta = await getOrCreateAssociatedTokenAccount(
            solanaLedger.connection, treasuryKp, mintPk, charityPk
          );

          const tx = new SolanaTx().add(
            createTransferCheckedInstruction(
              sourceAta.address,
              mintPk,
              destAta.address,
              treasuryKp.publicKey,
              BigInt(amountCents) * 10000n,
              6 // USDC decimals
            )
          );

          const { sendAndConfirmTransaction } = solanaLedger._web3;
          const sig = await sendAndConfirmTransaction(solanaLedger.connection, tx, [treasuryKp]);
          result.status = 'completed';
          result.solanaSignature = sig;
        } else {
          result.status = 'simulated';
          result.note = 'Solana fee-payer not configured; falling back to simulation';
          result.simulatedAt = new Date().toISOString();
        }
      }

      // Update the Transaction document
      await Transaction.findByIdAndUpdate(transactionId, {
        conversionStatus: result.status === 'completed' ? 'completed' : 'simulated',
        'solana.usdcMint': process.env.SOLANA_USDC_MINT,
        'solana.usdcBaseUnits': result.usdcBaseUnits,
        'solana.conversionDirection': 'usd_to_usdc',
        'solana.conversionNote': result.note || null,
        'solana.conversionAt': new Date()
      });

      return result;
    } catch (error) {
      console.error('[UsdcConversion] USD->USDC failed:', error.message);
      result.status = 'failed';
      result.error = error.message;

      if (!FAIL_SILENTLY) throw error;
      return result;
    }
  }

  /**
   * Record a USDC -> USD conversion.
   * Called after a Solana USDC payment confirms when the charity prefers USD.
   *
   * Since 1 USDC = $1, we simply create a Stripe transfer to the charity's
   * connected account for the same dollar amount. In test mode, Stripe
   * processes this against test balances only.
   *
   * @param {Object} opts
   * @param {string} opts.transactionId       - MongoDB Transaction _id
   * @param {number} opts.amountCents         - Amount in cents
   * @param {string} opts.charityStripeId     - Charity Stripe connected account ID
   * @param {string} opts.userEmail
   * @returns {Object} conversion result
   */
  async convertUsdcToUsd({ transactionId, amountCents, charityStripeId, userEmail }) {
    const result = {
      enabled: ENABLED,
      direction: 'usdc_to_usd',
      amountCents,
      charityStripeId: charityStripeId || null,
      status: 'pending',
      stripeTransferId: null,
      error: null
    };

    if (!ENABLED) {
      result.status = 'disabled';
      return result;
    }

    try {
      if (!charityStripeId) {
        result.status = 'no_stripe_account';
        result.note = 'Charity has no Stripe connected account; USD payout cannot be issued';
        await Transaction.findByIdAndUpdate(transactionId, {
          conversionStatus: 'pending_provider',
          'solana.conversionDirection': 'usdc_to_usd',
          'solana.conversionNote': result.note
        });
        return result;
      }

      // Create Stripe transfer: same amount in cents because 1 USDC = $1
      const transfer = await stripe.transfers.create({
        amount: amountCents,
        currency: 'usd',
        destination: charityStripeId,
        description: `Charitap USDC->USD conversion for transaction ${transactionId}`,
        metadata: {
          transactionId: String(transactionId),
          sourceRail: 'solana_usdc',
          conversionDirection: 'usdc_to_usd'
        }
      });

      result.status = 'completed';
      result.stripeTransferId = transfer.id;

      await Transaction.findByIdAndUpdate(transactionId, {
        conversionStatus: 'completed',
        'solana.conversionDirection': 'usdc_to_usd',
        'solana.conversionStripeTransferId': transfer.id,
        'solana.conversionAt': new Date()
      });

      console.log(`[UsdcConversion] USDC->USD completed: ${transfer.id} ($${(amountCents / 100).toFixed(2)})`);
      return result;
    } catch (error) {
      console.error('[UsdcConversion] USDC->USD failed:', error.message);
      result.status = 'failed';
      result.error = error.message;

      await Transaction.findByIdAndUpdate(transactionId, {
        conversionStatus: 'failed',
        'solana.conversionError': error.message
      }).catch(() => {});

      if (!FAIL_SILENTLY) throw error;
      return result;
    }
  }

  /**
   * Decide and execute conversion based on payment rail and charity preference.
   *
   * @param {Object} transaction  - MongoDB Transaction document
   * @param {Object} charity      - MongoDB Charity document
   * @returns {Object|null} conversion result or null if not needed
   */
  async handleConversionIfNeeded(transaction, charity) {
    const rail = transaction.paymentRail;       // 'stripe' | 'solana'
    const pref = charity.payoutPreference;      // 'usd' | 'usdc' | 'either'

    // No conversion needed cases
    if (pref === 'either') return null;
    if (rail === 'stripe' && pref === 'usd') return null;
    if (rail === 'solana' && pref === 'usdc') return null;

    const opts = {
      transactionId: transaction._id,
      amountCents: transaction.amountCents || Math.round(transaction.amount * 100),
      userEmail: transaction.userEmail
    };

    if (rail === 'stripe' && pref === 'usdc') {
      // User paid USD, charity wants USDC
      return this.convertUsdToUsdc({
        ...opts,
        charityId: charity._id.toString(),
        charityWallet: charity.solanaWalletAddress
      });
    }

    if (rail === 'solana' && pref === 'usd') {
      // User paid USDC, charity wants USD
      return this.convertUsdcToUsd({
        ...opts,
        charityStripeId: charity.stripeAccountId
      });
    }

    return null;
  }

  /**
   * Get human-readable conversion description for the UI.
   */
  describeConversion(paymentRail, charityPayoutPreference) {
    if (charityPayoutPreference === 'either') {
      return { needed: false, label: 'No conversion needed (charity accepts either)' };
    }
    if (paymentRail === 'stripe' && charityPayoutPreference === 'usdc') {
      return {
        needed: true,
        direction: 'usd_to_usdc',
        label: 'Your USD donation will be converted to USDC (1:1) for this charity',
        fromLabel: 'USD via card',
        toLabel: 'USDC to charity wallet'
      };
    }
    if (paymentRail === 'solana' && charityPayoutPreference === 'usd') {
      return {
        needed: true,
        direction: 'usdc_to_usd',
        label: 'Your USDC donation will be converted to USD (1:1) for this charity',
        fromLabel: 'USDC via wallet',
        toLabel: 'USD to charity bank'
      };
    }
    return { needed: false, label: 'Same currency — no conversion' };
  }
}

module.exports = new UsdcConversionService();
