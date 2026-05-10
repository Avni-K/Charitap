const express = require('express');
const router = express.Router();
const WellspringInventory = require('../models/WellspringInventory');
const WellspringDonation = require('../models/WellspringDonation');
const WellspringDistribution = require('../models/WellspringDistribution');
const { authenticateToken } = require('../middleware/auth');
const { requireWellspringAdmin } = require('../utils/accessControl');
const { sendLowStockAlert } = require('../services/emailService');

router.use(authenticateToken, requireWellspringAdmin);

// Seeding logic (internal)
async function seedWellspringData() {
  // Ensure Wellspring charity exists in main Charity collection
  const Charity = require('../models/Charity');
  let wellspringCharity = await Charity.findOne({ name: /Wellspring/i });
  if (!wellspringCharity) {
    wellspringCharity = new Charity({
      name: "Wellspring Women's Center",
      type: "Other",
      description: "Providing a safe space, meals, wellness resources, creative programs, and support for women and children in Sacramento.",
      zipCode: "95817",
      payoutPreference: "usd",
      solanaWalletAddress: ""
    });
    await wellspringCharity.save();
    console.log('[Wellspring] Seeded main charity entry.');
  }

  const inventoryCount = await WellspringInventory.countDocuments();
  if (inventoryCount === 0) {
    console.log('[Wellspring] Seeding initial inventory data...');

    const initialInventory = [
      { itemName: 'Adult Meal Kits', category: 'Adult Meal', subCategory: 'Prepared Meal Kits', currentQuantity: 28, unit: 'kits', destinationProgram: 'Nutritious Meals Program', donor: 'Meals on Wheels Circle', condition: 'new', expirationDate: '2026-06-20', lowStockThreshold: 8, status: 'In Stock', dateAdded: '2026-05-03' },
      { itemName: 'Kids Meal Packs', category: 'Kids Meal', subCategory: 'Kids Meal Kits', currentQuantity: 18, unit: 'packs', destinationProgram: "Children's Corner", donor: 'Family Nutrition Fund', condition: 'new', expirationDate: '2026-06-22', lowStockThreshold: 8, status: 'In Stock', dateAdded: '2026-05-04' },
      { itemName: 'Greek Yogurt Cups', category: 'Food & Beverages', subCategory: 'Yogurt', currentQuantity: 45, unit: 'pieces', destinationProgram: 'Nutritious Meals Program', donor: 'Community Foods Co-op', condition: 'good', expirationDate: '2026-05-20', lowStockThreshold: 8, status: 'In Stock', dateAdded: '2026-05-06' },
      { itemName: 'Shampoo Bottles', category: 'Hygiene & Toiletries', subCategory: 'Shampoo', currentQuantity: 8, unit: 'pieces', destinationProgram: "Women's Wellness / Safety Net Services", donor: 'Community Church', condition: 'new', expirationDate: '', lowStockThreshold: 8, status: 'Low', dateAdded: '2026-05-07' },
      { itemName: 'Pampers Size 4', category: 'Medical & Care Supplies', subCategory: 'Disposable Diapers', currentQuantity: 24, unit: 'packs', destinationProgram: "Children's Corner", donor: 'Sarah Johnson', condition: 'new', expirationDate: '', lowStockThreshold: 8, status: 'In Stock', dateAdded: '2026-05-08' },
      { itemName: 'Ground Coffee Bags', category: 'Food & Beverages', subCategory: 'Ground Coffee', currentQuantity: 18, unit: 'bags', destinationProgram: 'Nutritious Meals Program', donor: 'Coffee Roasters Inc', condition: 'new', expirationDate: '2026-11-30', lowStockThreshold: 8, status: 'In Stock', dateAdded: '2026-05-07' },
      { itemName: 'Sanitary Pads', category: 'Menstrual Care', subCategory: 'Menstrual Pads', currentQuantity: 40, unit: 'packs', destinationProgram: "Women's Wellness / Safety Net Services", donor: 'Anonymous', condition: 'new', expirationDate: '', lowStockThreshold: 8, status: 'In Stock', dateAdded: '2026-05-09' },
      { itemName: 'Baby Formula', category: 'Food & Beverages', subCategory: 'Baby Formula', currentQuantity: 3, unit: 'cans', destinationProgram: "Children's Corner", donor: 'Local Grocery', condition: 'new', expirationDate: '2026-08-15', lowStockThreshold: 8, status: 'Low', dateAdded: '2026-05-09' },
      { itemName: 'Gas Station Gift Cards', category: 'Gift Cards & Transportation', subCategory: 'Gas Cards', currentQuantity: 0, unit: 'cards', destinationProgram: "Women's Wellness / Safety Net Services", donor: 'Transit Authority', condition: 'new', expirationDate: '', lowStockThreshold: 8, status: 'Out', dateAdded: '2026-04-28' },
      { itemName: 'Multicolor Yarn Set', category: 'Art & Creative Supplies', subCategory: 'Yarn', currentQuantity: 5, unit: 'sets', destinationProgram: 'Art of Being Program', donor: 'Anonymous', condition: 'good', expirationDate: '', lowStockThreshold: 8, status: 'Low', dateAdded: '2026-05-05' },
      { itemName: 'Watercolor Paper Pads', category: 'Art & Creative Supplies', subCategory: 'Watercolor Paper', currentQuantity: 15, unit: 'pads', destinationProgram: 'Art of Being Program', donor: 'Local Artist', condition: 'new', expirationDate: '', lowStockThreshold: 8, status: 'In Stock', dateAdded: '2026-05-10' },
      { itemName: 'Adult Toothbrushes', category: 'Dental Care', subCategory: 'Toothbrushes', currentQuantity: 50, unit: 'pieces', destinationProgram: "Women's Wellness / Safety Net Services", donor: 'Anonymous', condition: 'new', expirationDate: '', lowStockThreshold: 8, status: 'In Stock', dateAdded: '2026-05-09' },
      { itemName: 'Baby Bottles Set', category: 'Baby Care', subCategory: 'Baby Bottles', currentQuantity: 6, unit: 'sets', destinationProgram: "Children's Corner", donor: 'Anonymous', condition: 'new', expirationDate: '', lowStockThreshold: 8, status: 'Low', dateAdded: '2026-05-08' },
      { itemName: 'Paper Towel Rolls', category: 'Kitchen & Dining Supplies', subCategory: 'Paper Towels', currentQuantity: 60, unit: 'rolls', destinationProgram: 'Nutritious Meals Program', donor: 'Wholesale Club', condition: 'new', expirationDate: '', lowStockThreshold: 8, status: 'In Stock', dateAdded: '2026-05-10' },
      { itemName: "Women's Underwear Packs", category: 'Clothing & Apparel', subCategory: "Women's Underwear", currentQuantity: 10, unit: 'packs', destinationProgram: "Women's Wellness / Safety Net Services", donor: 'Fashion Donor', condition: 'new', expirationDate: '', lowStockThreshold: 8, status: 'In Stock', dateAdded: '2026-05-06' },
      { itemName: 'Tea Box Collection', category: 'Food & Beverages', subCategory: 'Tea', currentQuantity: 20, unit: 'boxes', destinationProgram: 'Nutritious Meals Program', donor: 'Garden Teas', condition: 'good', expirationDate: '2026-10-12', lowStockThreshold: 8, status: 'In Stock', dateAdded: '2026-05-04' },
      { itemName: 'Baby Wash Bottles', category: 'Baby Care', subCategory: 'Baby Wash', currentQuantity: 12, unit: 'bottles', destinationProgram: "Children's Corner", donor: 'Moms Network', condition: 'new', expirationDate: '', lowStockThreshold: 8, status: 'In Stock', dateAdded: '2026-05-03' }
    ];

    await WellspringInventory.insertMany(initialInventory);
    console.log('[Wellspring] Seeding complete.');
  }

  const inventoryDocs = await WellspringInventory.find();
  const inventoryByName = new Map(inventoryDocs.map((item) => [item.itemName, item]));

  const donationCount = await WellspringDonation.countDocuments();
  if (donationCount === 0) {
    console.log('[Wellspring] Seeding initial donation data...');

    const initialDonations = [
      { donorName: 'Meals on Wheels Circle', dateReceived: '2026-05-05', itemName: 'Adult Meal Kits', category: 'Adult Meal', subCategory: 'Prepared Meal Kits', quantity: 14, unit: 'kits', condition: 'new', expirationDate: '2026-06-20', destinationProgram: 'Nutritious Meals Program', notes: 'Warm meal support for seniors.' },
      { donorName: 'Family Nutrition Fund', dateReceived: '2026-05-06', itemName: 'Kids Meal Packs', category: 'Kids Meal', subCategory: 'Kids Meal Kits', quantity: 10, unit: 'packs', condition: 'new', expirationDate: '2026-06-22', destinationProgram: "Children's Corner", notes: 'Child nutrition support.' },
      { donorName: 'Community Foods Co-op', dateReceived: '2026-05-06', itemName: 'Greek Yogurt Cups', category: 'Food & Beverages', subCategory: 'Yogurt', quantity: 18, unit: 'pieces', condition: 'good', expirationDate: '2026-05-20', destinationProgram: 'Nutritious Meals Program', notes: 'Bulk breakfast support.' },
      { donorName: 'Bridge Resource Bank', dateReceived: '2026-05-07', itemName: 'Monetary Donation', category: 'Money', subCategory: 'General', quantity: 250, unit: 'usd', condition: 'new', expirationDate: '', destinationProgram: 'Unassigned', notes: 'Flexible support for direct need.' },
      { donorName: 'Grace Fellowship', dateReceived: '2026-05-07', itemName: 'Shampoo Bottles', category: 'Hygiene & Toiletries', subCategory: 'Shampoo', quantity: 12, unit: 'pieces', condition: 'new', expirationDate: '', destinationProgram: "Women's Wellness / Safety Net Services", notes: 'Wellness care kits.' },
      { donorName: 'Art Friends Collective', dateReceived: '2026-05-08', itemName: 'Watercolor Paper Pads', category: 'Art & Creative Supplies', subCategory: 'Watercolor Paper', quantity: 9, unit: 'pads', condition: 'new', expirationDate: '', destinationProgram: 'Art of Being Program', notes: 'Creative workshop supplies.' },
      { donorName: 'Northside Family Network', dateReceived: '2026-05-09', itemName: 'Baby Bottles Set', category: 'Baby Care', subCategory: 'Baby Bottles', quantity: 6, unit: 'sets', condition: 'new', expirationDate: '', destinationProgram: "Children's Corner", notes: 'Children and infant pantry support.' },
      { donorName: 'Fresh Market Co-op', dateReceived: '2026-05-10', itemName: 'Paper Towel Rolls', category: 'Kitchen & Dining Supplies', subCategory: 'Paper Towels', quantity: 20, unit: 'rolls', condition: 'new', expirationDate: '', destinationProgram: 'Nutritious Meals Program', notes: 'Kitchen replenishment.' },
      { donorName: 'Wellness Supply Fund', dateReceived: '2026-05-11', itemName: 'Adult Toothbrushes', category: 'Dental Care', subCategory: 'Toothbrushes', quantity: 22, unit: 'pieces', condition: 'new', expirationDate: '', destinationProgram: "Women's Wellness / Safety Net Services", notes: 'Hygiene packs.' },
      { donorName: 'Lumen Arts Studio', dateReceived: '2026-05-12', itemName: 'Multicolor Yarn Set', category: 'Art & Creative Supplies', subCategory: 'Yarn', quantity: 7, unit: 'sets', condition: 'good', expirationDate: '', destinationProgram: 'Art of Being Program', notes: 'Fiber arts class.' },
      { donorName: 'Little Steps Foundation', dateReceived: '2026-05-13', itemName: 'Baby Formula', category: 'Food & Beverages', subCategory: 'Baby Formula', quantity: 5, unit: 'cans', condition: 'new', expirationDate: '2026-08-15', destinationProgram: "Children's Corner", notes: 'Infant nutrition support.' }
    ];

    await WellspringDonation.insertMany(initialDonations);
  }

  const distributionCount = await WellspringDistribution.countDocuments();
  if (distributionCount === 0) {
    console.log('[Wellspring] Seeding initial distribution data...');

    const distributionSeeds = [
      { dateDistributed: '2026-05-10', itemName: 'Adult Meal Kits', quantityDistributed: 8, program: 'Nutritious Meals Program', distributedBy: 'Maya Patel' },
      { dateDistributed: '2026-05-10', itemName: 'Kids Meal Packs', quantityDistributed: 4, program: "Children's Corner", distributedBy: 'Jordan Lee' },
      { dateDistributed: '2026-05-11', itemName: 'Greek Yogurt Cups', quantityDistributed: 10, program: 'Nutritious Meals Program', distributedBy: 'Maya Patel' },
      { dateDistributed: '2026-05-11', itemName: 'Shampoo Bottles', quantityDistributed: 4, program: "Women's Wellness / Safety Net Services", distributedBy: 'Jordan Lee' },
      { dateDistributed: '2026-05-12', itemName: 'Watercolor Paper Pads', quantityDistributed: 3, program: 'Art of Being Program', distributedBy: 'Avery Gomez' },
      { dateDistributed: '2026-05-12', itemName: 'Baby Bottles Set', quantityDistributed: 2, program: "Children's Corner", distributedBy: 'Casey Nguyen' },
      { dateDistributed: '2026-05-13', itemName: 'Paper Towel Rolls', quantityDistributed: 8, program: 'Nutritious Meals Program', distributedBy: 'Taylor Brooks' },
      { dateDistributed: '2026-05-13', itemName: 'Adult Toothbrushes', quantityDistributed: 6, program: "Women's Wellness / Safety Net Services", distributedBy: 'Riley Chen' },
      { dateDistributed: '2026-05-14', itemName: 'Tea Box Collection', quantityDistributed: 5, program: 'Nutritious Meals Program', distributedBy: 'Morgan Davis' },
      { dateDistributed: '2026-05-14', itemName: 'Baby Wash Bottles', quantityDistributed: 4, program: "Children's Corner", distributedBy: 'Jordan Williams' }
    ];

    const initialDistributions = distributionSeeds
      .map((seed) => {
        const item = inventoryByName.get(seed.itemName);
        if (!item) return null;
        return {
          ...seed,
          itemId: item._id,
          notes: 'Seeded distribution record'
        };
      })
      .filter(Boolean);

    if (initialDistributions.length) {
      await WellspringDistribution.insertMany(initialDistributions);
    }
  }
}

// Run seed on startup
seedWellspringData().catch(err => console.error('[Wellspring] Seed error:', err));

function getItemStatus(quantity, threshold = 8) {
  if (quantity <= 0) return 'Out';
  if (quantity <= threshold) return 'Low';
  return 'In Stock';
}

// Helper for date conversion
function toDateOnly(date) {
  return new Date(date).toISOString().slice(0, 10);
}

// Routes
function serializeInventory(item) {
  const obj = item.toObject ? item.toObject() : item;
  return { ...obj, id: obj._id?.toString() };
}

router.get('/summary', async (req, res) => {
  try {
    const inventory = await WellspringInventory.find();
    const totalInventory = inventory.reduce((sum, item) => sum + item.currentQuantity, 0);
    const lowStockCount = inventory.filter(item => item.currentQuantity <= item.lowStockThreshold).length;
    
    const recentDonations = await WellspringDonation.find().sort({ createdAt: -1 }).limit(5);
    const recentDistributions = await WellspringDistribution.find().sort({ createdAt: -1 }).limit(5);
    
    res.json({ totalInventory, lowStockCount, recentDonations, recentDistributions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/inventory', async (req, res) => {
  try {
    const { search } = req.query;
    let filter = {};
    if (search) {
      filter = {
        $or: [
          { itemName: new RegExp(search, 'i') },
          { category: new RegExp(search, 'i') },
          { subCategory: new RegExp(search, 'i') },
          { donor: new RegExp(search, 'i') }
        ]
      };
    }
    const inventory = await WellspringInventory.find(filter).sort({ lastUpdated: -1 });
    res.json(inventory.map(serializeInventory));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/donations', async (req, res) => {
  try {
    const d = req.body;
    const isMoney = d.category === 'Money';
    const itemName = isMoney ? 'Monetary Donation' : d.itemName;
    const quantity = isMoney ? d.amount : d.quantity;

    const donation = new WellspringDonation({
      ...d,
      itemName,
      quantity,
      dateReceived: d.dateReceived || toDateOnly(new Date())
    });
    await donation.save();

    // Update Inventory
    let item = await WellspringInventory.findOne({ 
      itemName: { $regex: new RegExp(`^${itemName}$`, 'i') },
      category: d.category,
      subCategory: d.subCategory || 'General'
    });

    if (item) {
      item.currentQuantity += quantity;
      item.lastUpdated = new Date();
      item.status = getItemStatus(item.currentQuantity, item.lowStockThreshold);
      await item.save();
    } else if (!isMoney) {
      item = new WellspringInventory({
        itemName,
        category: d.category,
        subCategory: d.subCategory || 'General',
        currentQuantity: quantity,
        unit: d.unit || 'pieces',
        destinationProgram: d.destinationProgram || 'Unassigned',
        donor: d.donorName || 'Anonymous',
        condition: d.condition || 'new',
        expirationDate: d.expirationDate || '',
        dateAdded: donation.dateReceived,
        status: getItemStatus(quantity)
      });
      await item.save();
    }

    res.json({ ok: true, donation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/donations', async (req, res) => {
  try {
    const donations = await WellspringDonation.find().sort({ createdAt: -1 });
    res.json(donations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/distributions', async (req, res) => {
  try {
    const d = req.body;
    const item = await WellspringInventory.findById(d.itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.currentQuantity < d.quantityDistributed) {
      return res.status(400).json({ error: 'Insufficient quantity' });
    }
    const previousStatus = getItemStatus(item.currentQuantity, item.lowStockThreshold);
    const wasLowOrOut = previousStatus === 'Low' || previousStatus === 'Out';
    const distributedBy = req.user.displayName || [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email;

    const distribution = new WellspringDistribution({
      ...d,
      itemName: item.itemName,
      distributedBy,
      dateDistributed: d.dateDistributed || toDateOnly(new Date())
    });
    await distribution.save();

    item.currentQuantity -= d.quantityDistributed;
    item.status = getItemStatus(item.currentQuantity, item.lowStockThreshold);
    item.lastUpdated = new Date();
    await item.save();

    // Nodemailer Alert if low stock
    if (!wasLowOrOut && (item.status === 'Low' || item.status === 'Out')) {
      await sendLowStockAlert(item);
    }

    res.json({ ok: true, distribution });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/distributions', async (req, res) => {
  try {
    const distributions = await WellspringDistribution.find().sort({ createdAt: -1 });
    res.json(distributions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
