// models/RoundUp.js
const mongoose = require('mongoose');

const roundUpSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true
  },
  purchaseAmount: {
    type: Number,
    required: true
  },
  merchantName: {
    type: String,
    default: 'Unknown Merchant'
  },
  roundUpAmount: {
    type: Number,
    required: true
  },
  amountCents: {
    type: Number
  },
  paymentRail: {
    type: String,
    enum: ['stripe', 'solana'],
    default: 'stripe'
  },
  currency: {
    type: String,
    enum: ['usd', 'usdc'],
    default: 'usd'
  },
  usdcBaseUnits: {
    type: String
  },
  settlementStatus: {
    type: String,
    enum: ['pending', 'processing', 'settled', 'failed'],
    default: 'pending'
  },
  conversionStatus: {
    type: String,
    enum: ['not_required', 'pending_provider', 'processing', 'completed', 'failed'],
    default: 'not_required'
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  processingBatchId: {
    type: String,
    index: true
  },
  // Payment tracking (FROM GITHUB - CRITICAL FOR STRIPE INTEGRATION)
  stripePaymentIntentId: {
    type: String
  }, // The charge to the user (batched)
  chargedAt: {
    type: Date
  }, // When user was charged
  processedAt: {
    type: Date
  }, // When transferred to charity

  // Blockchain tracking (NEW - ResilientDB)
  blockchainTxKey: {
    type: String,
    index: true  // For quick lookups on blockchain
  }, // The ledger key used in ResilientDB
  blockchainTxId: {
    type: String
  }, // Transaction ID returned from blockchain
  blockchainVerified: {
    type: Boolean,
    default: false
  }, // Whether successfully written to blockchain
  blockchainTimestamp: {
    type: Date
  }, // When written to blockchain
  blockchainError: {
    type: String
  }, // Error message if blockchain write failed
  solana: {
    enabled: { type: Boolean, default: false },
    signature: { type: String },
    paymentSignature: { type: String },
    receiptSignature: { type: String },
    memo: { type: String },
    memoHash: { type: String },
    receiptId: { type: String },
    receiptPda: { type: String },
    charityTotalPda: { type: String },
    programId: { type: String },
    usdcMint: { type: String },
    verified: { type: Boolean, default: false },
    recordedAt: { type: Date },
    error: { type: String }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

roundUpSchema.pre('validate', function(next) {
  if (this.roundUpAmount !== undefined && this.amountCents === undefined) {
    this.amountCents = Math.round(Number(this.roundUpAmount) * 100);
  }
  next();
});

// Database Indexes for Performance
roundUpSchema.index({ user: 1, createdAt: -1 });
roundUpSchema.index({ blockchainTxId: 1 }, { sparse: true });
roundUpSchema.index({ isPaid: 1, createdAt: -1 });
roundUpSchema.index({ blockchainVerified: 1 });
roundUpSchema.index({ paymentRail: 1, settlementStatus: 1 });
roundUpSchema.index({ 'solana.signature': 1 }, { sparse: true });

module.exports = mongoose.model('RoundUp', roundUpSchema);
