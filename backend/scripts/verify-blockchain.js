/**
 * Verify Blockchain Script
 * 
 * Goes through all transactions in MongoDB that have a blockchainTxId
 * and verifies each one exists on ResilientDB using the verify() function.
 * 
 * Usage: node scripts/verify-blockchain.js
 * 
 * Outputs a detailed report of verified, failed, and skipped transactions.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const Transaction = require('../models/Transaction');
const Charity = require('../models/Charity');
const resilientDB = require('../services/resilientdb-client');

async function verifyBlockchain() {
    console.log('=== ResilientDB Verification Script ===\n');

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
        console.log('Connected to MongoDB');
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

    // Fetch all transactions
    const allTransactions = await Transaction.find({}).populate('charity', 'name type');
    console.log(`Total transactions in MongoDB: ${allTransactions.length}\n`);

    const withBlockchainId = allTransactions.filter(tx => tx.blockchainTxId);
    const withoutBlockchainId = allTransactions.filter(tx => !tx.blockchainTxId);

    console.log(`  With blockchainTxId:    ${withBlockchainId.length}`);
    console.log(`  Without blockchainTxId: ${withoutBlockchainId.length}`);
    console.log('');

    if (withoutBlockchainId.length > 0) {
        console.log('⚠ Transactions missing blockchainTxId (not on blockchain):');
        withoutBlockchainId.forEach(tx => {
            console.log(`  - ${tx._id} | $${tx.amount.toFixed(2)} | ${tx.userEmail} | ${tx.charity?.name || 'Unknown'}`);
        });
        console.log('');
    }

    if (withBlockchainId.length === 0) {
        console.log('No transactions to verify on the blockchain.');
        await mongoose.disconnect();
        process.exit(0);
    }

    // Verify each transaction on the blockchain
    console.log(`--- Verifying ${withBlockchainId.length} transactions on ResilientDB ---\n`);

    let verifiedCount = 0;
    let failedCount = 0;
    let errorCount = 0;
    const failedTransactions = [];
    const errorTransactions = [];

    for (let i = 0; i < withBlockchainId.length; i++) {
        const tx = withBlockchainId[i];
        const index = `[${i + 1}/${withBlockchainId.length}]`;

        try {
            process.stdout.write(`${index} Verifying ${tx._id} (blockchain: ${tx.blockchainTxId.substring(0, 16)}...) `);

            const isVerified = await resilientDB.verify(tx.blockchainTxId);

            if (isVerified) {
                console.log('✓ VERIFIED');
                verifiedCount++;
            } else {
                console.log('✗ NOT FOUND ON BLOCKCHAIN');
                failedCount++;
                failedTransactions.push({
                    id: tx._id.toString(),
                    blockchainTxId: tx.blockchainTxId,
                    amount: tx.amount,
                    userEmail: tx.userEmail,
                    charity: tx.charity?.name || 'Unknown'
                });
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 300));

        } catch (error) {
            console.log(`✗ ERROR: ${error.message}`);
            errorCount++;
            errorTransactions.push({
                id: tx._id.toString(),
                blockchainTxId: tx.blockchainTxId,
                error: error.message
            });
        }
    }

    // Print summary report
    console.log('\n========================================');
    console.log('       VERIFICATION REPORT');
    console.log('========================================\n');
    console.log(`  Total in MongoDB:        ${allTransactions.length}`);
    console.log(`  On blockchain (have ID): ${withBlockchainId.length}`);
    console.log(`  Not on blockchain:       ${withoutBlockchainId.length}`);
    console.log('');
    console.log(`  ✓ Verified on-chain:     ${verifiedCount}`);
    console.log(`  ✗ Not found on-chain:    ${failedCount}`);
    console.log(`  ✗ Errors during verify:  ${errorCount}`);
    console.log('');

    const allGood = failedCount === 0 && errorCount === 0 && withoutBlockchainId.length === 0;
    if (allGood) {
        console.log('  🎉 ALL TRANSACTIONS VERIFIED ON BLOCKCHAIN!');
    } else {
        if (failedCount > 0) {
            console.log('  ⚠ FAILED VERIFICATIONS:');
            failedTransactions.forEach(tx => {
                console.log(`    - ${tx.id} | $${tx.amount.toFixed(2)} | ${tx.userEmail} | ${tx.charity}`);
                console.log(`      Blockchain TX: ${tx.blockchainTxId}`);
            });
            console.log('');
        }

        if (errorCount > 0) {
            console.log('  ⚠ VERIFICATION ERRORS:');
            errorTransactions.forEach(tx => {
                console.log(`    - ${tx.id} | Error: ${tx.error}`);
            });
            console.log('');
        }

        if (withoutBlockchainId.length > 0) {
            console.log(`  ⚠ ${withoutBlockchainId.length} transaction(s) never written to blockchain.`);
            console.log('    Run: node scripts/backfill-blockchain.js');
            console.log('');
        }
    }

    console.log('========================================\n');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');

    // Exit with error code if any failures
    process.exit(allGood ? 0 : 1);
}

verifyBlockchain().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
