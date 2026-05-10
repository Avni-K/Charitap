const mongoose = require('mongoose');
const Transaction = require('./models/Transaction');
const RoundUp = require('./models/RoundUp');
const Charity = require('./models/Charity');
require('dotenv').config();

async function addMockData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/charitap');
    console.log('Connected to MongoDB');

    const userEmail = 'hnimonkar@gmail.com';
    
    // Create or get charities
    const charities = await Promise.all([
      Charity.findOneAndUpdate(
        { name: 'Feeding America' },
        { name: 'Feeding America', type: 'Poverty', stripeAccountId: 'acct_mock_feeding_america' },
        { upsert: true, new: true }
      ),
      Charity.findOneAndUpdate(
        { name: 'World Wildlife Fund' },
        { name: 'World Wildlife Fund', type: 'Environment', stripeAccountId: 'acct_mock_wwf' },
        { upsert: true, new: true }
      ),
      Charity.findOneAndUpdate(
        { name: 'St. Jude Children\'s Research Hospital' },
        { name: 'St. Jude Children\'s Research Hospital', type: 'Health', stripeAccountId: 'acct_mock_stjude' },
        { upsert: true, new: true }
      ),
      Charity.findOneAndUpdate(
        { name: 'American Red Cross' },
        { name: 'American Red Cross', type: 'Other', stripeAccountId: 'acct_mock_redcross' },
        { upsert: true, new: true }
      )
    ]);
    
    console.log(`✅ Created/Updated ${charities.length} charities`);

    // January 2026 mock transactions
    const januaryTransactions = [
      {
        userEmail,
        amount: 12.50,
        charity: charities[0]._id,
        timestamp: new Date('2026-01-05T10:30:00Z'),
        stripeTransactionId: 'mock_stripe_jan_001'
      },
      {
        userEmail,
        amount: 12.50,
        charity: charities[0]._id,
        timestamp: new Date('2026-01-05T10:30:00Z'),
        stripeTransactionId: 'mock_stripe_jan_001'
      },
      {
        userEmail,
        amount: 8.75,
        charity: charities[1]._id,
        timestamp: new Date('2026-01-12T14:20:00Z'),
        stripeTransactionId: 'mock_stripe_jan_002'
      },
      {
        userEmail,
        amount: 15.25,
        charity: charities[2]._id,
        timestamp: new Date('2026-01-18T09:45:00Z'),
        stripeTransactionId: 'mock_stripe_jan_003'
      },
      {
        userEmail,
        amount: 10.00,
        charity: charities[3]._id,
        timestamp: new Date('2026-01-25T16:30:00Z'),
        stripeTransactionId: 'mock_stripe_jan_004'
      }
    ];

    // February 2026 mock transactions
    const februaryTransactions = [
      {
        userEmail,
        amount: 18.50,
        charity: charities[0]._id,
        timestamp: new Date('2026-02-03T11:15:00Z'),
        stripeTransactionId: 'mock_stripe_feb_001'
      },
      {
        userEmail,
        amount: 14.75,
        charity: charities[1]._id,
        timestamp: new Date('2026-02-07T13:40:00Z'),
        stripeTransactionId: 'mock_stripe_feb_002'
      }
    ];

    // Insert transactions
    const allTransactions = [...januaryTransactions, ...februaryTransactions];
    await Transaction.insertMany(allTransactions);
    console.log(`✅ Inserted ${allTransactions.length} mock transactions`);

    // Add some pending roundups for wallet balance
    const pendingRoundUps = [
      {
        user: userEmail,
        purchaseAmount: 12.45,
        roundUpAmount: 0.55,
        merchantName: 'Amazon',
        timestamp: new Date('2026-02-08T10:00:00Z'),
        isPaid: false
      },
      {
        user: userEmail,
        purchaseAmount: 25.67,
        roundUpAmount: 0.33,
        merchantName: 'Walmart',
        timestamp: new Date('2026-02-08T15:30:00Z'),
        isPaid: false
      },
      {
        user: userEmail,
        purchaseAmount: 8.33,
        roundUpAmount: 0.67,
        merchantName: 'Target',
        timestamp: new Date('2026-02-09T09:20:00Z'),
        isPaid: false
      }
    ];

    await RoundUp.insertMany(pendingRoundUps);
    console.log(`✅ Inserted ${pendingRoundUps.length} pending roundups`);

    // Summary
    const janTotal = januaryTransactions.reduce((sum, t) => sum + t.amount, 0);
    const febTotal = februaryTransactions.reduce((sum, t) => sum + t.amount, 0);
    const walletBalance = pendingRoundUps.reduce((sum, r) => sum + r.roundUpAmount, 0);

    console.log('\n📊 Mock Data Summary:');
    console.log(`   January 2026: $${janTotal.toFixed(2)} (${januaryTransactions.length} transactions)`);
    console.log(`   February 2026: $${febTotal.toFixed(2)} (${februaryTransactions.length} transactions)`);
    console.log(`   Total Donated: $${(janTotal + febTotal).toFixed(2)}`);
    console.log(`   Last Month (January): $${janTotal.toFixed(2)}`);
    console.log(`   Wallet Balance: $${walletBalance.toFixed(2)}`);
    console.log(`   Blockchain Secured: ${allTransactions.length}/${allTransactions.length} (100%)`);
    console.log(`   User: ${userEmail}`);
    mongoose.connection.close();
    console.log('\n✅ Mock data added successfully!');
  } catch (error) {
    console.error('❌ Error adding mock data:', error);
    process.exit(1);
  }
}

addMockData();
