const mongoose = require('mongoose');

const charityApplicationSchema = new mongoose.Schema({
  // Nomination info
  nominatedBy: { 
    type: String, 
    required: true 
  }, // User email who suggested
  
  // Basic charity info
  charityName: { 
    type: String, 
    required: true 
  },
  charityEmail: { 
    type: String, 
    required: true,
    lowercase: true,
    trim: true
  },
  website: {
    type: String,
    trim: true
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
      type: [Number],
      default: undefined
    }
  },
  description: {
    type: String
  },
  category: { 
    type: String,
    enum: ['Environment', 'Education', 'Health', 'Animals', 'Human Rights', 'Poverty', 'Arts & Culture', 'Other'],
    default: 'Other'
  },
  
  // Contact info
  contactName: { 
    type: String 
  },
  contactPhone: { 
    type: String 
  },
  
  // Legal
  ein: { 
    type: String // Tax ID / EIN
  },
  registrationNumber: { 
    type: String 
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected'],
    default: 'pending'
  },
  
  // Stripe (added by admin manually)
  stripeAccountId: { 
    type: String 
  },
  stripeOnboardingComplete: {
    type: Boolean,
    default: false
  },
  solanaWalletAddress: {
    type: String,
    trim: true
  },
  payoutPreference: {
    type: String,
    enum: ['usd', 'usdc', 'either'],
    default: 'usd'
  },
  
  // Admin review
  reviewedAt: { 
    type: Date 
  },
  reviewedBy: { 
    type: String // Admin email
  },
  approvedAt: { 
    type: Date 
  },
  rejectionReason: { 
    type: String 
  },
  adminNotes: { 
    type: String 
  },
  
  // Timestamps
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Update the updatedAt timestamp before saving
charityApplicationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for performance
charityApplicationSchema.index({ charityEmail: 1 });
charityApplicationSchema.index({ status: 1 });
charityApplicationSchema.index({ createdAt: -1 });
charityApplicationSchema.index({ nominatedBy: 1 });
charityApplicationSchema.index({ location: '2dsphere' }, { sparse: true });

module.exports = mongoose.model('CharityApplication', charityApplicationSchema);
