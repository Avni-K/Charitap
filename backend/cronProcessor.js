const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cron = require('node-cron');

const User = require('./models/User');
const settlementService = require('./services/roundup-settlement-service');

dotenv.config();

// Connect to MongoDB for standalone local cron usage. If server.js already
// connected first, Mongoose reuses the active connection.
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB for cron job'))
  .catch(err => console.error('MongoDB connection error:', err));

// Run the cron job every day at midnight.
cron.schedule('0 0 * * *', async () => {
  console.log('Running daily roundup processor...');

  try {
    const users = await User.find();
    const today = new Date();

    for (const user of users) {
      const shouldProcess =
        user.paymentPreference === 'threshold' ||
        (user.paymentPreference === 'monthly' && today.getDate() === 1);

      if (!shouldProcess) continue;

      const result = await settlementService.processUserRoundups(user);
      if (result.processed) {
        console.log(`Completed processing for ${user.email}: ${result.batchId}`);
      } else if (!['below_threshold', 'no_pending_roundups'].includes(result.reason)) {
        console.log(`Skipped ${user.email}: ${result.reason}`);
      }
    }
  } catch (err) {
    console.error('Error in cron job:', err.message);
  }
});
