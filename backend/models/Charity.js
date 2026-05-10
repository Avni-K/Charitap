const mongoose = require('mongoose');

const charitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  type: { 
    type: String, 
    enum: ['Environment', 'Education', 'Health', 'Animals', 'Human Rights', 'Poverty', 'Arts & Culture', 'Other'],
    default: 'Other'
  },
  stripeAccountId: { type: String },
  solanaWalletAddress: { type: String, trim: true },
  payoutPreference: {
    type: String,
    enum: ['usd', 'usdc', 'either'],
    default: 'usd'
  },
  zipCode: {
    type: String,
    trim: true,
    match: [/^\d{5}$/, 'ZIP code must be 5 digits']
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: undefined
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: undefined
    }
  },
  searchText: { type: String, index: true },
  embedding: {
    type: [Number],
    default: undefined
  },
  createdAt: { type: Date, default: Date.now }
});

charitySchema.pre('validate', function(next) {
  const parts = [this.name, this.type, this.description, this.zipCode].filter(Boolean);
  this.searchText = parts.join(' ').toLowerCase();
  next();
});

charitySchema.index({ location: '2dsphere' }, { sparse: true });

module.exports = mongoose.model('Charity', charitySchema);
