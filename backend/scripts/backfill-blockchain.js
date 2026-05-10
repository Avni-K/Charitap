/**
 * Backfill Blockchain Script
 * 
 * Retroactively records existing transactions on ResilientDB that were
 * created before blockchain integration was enabled.
 * 
 * Usage: node scripts/backfill-blockchain.js
 * 
 * Safe to run multiple times - only processes transactions without a blockchainTxId.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const Transaction = require('../models/Transaction');
const Charity = require('../models/Charity');
const resilientDB = require('../services/resilientdb-client');
const donationValidator = require('../services/donation-validator');

async function backfillBlockchain() {
    console.log('=== ResilientDB Backfill Script ===\n');

    // Check if ResilientDB is enabled
    if (!resilientDB.enabled) {
        console.error('ERROR: ResilientDB is not enabled!');
        console.error('Set RESILIENTDB_ENABLED=true in your .env file.');
        process.exit(1);
    }

    // Connect to MongoDB
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB\n');
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
        process.exit(1);
    }

    // Health check ResilientDB
    console.log('Checking ResilientDB availability...');
    const isHealthy = await resilientDB.healthCheck();
    if (!isHealthy) {
        console.error('ERROR: ResilientDB GraphQL service is not available.');
        console.error(`URL: ${resilientDB.graphqlUrl}`);
        process.exit(1);
    }
    console.log('ResilientDB is available!\n');

    // Find transactions not yet on blockchain
    const unrecordedTransactions = await Transaction.find({
        $or: [
            { blockchainTxId: { $exists: false } },
            { blockchainTxId: null },
            { blockchainTxId: '' }
        ]
    }).populate('charity', 'name type');

    console.log(`Found ${unrecordedTransactions.length} transactions not yet on blockchain.\n`);

    if (unrecordedTransactions.length === 0) {
        console.log('All transactions are already on the blockchain!');
        await mongoose.disconnect();
        process.exit(0);
    }

    let successCount = 0;
    let failCount = 0;

    for (const transaction of unrecordedTransactions) {
        try {
            const donationData = {
                amount: transaction.amount,
                charities: [transaction.charity._id.toString()]
            };
            const validationResult = donationValidator.validateDonation(donationData);

            const ledgerKey = resilientDB.generateKey('transaction', transaction._id.toString());
            const ledgerData = {
                transactionId: transaction._id.toString(),
                stripeTransferId: transaction.stripeTransactionId || 'N/A',
                stripePaymentIntentId: transaction.stripePaymentIntentId || 'N/A',
                userId: resilientDB.hashSensitiveData(transaction.userEmail),
                amount: transaction.amount.toFixed(2),
                charityId: transaction.charity._id.toString(),
                charityName: transaction.charity.name || 'Unknown',
                timestamp: (transaction.timestamp || transaction.createdAt || new Date()).toISOString(),
                status: 'completed',
                validated: validationResult.valid,
                validationRules: validationResult.appliedRules,
                blockchainVersion: '2.0',
                backfilled: true // Mark as retroactively added
            };

            console.log(`[${successCount + failCount + 1}/${unrecordedTransactions.length}] Writing transaction ${transaction._id}...`);

            const txId = await resilientDB.set(ledgerKey, ledgerData);

            if (txId) {
                transaction.blockchainTxKey = ledgerKey;
                transaction.blockchainTxId = txId;
                transaction.blockchainVerified = true;
                transaction.blockchainTimestamp = new Date();
                transaction.blockchainError = undefined; // Clear any previous errors
                await transaction.save();

                console.log(`  ✓ Recorded on blockchain: ${txId}`);
                successCount++;
            } else {
                console.log(`  ✗ Failed - no transaction ID returned`);
                failCount++;
            }

            // Small delay between requests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
            console.error(`  ✗ Error: ${error.message}`);
            transaction.blockchainError = error.message;
            await transaction.save();
            failCount++;
        }
    }

    console.log('\n=== Backfill Complete ===');
    console.log(`  Success: ${successCount}`);
    console.log(`  Failed:  ${failCount}`);
    console.log(`  Total:   ${unrecordedTransactions.length}`);

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
}

backfillBlockchain().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
