const mongoose = require('mongoose');

const wellspringDistributionSchema = new mongoose.Schema({
  dateDistributed: { type: String, required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'WellspringInventory', required: true },
  itemName: { type: String, required: true },
  quantityDistributed: { type: Number, required: true },
  program: { type: String, required: true },
  distributedBy: { type: String, required: true },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WellspringDistribution', wellspringDistributionSchema);
