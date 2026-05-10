const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  stripeTransactionId: { type: String }, // The transfer to charity
  stripePaymentIntentId: { type: String }, // The charge to user (FROM GITHUB)
  userEmail: { type: String, required: true },
  amount: { type: Number, required: true },
  amountCents: { type: Number },
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
  usdcBaseUnits: { type: String },
  settlementStatus: {
    type: String,
    enum: ['pending', 'processing', 'settled', 'failed'],
    default: 'settled'
  },
  conversionStatus: {
    type: String,
    enum: ['not_required', 'pending_provider', 'processing', 'completed', 'failed'],
    default: 'not_required'
  },
  charity: { type: mongoose.Schema.Types.ObjectId, ref: 'Charity', required: true },
  timestamp: { type: Date, default: Date.now },
  // Blockchain fields
  blockchainTxId: { type: String }, // ResilientDB transaction ID
  blockchainTxKey: { type: String }, // Ledger key (charitap:transaction:{id})
  blockchainVerified: { type: Boolean, default: false },
  blockchainTimestamp: { type: Date },
  blockchainError: { type: String }, // Store any blockchain errors
  // Smart contract receipt (from ResContract DonationReceipt.sol)
  contractReceiptId: { type: String }, // Receipt ID returned by the on-chain contract

  // Solana receipt and memo metadata. This intentionally excludes PII.
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
  }
});

transactionSchema.pre('validate', function(next) {
  if (this.amount !== undefined && this.amountCents === undefined) {
    this.amountCents = Math.round(Number(this.amount) * 100);
  }
  next();
});

transactionSchema.index({ paymentRail: 1, timestamp: -1 });
transactionSchema.index({ 'solana.signature': 1 }, { sparse: true });
transactionSchema.index({ 'solana.receiptId': 1 }, { sparse: true });

module.exports = mongoose.model('Transaction', transactionSchema);
