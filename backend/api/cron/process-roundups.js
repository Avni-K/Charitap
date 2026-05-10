// Vercel Cron Job handler for daily roundup processing.

const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const User = require('../../models/User');
const settlementService = require('../../services/roundup-settlement-service');

let isConnected = false;
const connectDB = async () => {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGODB_URI);
  isConnected = true;
};

module.exports = async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('Running daily roundup processor (Vercel Cron)...');

  try {
    await connectDB();
    const users = await User.find();
    const today = new Date();
    const results = [];

    for (const user of users) {
      const shouldProcess =
        user.paymentPreference === 'threshold' ||
        (user.paymentPreference === 'monthly' && today.getDate() === 1);

      if (!shouldProcess) continue;

      const result = await settlementService.processUserRoundups(user);
      results.push({ email: user.email, ...result });
    }

    res.json({
      success: true,
      processed: results.filter(result => result.processed).length,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error in cron job:', err.message);
    res.status(500).json({ error: err.message });
  }
};
