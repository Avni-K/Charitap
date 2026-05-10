const mongoose = require('mongoose');

const wellspringDonationSchema = new mongoose.Schema({
  donorName: { type: String, default: 'Anonymous' },
  dateReceived: { type: String, required: true },
  itemName: { type: String, required: true },
  category: { type: String, required: true },
  subCategory: { type: String, default: 'General' },
  quantity: { type: Number, required: true },
  unit: { type: String, default: 'pieces' },
  condition: { type: String, default: 'new' },
  expirationDate: { type: String, default: '' },
  destinationProgram: { type: String, default: 'Unassigned' },
  status: { type: String, default: 'accepted' },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WellspringDonation', wellspringDonationSchema);
