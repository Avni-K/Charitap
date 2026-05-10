require('dotenv').config(); // Load env FIRST

const mongoose = require('mongoose');
const Transaction = require('./models/Transaction');
const RoundUp = require('./models/RoundUp');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const transactions = await Transaction.find({ userEmail: 'hnimonkar@gmail.com' });
  const roundups = await RoundUp.find({ user: 'hnimonkar@gmail.com' });
  
  console.log('Transactions for hnimonkar@gmail.com:', transactions.length);
  console.log('RoundUps for hnimonkar@gmail.com:', roundups.length);
  
  if (transactions.length > 0) {
    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    console.log('Total donated: $' + total.toFixed(2));
    
    const onBlockchain = transactions.filter(t => t.blockchainTxKey || t.blockchainTxId).length;
    console.log('On blockchain:', onBlockchain + '/' + transactions.length);
    
    console.log('\nTransaction details:');
    transactions.forEach(t => {
      const date = t.timestamp ? t.timestamp.toISOString().substring(0, 10) : 'unknown';
      const blockchain = t.blockchainTxKey ? 'YES ✅' : 'NO ❌';
      console.log('  - $' + t.amount.toFixed(2), 'at', date, 'blockchain:', blockchain);
    });
  }
  
  if (roundups.length > 0) {
    const pending = roundups.filter(r => !r.isPaid);
    const pendingAmount = pending.reduce((sum, r) => sum + r.roundUpAmount, 0);
    console.log('\nPending roundups: ' + pending.length + ' ($' + pendingAmount.toFixed(2) + ')');
  }
  
  await mongoose.disconnect();
  console.log('\nDone!');
});
