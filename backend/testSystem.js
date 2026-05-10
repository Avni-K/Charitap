#!/usr/bin/env node

/**
 * Charitap System Integration Test
 * Tests: API endpoints, Blockchain integration, Database operations
 * User: hnimonkar@gmail.com (Himanshu Nimonkar)
 */

const mongoose = require('mongoose');
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const RoundUp = require('./models/RoundUp');
const Charity = require('./models/Charity');
const resilientDB = require('./services/resilientdb-client');
require('dotenv').config();

const TEST_EMAIL = 'hnimonkar@gmail.com';
const TEST_NAME = 'Himanshu Nimonkar';

async function runTests() {
  console.log('\n🚀 Starting Charitap System Integration Tests\n');
  console.log('='.repeat(60));

  try {
    // Connect to MongoDB
    console.log('\n📊 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected successfully');

    // Test 1: Verify User exists
    console.log('\n👤 Test 1: Checking user account...');
    const user = await User.findOne({ email: TEST_EMAIL });
    if (user) {
      console.log(`✅ User found: ${user.name} (${user.email})`);
    } else {
      console.log('❌ User not found in database');
      return;
    }

    // Test 2: Check Transactions
    console.log('\n💰 Test 2: Checking transactions...');
    const transactions = await Transaction.find({ userEmail: TEST_EMAIL });
    console.log(`✅ Total transactions: ${transactions.length}`);
    
    if (transactions.length > 0) {
      const totalDonated = transactions.reduce((sum, t) => sum + t.amount, 0);
      console.log(`   Total donated: $${totalDonated.toFixed(2)}`);
      
      // Check blockchain status
      const blockchainSecured = transactions.filter(t => t.blockchainTxKey || t.blockchainTxId).length;
      console.log(`   Blockchain secured: ${blockchainSecured}/${transactions.length}`);
      
      if (blockchainSecured < transactions.length) {
        console.log(`⚠️  WARNING: ${transactions.length - blockchainSecured} transactions not on blockchain`);
      }
    }

    // Test 3: Check RoundUps
    console.log('\n💳 Test 3: Checking roundups...');
    const allRoundUps = await RoundUp.find({ user: TEST_EMAIL });
    const pendingRoundUps = await RoundUp.find({ user: TEST_EMAIL, isPaid: false });
    console.log(`✅ Total roundups: ${allRoundUps.length}`);
    console.log(`   Pending: ${pendingRoundUps.length}`);
    
    if (pendingRoundUps.length > 0) {
      const pendingAmount = pendingRoundUps.reduce((sum, r) => sum + r.roundUpAmount, 0);
      console.log(`   Pending amount: $${pendingAmount.toFixed(2)}`);
      
      // Check blockchain for pending roundups
      const pendingOnBlockchain = pendingRoundUps.filter(r => r.blockchainTxKey || r.blockchainTxId).length;
      console.log(`   On blockchain: ${pendingOnBlockchain}/${pendingRoundUps.length}`);
    }

    // Test 4: Monthly Donations (YTD)
    console.log('\n📅 Test 4: Checking monthly donations (YTD)...');
    const now = new Date();
    const currentYear = now.getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    
    const ytdTransactions = await Transaction.find({
      userEmail: TEST_EMAIL,
      timestamp: { $gte: startOfYear, $lte: now }
    });
    
    const monthlyData = {};
    ytdTransactions.forEach(t => {
      const date = new Date(t.timestamp);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { count: 0, amount: 0 };
      }
      monthlyData[monthKey].count++;
      monthlyData[monthKey].amount += t.amount;
    });
    
    console.log(`✅ YTD Donations (${currentYear}):`);
    Object.keys(monthlyData).sort().forEach(month => {
      const [year, monthNum] = month.split('-');
      const monthName = new Date(year, parseInt(monthNum) - 1).toLocaleDateString('en-US', { month: 'short' });
      console.log(`   ${monthName} ${year}: $${monthlyData[month].amount.toFixed(2)} (${monthlyData[month].count} transactions)`);
    });

    // Test 5: Test Blockchain Connection
    console.log('\n⛓️  Test 5: Testing blockchain connection...');
    if (resilientDB.enabled) {
      console.log('✅ Blockchain integration is ENABLED');
      console.log(`   GraphQL URL: ${resilientDB.graphqlUrl}`);
      
      // Test write operation
      const testKey = resilientDB.generateKey('test', `test-${Date.now()}`);
      const testData = {
        testId: `test-${Date.now()}`,
        timestamp: new Date().toISOString(),
        purpose: 'System integration test'
      };
      
      console.log('   Testing blockchain write...');
      const txId = await resilientDB.set(testKey, testData);
      
      if (txId) {
        console.log(`✅ Blockchain write successful! TX ID: ${txId}`);
      } else {
        console.log('⚠️  Blockchain write returned null (may be disabled)');
      }
    } else {
      console.log('❌ Blockchain integration is DISABLED');
    }

    // Test 6: Check Charities
    console.log('\n🏥 Test 6: Checking charities...');
    const charities = await Charity.find({});
    console.log(`✅ Total charities in system: ${charities.length}`);
    if (charities.length > 0) {
      console.log('   Available charities:');
      charities.forEach(c => {
        console.log(`   - ${c.name} (${c.type})`);
      });
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 SYSTEM STATUS SUMMARY');
    console.log('='.repeat(60));
    console.log(`User: ${TEST_NAME} (${TEST_EMAIL})`);
    console.log(`Total Donated: $${transactions.reduce((sum, t) => sum + t.amount, 0).toFixed(2)}`);
    console.log(`Transactions: ${transactions.length}`);
    console.log(`Blockchain Secured: ${transactions.filter(t => t.blockchainTxKey).length}/${transactions.length}`);
    console.log(`Pending Wallet: $${pendingRoundUps.reduce((sum, r) => sum + r.roundUpAmount, 0).toFixed(2)}`);
    console.log(`Charities Available: ${charities.length}`);
    console.log(`Blockchain Status: ${resilientDB.enabled ? 'ENABLED ✅' : 'DISABLED ❌'}`);
    console.log('='.repeat(60));

    console.log('\n✅ All tests completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📊 MongoDB disconnected\n');
  }
}

// Run tests
runTests();
