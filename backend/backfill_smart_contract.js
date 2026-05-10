const mongoose = require('mongoose');
require('dotenv').config(); // Load env first

const Transaction = require('./models/Transaction');
const resContract = require('./services/rescontract-client');

async function backfillSmartContract() {
    console.log('--- Backfill Smart Contract Receipt IDs ---');
    console.log(`Contract: ${process.env.RESCONTRACT_CONTRACT_ADDRESS || 'MISSING'}`);

    if (!process.env.RESCONTRACT_ENABLED) {
        console.error('Error: RESCONTRACT_ENABLED is false/missing in .env');
        return;
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB connected');

        // Find transactions that are missing contractReceiptId
        // We can process ALL transactions, or just the ones already synced to blockchain.
        // Let's process all validated transactions (amount > 0).
        const query = {
            $or: [
                { contractReceiptId: { $exists: false } },
                { contractReceiptId: null },
                { contractReceiptId: '' }
            ]
        };

        const transactions = await Transaction.find(query);
        console.log(`Found ${transactions.length} transactions needing backfill.`);

        let successCount = 0;
        let failCount = 0;

        for (const tx of transactions) {
            console.log(`\nProcessing TX ${tx._id} (Amount: $${tx.amount}, Charity: ${tx.charity})...`);

            try {
                // 1. Convert Charity ID (ObjectId -> Numeric for Contract)
                // Take last 8 chars of hex string and convert to int
                const charityIdStr = tx.charity ? tx.charity.toString() : '0';
                const charityNumericId = parseInt(charityIdStr.slice(-8), 16) || 0;

                // 2. Convert Amount (Dollars -> Cents)
                // Use Math.round to avoid float precision issues
                const amountCents = Math.round(parseFloat(tx.amount) * 100);

                if (charityNumericId === 0 || amountCents <= 0) {
                    console.log(`  Skipping: Invalid data (CharityID or Amount=0)`);
                    failCount++;
                    continue;
                }

                // 3. Call Smart Contract
                console.log(`  Minting Receipt: Charity=${charityNumericId}, Amount=${amountCents}`);
                const receiptId = await resContract.mintReceipt(charityNumericId, amountCents);

                if (receiptId) {
                    console.log(`  ✅ Success! Old Receipt ID: ${receiptId}`);

                    // 4. Update Database
                    tx.contractReceiptId = receiptId;
                    // Ensure blockchainVerified is set if it wasn't already
                    if (!tx.blockchainVerified) {
                        tx.blockchainVerified = true;
                        tx.blockchainTimestamp = new Date();
                        // Note: blockchainTxId might still be missing if syncBlockchain hasn't run,
                        // but this script is just for the smart contract aspect.
                    }

                    await tx.save();
                    successCount++;
                } else {
                    console.error(`  ❌ Failed: Contract returned null`);
                    failCount++;
                }

            } catch (err) {
                console.error(`  ❌ Error processing tx: ${err.message}`);
                failCount++;
            }
        }

        console.log('\n--- Backfill Complete ---');
        console.log(`Success: ${successCount}`);
        console.log(`Failed:  ${failCount}`);

    } catch (err) {
        console.error('Fatal Error:', err);
    } finally {
        await mongoose.disconnect();
        console.log('✅ MongoDB disconnected');
    }
}

backfillSmartContract();
