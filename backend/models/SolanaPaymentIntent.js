const mongoose = require('mongoose');

const solanaPaymentIntentSchema = new mongoose.Schema({
  userEmail: { type: String, required: true, index: true },
  walletAddress: { type: String, required: true },
  amount: { type: Number, required: true },
  amountCents: { type: Number, required: true },
  usdcBaseUnits: { type: String, required: true },
  charityIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Charity' }],
  recipientWallet: { type: String, required: true },
  usdcMint: { type: String },
  memo: { type: String, required: true },
  memoHash: { type: String, required: true, index: true },
  signature: { type: String, index: true },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'expired', 'failed'],
    default: 'pending',
    index: true
  },
  verification: {
    checkedAt: Date,
    valid: Boolean,
    error: String
  },
  expiresAt: { type: Date, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
  confirmedAt: Date
});

solanaPaymentIntentSchema.index({ userEmail: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('SolanaPaymentIntent', solanaPaymentIntentSchema);
