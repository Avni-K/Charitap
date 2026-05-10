const express = require('express');
const router = express.Router();
const Charity = require('../models/Charity');
const User = require('../models/User');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const zipGeocoder = require('../services/zip-geocoder');
const embeddingService = require('../services/embedding-service');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SEARCH_STOPWORDS = new Set(['show', 'me', 'find', 'based', 'ngo', 'nonprofit', 'nonprofits', 'charity', 'charities', 'organization', 'organizations', 'org']);

// ---------------------------------------------------------------------------
// GET /api/charities — list all charities (full fields, deduplicated by name)
// ---------------------------------------------------------------------------
router.get('/', optionalAuth, async (req, res) => {
  try {
    // Return all charities with full fields needed by the Charities page
    const charities = await Charity.find()
      .select('name type description zipCode location payoutPreference solanaWalletAddress createdAt')
      .sort({ name: 1 })
      .lean();

    // Deduplicate by name (keep most recent / richest entry)
    const seen = new Map();
    for (const c of charities) {
      const key = c.name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.set(key, c);
      } else {
        // Keep the one with more fields filled in
        const existing = seen.get(key);
        const existingScore = [existing.description, existing.zipCode, existing.location].filter(Boolean).length;
        const newScore = [c.description, c.zipCode, c.location].filter(Boolean).length;
        if (newScore > existingScore) seen.set(key, c);
      }
    }
    const deduped = Array.from(seen.values());

    // If user is logged in and has a location, compute distances
    let userPoint = null;
    if (req.user?.location?.coordinates?.length === 2) {
      userPoint = req.user.location;
    } else if (req.user?.zipCode) {
      userPoint = await zipGeocoder.geocodeZip(req.user.zipCode);
    }

    const userSelectedIds = (req.user?.selectedCharities || []).map(id => id.toString());
    const userLikedIds = (req.user?.likedCharities || []).map(id => id.toString());

    const enriched = deduped.map(charity => {
      const distanceMiles = (userPoint && charity.location)
        ? Number(zipGeocoder.distanceMiles(userPoint, charity.location)?.toFixed(2))
        : null;

      return {
        ...charity,
        distanceMiles,
        isSelected: userSelectedIds.includes(charity._id.toString()),
        isLiked: userLikedIds.includes(charity._id.toString())
      };
    });

    // Sort: local first (by distance), then alphabetical
    enriched.sort((a, b) => {
      if (a.distanceMiles !== null && b.distanceMiles !== null) return a.distanceMiles - b.distanceMiles;
      if (a.distanceMiles !== null) return -1;
      if (b.distanceMiles !== null) return 1;
      return String(a.name).localeCompare(String(b.name));
    });

    res.json({ charities: enriched, count: enriched.length });
  } catch (error) {
    console.error('Get charities error:', error);
    res.status(500).json({ error: 'Error fetching charities' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/charities/search — AI/local/geo charity discovery
// ---------------------------------------------------------------------------
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const {
      q = '',
      zip,
      lat,
      lng,
      radiusMiles = 10,
      limit = 20
    } = req.query;

    const query = String(q || '').trim();
    const resultLimit = Math.min(parseInt(limit, 10) || 20, 50);
    const radius = Math.min(Math.max(Number(radiusMiles) || 10, 1), 100);

    let userPoint = null;
    if (lat !== undefined && lng !== undefined) {
      userPoint = zipGeocoder.pointFromCoordinates(lat, lng);
    } else if (zip) {
      userPoint = await zipGeocoder.geocodeZip(zip);
    } else if (req.user?.location?.coordinates?.length === 2) {
      userPoint = req.user.location;
    }

    let charities = [];
    let mode = 'keyword';

    // Atlas Vector Search path (if enabled + index exists)
    if (query && process.env.ATLAS_VECTOR_SEARCH_ENABLED === 'true') {
      try {
        const queryVector = await embeddingService.embedText(query);
        if (queryVector) {
          mode = 'vector';
          charities = await Charity.aggregate([
            {
              $vectorSearch: {
                index: process.env.ATLAS_VECTOR_SEARCH_INDEX || 'charity_vector_index',
                path: 'embedding',
                queryVector,
                numCandidates: Math.max(resultLimit * 20, 100),
                limit: resultLimit
              }
            },
            {
              $project: {
                name: 1, description: 1, type: 1, zipCode: 1, location: 1,
                payoutPreference: 1, solanaWalletAddress: 1,
                score: { $meta: 'vectorSearchScore' }
              }
            }
          ]);
        }
      } catch (vectorError) {
        console.warn('[CharitySearch] Vector Search failed; falling back to keyword:', vectorError.message);
      }
    }

    // Keyword fallback with local cosine similarity scoring
    if (!charities.length && query) {
      mode = 'keyword';
      const cleanQuery = query.toLowerCase().trim();
      const rawTerms = cleanQuery
        .split(/\s+/)
        .map(t => t.replace(/[^a-z0-9&]+/g, ''))
        .filter(t => t.length > 2 && !SEARCH_STOPWORDS.has(t));
      const terms = rawTerms.length ? rawTerms.map(escapeRegex) : [escapeRegex(cleanQuery)];
      const regexArray = terms.map(t => new RegExp(t, 'i'));

      let filter = {};
      if (regexArray.length > 0) {
        filter = {
          $or: [
            { name: { $in: regexArray } },
            { type: { $in: regexArray } },
            { description: { $in: regexArray } },
            ...regexArray.map(regex => ({ name: regex })),
            ...regexArray.map(regex => ({ type: regex })),
            ...regexArray.map(regex => ({ description: regex }))
          ]
        };
      }

      const queryVector = await embeddingService.embedText(query);
      let candidates = await Charity.find(filter)
        .select('name description type zipCode location payoutPreference solanaWalletAddress embedding')
        .limit(Math.max(resultLimit * 4, 100))
        .lean();

      if (!candidates.length) {
        candidates = await Charity.find()
          .select('name description type zipCode location payoutPreference solanaWalletAddress embedding')
          .limit(Math.max(resultLimit * 4, 100))
          .lean();
      }

      charities = candidates.map(charity => {
        const textContent = `${charity.name} ${charity.type} ${charity.description}`.toLowerCase();
        const matches = terms.filter(t => textContent.includes(t.toLowerCase())).length;
        const textScore = matches / Math.max(terms.length, 1);

        return {
          ...charity,
          score: queryVector && charity.embedding
            ? Number(embeddingService.cosineSimilarity(queryVector, charity.embedding).toFixed(4))
            : textScore
        };
      });
    }

    // Pure geo search (no text query)
    if (!charities.length && !query && userPoint) {
      mode = 'geo';
      charities = await Charity.aggregate([
        {
          $geoNear: {
            near: userPoint,
            distanceField: 'distanceMeters',
            maxDistance: radius * 1609.344,
            spherical: true
          }
        },
        { $limit: resultLimit },
        {
          $project: {
            name: 1, description: 1, type: 1, zipCode: 1, location: 1,
            payoutPreference: 1, solanaWalletAddress: 1, distanceMeters: 1
          }
        }
      ]);
    }

    // Final fallback: return all
    if (!charities.length && !query && !userPoint) {
      charities = await Charity.find()
        .select('name description type zipCode location payoutPreference solanaWalletAddress')
        .sort({ name: 1 })
        .limit(resultLimit)
        .lean();
    }

    const userSelectedIds = (req.user?.selectedCharities || []).map(id => id.toString());
    const userLikedIds = (req.user?.likedCharities || []).map(id => id.toString());

    const enriched = charities
      .map(charity => {
        const { embedding, ...publicCharity } = charity;
        const distanceMiles = userPoint && charity.location
          ? zipGeocoder.distanceMiles(userPoint, charity.location)
          : null;
        return {
          ...publicCharity,
          distanceMiles: distanceMiles === null ? null : Number(distanceMiles.toFixed(2)),
          localScore: distanceMiles === null ? null : Math.max(0, 1 - distanceMiles / radius),
          isSelected: userSelectedIds.includes(charity._id?.toString()),
          isLiked: userLikedIds.includes(charity._id?.toString())
        };
      })
      .filter(charity => charity.distanceMiles === null || charity.distanceMiles <= radius || query)
      .sort((a, b) => {
        const aScore = (a.score || 0) + (a.localScore || 0);
        const bScore = (b.score || 0) + (b.localScore || 0);
        return bScore - aScore || String(a.name).localeCompare(String(b.name));
      })
      .slice(0, resultLimit);

    res.json({
      charities: enriched,
      count: enriched.length,
      mode,
      radiusMiles: radius,
      hasLocation: Boolean(userPoint)
    });
  } catch (error) {
    console.error('Search charities error:', error);
    res.status(500).json({ error: 'Error searching charities' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/charities/:id/like — toggle like/unlike a charity
// ---------------------------------------------------------------------------
router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    const charityId = req.params.id;
    const charity = await Charity.findById(charityId);
    if (!charity) return res.status(404).json({ error: 'Charity not found' });

    const user = req.user;
    if (!user.likedCharities) user.likedCharities = [];

    const idx = user.likedCharities.findIndex(id => id.toString() === charityId);
    const wasLiked = idx > -1;

    if (wasLiked) {
      user.likedCharities.splice(idx, 1);
    } else {
      user.likedCharities.push(charityId);
    }
    await user.save();

    res.json({
      isLiked: !wasLiked,
      likedCharities: user.likedCharities
    });
  } catch (error) {
    console.error('Like charity error:', error);
    res.status(500).json({ error: 'Error toggling charity like' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/charities/:id/add-to-list — add charity to donation list
// ---------------------------------------------------------------------------
router.post('/:id/add-to-list', authenticateToken, async (req, res) => {
  try {
    const charityId = req.params.id;
    const charity = await Charity.findById(charityId);
    if (!charity) return res.status(404).json({ error: 'Charity not found' });

    const user = req.user;
    const idx = user.selectedCharities.findIndex(id => id.toString() === charityId);

    let action;
    if (idx > -1) {
      // Already in list — remove (toggle behaviour)
      user.selectedCharities.splice(idx, 1);
      action = 'removed';
    } else {
      user.selectedCharities.push(charityId);
      action = 'added';
    }
    await user.save();

    res.json({
      action,
      isSelected: action === 'added',
      selectedCharities: user.selectedCharities,
      charityName: charity.name
    });
  } catch (error) {
    console.error('Add-to-list charity error:', error);
    res.status(500).json({ error: 'Error updating donation list' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/charities/wellspring/summary — Wellspring-specific summary
// ---------------------------------------------------------------------------
router.get('/wellspring/summary', async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    const wellspring = await Charity.findOne({ name: /Wellspring/i });

    if (!wellspring) {
      return res.json({ totalCollected: 0, transactionCount: 0, latestDonationAt: null });
    }

    const transactions = await Transaction.find({ charity: wellspring._id });
    const totalCollected = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const latestDonation = transactions.length > 0 ? transactions.sort((a, b) => b.timestamp - a.timestamp)[0].timestamp : null;

    res.json({
      totalCollected,
      transactionCount: transactions.length,
      latestDonationAt: latestDonation
    });
  } catch (error) {
    console.error('Wellspring summary error:', error);
    res.status(500).json({ error: 'Error fetching wellspring summary' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/charities/:id — single charity
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const charity = await Charity.findById(req.params.id)
      .select('name type description zipCode location payoutPreference solanaWalletAddress createdAt')
      .lean();

    if (!charity) return res.status(404).json({ error: 'Charity not found' });
    res.json({ charity });
  } catch (error) {
    console.error('Get charity error:', error);
    res.status(500).json({ error: 'Error fetching charity' });
  }
});

module.exports = router;
