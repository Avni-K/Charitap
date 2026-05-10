const mongoose = require('mongoose');

const wellspringInventorySchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  category: { type: String, required: true },
  subCategory: { type: String, default: 'General' },
  currentQuantity: { type: Number, default: 0 },
  unit: { type: String, default: 'pieces' },
  destinationProgram: { type: String, default: 'Unassigned' },
  donor: { type: String, default: 'Anonymous' },
  condition: { type: String, default: 'new' },
  expirationDate: { type: String, default: '' },
  lowStockThreshold: { type: Number, default: 8 },
  status: { type: String, default: 'In Stock' },
  dateAdded: { type: String, required: true },
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WellspringInventory', wellspringInventorySchema);
