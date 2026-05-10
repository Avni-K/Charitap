/**
 * Dedup + seed script for Charitap charities.
 *
 * Run with: node backend/scripts/dedup-and-seed-charities.js
 *
 * Steps:
 *   1. Remove duplicate charities (same name, case-insensitive — keep one with richest data).
 *   2. Add sample zipCode + location to existing charities that have neither.
 *   3. Set payoutPreference on charities that are missing it.
 *   4. Print a summary.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

const Charity = require('../models/Charity');
const zipGeocoder = require('../services/zip-geocoder');

// Sample ZIP assignments for known charities (Sacramento-area focused)
const ZIP_OVERRIDES = {
  'save water':               '95814',
  'doctors without borders':  '94104', // SF HQ
  'red cross':                '95825',
  'save the children':        '95814',
  'wellspring':               '95616',
  'food bank':                '95811',
  'environment':              '95818',
  'ocean':                    '94105',
  'animal':                   '95822',
  'youth':                    '95820',
  'stem':                     '95618',
};

const PAYOUT_OVERRIDES = {
  'save water':               'usdc',
  'wellspring':               'usdc',
  'food bank':                'usd',
  'red cross':                'usd',
  'save the children':        'usd',
  'doctors without borders':  'either',
};

function matchesKey(name, overrides) {
  const lower = name.toLowerCase();
  return Object.entries(overrides).find(([key]) => lower.includes(key));
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // ─── Step 1: Deduplicate ──────────────────────────────────────────────────
  const all = await Charity.find().lean();
  console.log(`\nFound ${all.length} total charity documents`);

  const byName = new Map();
  for (const c of all) {
    const key = c.name.toLowerCase().trim();
    if (!byName.has(key)) {
      byName.set(key, []);
    }
    byName.get(key).push(c);
  }

  let removedCount = 0;
  for (const [name, docs] of byName.entries()) {
    if (docs.length <= 1) continue;

    // Score each doc by how many useful fields it has
    const scored = docs.map(d => ({
      doc: d,
      score: [d.description, d.zipCode, d.location, d.stripeAccountId].filter(Boolean).length
    })).sort((a, b) => b.score - a.score || (b.doc.createdAt > a.doc.createdAt ? 1 : -1));

    const keeper = scored[0].doc;
    const toDelete = scored.slice(1).map(s => s.doc._id);

    await Charity.deleteMany({ _id: { $in: toDelete } });
    console.log(`  [dedup] Kept "${keeper.name}" (${keeper._id}), removed ${toDelete.length} duplicates`);
    removedCount += toDelete.length;
  }

  console.log(`\n[Dedup] Removed ${removedCount} duplicate documents`);

  // ─── Step 2: Enrich surviving docs ───────────────────────────────────────
  const survivors = await Charity.find();
  let enrichedCount = 0;

  for (const charity of survivors) {
    let changed = false;

    // Add ZIP if missing
    if (!charity.zipCode) {
      const match = matchesKey(charity.name, ZIP_OVERRIDES);
      if (match) {
        charity.zipCode = match[1];
        changed = true;
      }
    }

    // Geocode ZIP to location if location missing
    if (charity.zipCode && !charity.location) {
      const point = await zipGeocoder.geocodeZip(charity.zipCode);
      if (point) {
        charity.location = point;
        changed = true;
      }
    }

    // Set payoutPreference if missing
    if (!charity.payoutPreference || charity.payoutPreference === 'usd') {
      const match = matchesKey(charity.name, PAYOUT_OVERRIDES);
      if (match) {
        charity.payoutPreference = match[1];
        changed = true;
      }
    }

    if (changed) {
      await charity.save();
      enrichedCount++;
      console.log(`  [enrich] ${charity.name} → zip=${charity.zipCode} payout=${charity.payoutPreference}`);
    }
  }

  console.log(`\n[Enrich] Updated ${enrichedCount} charities`);

  // ─── Final report ─────────────────────────────────────────────────────────
  const finalCount = await Charity.countDocuments();
  const withLocation = await Charity.countDocuments({ location: { $exists: true, $ne: null } });
  const withZip = await Charity.countDocuments({ zipCode: { $exists: true, $ne: null } });

  console.log(`\n══════════════════════════════`);
  console.log(`Final charity count : ${finalCount}`);
  console.log(`With location       : ${withLocation}`);
  console.log(`With zipCode        : ${withZip}`);
  console.log(`══════════════════════════════\n`);

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
