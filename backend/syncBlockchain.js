require('dotenv').config(); // Load env FIRST

const mongoose = require('mongoose');
const Transaction = require('./models/Transaction');
const RoundUp = require('./models/RoundUp');
const resilientDB = require('./services/resilientdb-client');
const rescontractClient = require('./services/rescontract-client');

const USER_EMAIL = 'hnimonkar@gmail.com';

async function syncToBlockchain() {
  console.log('\n🔗 Syncing Charitap Data to Blockchain');
  console.log('=' + '='.repeat(59));
  console.log(`User: ${USER_EMAIL}`);
  console.log('=' + '='.repeat(59));

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected\n');

    // Check if blockchain is enabled
    console.log('Blockchain status:', resilientDB.enabled ? 'ENABLED ✅' : 'DISABLED ❌');

    if (!resilientDB.enabled) {
      console.log('\n⚠️  ResilientDB is DISABLED in environment');
      console.log('   Set RESILIENTDB_ENABLED=true in .env file');
      console.log('   Current RESILIENTDB_ENABLED:', process.env.RESILIENTDB_ENABLED);
      await mongoose.disconnect();
      return;
    }

    // Sync Transactions
    console.log('\n📊 Syncing Transactions to Blockchain...');
    const transactions = await Transaction.find({
      userEmail: USER_EMAIL,
      $or: [
        { blockchainTxKey: { $exists: false } },
        { blockchainTxKey: null },
        { blockchainTxKey: '' }
      ]
    });

    console.log(`Found ${transactions.length} transactions to sync`);

    for (const transaction of transactions) {
      const ledgerKey = resilientDB.generateKey('transaction', transaction._id.toString());
      const ledgerData = {
        transactionId: transaction._id.toString(),
        userId: resilientDB.hashSensitiveData(USER_EMAIL),
        amount: parseFloat(transaction.amount).toFixed(2),
        charityId: transaction.charity?.toString() || 'unknown',
        timestamp: transaction.timestamp?.toISOString() || new Date().toISOString(),
        stripeTransactionId: transaction.stripeTransactionId || '',
        status: 'completed',
        blockchainVersion: '2.0'
      };

      try {
        console.log(`  Syncing transaction ${transaction._id}...`);
        const txId = await resilientDB.set(ledgerKey, ledgerData);

        if (txId) {
          transaction.blockchainTxKey = ledgerKey;
          transaction.blockchainTxId = txId;
          transaction.blockchainVerified = true;
          transaction.blockchainTimestamp = new Date();

          // Smart Contract: mint an on-chain receipt (runs independently of ledger)
          try {
            // Convert MongoDB ObjectId to a numeric hash for Solidity uint256
            const charityIdStr = transaction.charity?.toString() || '0';
            const charityNumericId = parseInt(charityIdStr.slice(-8), 16) || 0;
            const amountCents = Math.round(parseFloat(transaction.amount) * 100);

            const receiptResult = await rescontractClient.mintReceipt(charityNumericId, amountCents);
            if (receiptResult) {
              transaction.contractReceiptId = receiptResult;
              console.log(`  📜 Contract receipt minted: ${receiptResult}`);
            }
          } catch (contractError) {
            console.error(`  ⚠️  Contract receipt failed (non-blocking): ${contractError.message}`);
          }

          // Save with error handling
          try {
            await transaction.save();
            console.log(`  ✅ Synced: TX ID ${txId}`);
          } catch (saveError) {
            console.error(`  ❌ Failed to save to MongoDB: ${saveError.message}`);
          }
        } else {
          console.log(`  ⚠️  Blockchain returned null (may be silently failing)`);
        }
      } catch (error) {
        console.error(`  ❌ Failed: ${error.message}`);
      }
    }

    // Sync RoundUps
    console.log('\n💳 Syncing RoundUps to Blockchain...');
    const roundups = await RoundUp.find({
      user: USER_EMAIL,
      $or: [
        { blockchainTxKey: { $exists: false } },
        { blockchainTxKey: null },
        { blockchainTxKey: '' }
      ]
    });

    console.log(`Found ${roundups.length} roundups to sync`);

    for (const roundup of roundups) {
      const ledgerKey = resilientDB.generateKey('donation', roundup._id.toString());
      const ledgerData = {
        transactionId: roundup._id.toString(),
        userId: resilientDB.hashSensitiveData(USER_EMAIL),
        purchaseAmount: parseFloat(roundup.purchaseAmount).toFixed(2),
        roundUpAmount: parseFloat(roundup.roundUpAmount).toFixed(2),
        timestamp: roundup.createdAt?.toISOString() || new Date().toISOString(),
        status: roundup.isPaid ? 'paid' : 'pending',
        blockchainVersion: '2.0'
      };

      try {
        console.log(`  Syncing roundup ${roundup._id}...`);
        const txId = await resilientDB.set(ledgerKey, ledgerData);

        if (txId) {
          roundup.blockchainTxKey = ledgerKey;
          roundup.blockchainTxId = txId;
          roundup.blockchainVerified = true;
          roundup.blockchainTimestamp = new Date();
          await roundup.save();
          console.log(`  ✅ Synced: TX ID ${txId}`);
        } else {
          console.log(`  ⚠️  Blockchain returned null`);
        }
      } catch (error) {
        console.error(`  ❌ Failed: ${error.message}`);
      }
    }

    // Final Report
    console.log('\n' + '=' + '='.repeat(59));
    console.log('📋 SYNC COMPLETE');
    console.log('=' + '='.repeat(59));

    const allTransactions = await Transaction.find({ userEmail: USER_EMAIL });
    const allRoundUps = await RoundUp.find({ user: USER_EMAIL });

    const transactionsOnBlockchain = allTransactions.filter(t => t.blockchainTxKey).length;
    const roundupsOnBlockchain = allRoundUps.filter(r => r.blockchainTxKey).length;

    console.log(`Transactions: ${transactionsOnBlockchain}/${allTransactions.length} on blockchain`);
    console.log(`RoundUps: ${roundupsOnBlockchain}/${allRoundUps.length} on blockchain`);
    console.log('=' + '='.repeat(59) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ MongoDB disconnected\n');
  }
}

syncToBlockchain();
