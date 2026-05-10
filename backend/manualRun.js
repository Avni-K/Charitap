const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config(); // Must be called before requiring services

const Stripe = require('stripe');

const RoundUp = require('./models/RoundUp');
const User = require('./models/User');
const Charity = require('./models/Charity');
const Transaction = require('./models/Transaction');
const resilientDB = require('./services/resilientdb-client');
const rescontractClient = require('./services/rescontract-client');
const donationValidator = require('./services/donation-validator');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

async function processUserRoundups(user) {
  const unpaidRoundUps = await RoundUp.find({ user: user.email, isPaid: false });
  let totalAmount = unpaidRoundUps.reduce((sum, ru) => sum + ru.roundUpAmount, 0);

  // Handle different payment preferences
  if (user.paymentPreference === 'threshold') {
    if (totalAmount < 5) return;
  } else if (user.paymentPreference === 'monthly') {
    if (totalAmount < 1) {
      totalAmount = 1;
      console.log(`Rounding up ${user.email} to $1 minimum`);
    }
  }

  const charities = await Charity.find({ _id: { $in: user.selectedCharities } });
  if (!charities.length) {
    console.log(`No charities selected for ${user.email}`);
    return;
  }

  // Check if user has payment method
  if (!user.defaultPaymentMethod) {
    console.log(`No payment method for ${user.email} - skipping`);
    return;
  }

  try {
    // STEP 1: Charge the user's card
    console.log(`Charging ${user.email} for $${totalAmount.toFixed(2)}`);

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
      },
    });

    console.log(`Successfully charged ${user.email}: $${totalAmount.toFixed(2)}`);

    // STEP 2: Transfer to charities
    const perCharityAmount = totalAmount / charities.length;

    for (const charity of charities) {
      try {
        const transfer = await stripe.transfers.create({
          amount: Math.round(perCharityAmount * 100),
          currency: 'usd',
          destination: charity.stripeAccountId,
          transfer_group: `payment_${paymentIntent.id}`,
          description: `Donation from ${user.email}`,
        });

        const transaction = await Transaction.create({
          stripeTransactionId: transfer.id,
          stripePaymentIntentId: paymentIntent.id,
          userEmail: user.email,
          amount: perCharityAmount,
          charity: charity._id,
        });

        console.log(`Transferred $${perCharityAmount.toFixed(2)} to ${charity.name}`);

        // Record transaction on ResilientDB blockchain & Smart Contract
        try {
          const donationData = {
            amount: perCharityAmount,
            charities: [charity._id.toString()]
          };
          const validationResult = donationValidator.validateDonation(donationData);

          const ledgerKey = resilientDB.generateKey('transaction', transaction._id.toString());
          const ledgerData = {
            transactionId: transaction._id.toString(),
            stripeTransferId: transfer.id,
            stripePaymentIntentId: paymentIntent.id,
            userId: resilientDB.hashSensitiveData(user.email),
            amount: perCharityAmount.toFixed(2),
            charityId: charity._id.toString(),
            charityName: charity.name,
            timestamp: new Date().toISOString(),
            status: 'completed',
            validated: validationResult.valid,
            validationRules: validationResult.appliedRules,
            blockchainVersion: '2.0'
          };

          const txId = await resilientDB.set(ledgerKey, ledgerData);

          if (txId) {
            transaction.blockchainTxKey = ledgerKey;
            transaction.blockchainTxId = txId;
            transaction.blockchainVerified = true;
            transaction.blockchainTimestamp = new Date();

            // Smart Contract Interaction
            try {
              const charityNumericId = parseInt(charity._id.toString().slice(-8), 16) || 0;
              const amountCents = Math.round(perCharityAmount * 100);
              const receiptResult = await rescontractClient.mintReceipt(charityNumericId, amountCents);
              if (receiptResult) {
                transaction.contractReceiptId = receiptResult;
                console.log(`📜 Contract receipt minted: ${receiptResult}`);
              }
            } catch (contractError) {
              console.error(`⚠️ Contract receipt failed: ${contractError.message}`);
            }

            await transaction.save();
            console.log(`✅ Transaction recorded on blockchain: ${txId}`);
          }
        } catch (blockchainError) {
          console.error('⚠️ Blockchain write failed:', blockchainError.message);
          transaction.blockchainError = blockchainError.message;
          await transaction.save();
        }
      } catch (err) {
        console.error(`Error transferring to ${charity.name}:`, err.message);
      }
    }

    // STEP 3: Mark roundups as processed
    const now = new Date();
    await RoundUp.updateMany(
      { user: user.email, isPaid: false },
      {
        $set: {
          isPaid: true,
          stripePaymentIntentId: paymentIntent.id,
          chargedAt: now,
          processedAt: now
        }
      }
    );

    console.log(`Completed processing for ${user.email}`);

  } catch (error) {
    console.error(`Error charging ${user.email}:`, error.message);
    if (error.type === 'StripeCardError') {
      console.log(`Card declined for ${user.email}`);
    }
  }
}

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(async () => {
    console.log('Running manual processor...');
    const users = await User.find();

    for (const user of users) {
      // For manual run, force process by ignoring date filters:
      // (Bypassing the daily/monthly logic for testing)
      await processUserRoundups(user);
    }

    mongoose.disconnect();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });
