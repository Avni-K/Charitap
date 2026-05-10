const express = require('express');
const Transaction = require('../models/Transaction');
const RoundUp = require('../models/RoundUp');
const Charity = require('../models/Charity');

const router = express.Router();

router.get('/public-summary', async (req, res) => {
  try {
    const [
      transactionSummary,
      railSummary,
      charitySummary,
      pendingRoundups,
      charityCount
    ] = await Promise.all([
      Transaction.aggregate([
        { $match: { settlementStatus: 'settled' } },
        {
          $group: {
            _id: null,
            totalCents: { $sum: '$amountCents' },
            transactionCount: { $sum: 1 },
            solanaSecured: {
              $sum: {
                $cond: [{ $ifNull: ['$solana.receiptId', false] }, 1, 0]
              }
            },
            resilientSecured: {
              $sum: {
                $cond: ['$blockchainVerified', 1, 0]
              }
            }
          }
        }
      ]),
      Transaction.aggregate([
        { $match: { settlementStatus: 'settled' } },
        {
          $group: {
            _id: { paymentRail: '$paymentRail', currency: '$currency' },
            totalCents: { $sum: '$amountCents' },
            count: { $sum: 1 }
          }
        }
      ]),
      Transaction.aggregate([
        { $match: { settlementStatus: 'settled' } },
        {
          $group: {
            _id: '$charity',
            totalCents: { $sum: '$amountCents' },
            count: { $sum: 1 }
          }
        },
        { $sort: { totalCents: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'charities',
            localField: '_id',
            foreignField: '_id',
            as: 'charity'
          }
        },
        { $unwind: '$charity' },
        {
          $project: {
            _id: 0,
            charityId: '$_id',
            name: '$charity.name',
            type: '$charity.type',
            totalCents: 1,
            count: 1
          }
        }
      ]),
      RoundUp.aggregate([
        { $match: { isPaid: false } },
        {
          $group: {
            _id: null,
            totalCents: { $sum: '$amountCents' },
            count: { $sum: 1 }
          }
        }
      ]),
      Charity.countDocuments()
    ]);

    const summary = transactionSummary[0] || {
      totalCents: 0,
      transactionCount: 0,
      solanaSecured: 0,
      resilientSecured: 0
    };

    res.json({
      totals: {
        donatedCents: summary.totalCents || 0,
        donatedDollars: Number(((summary.totalCents || 0) / 100).toFixed(2)),
        transactionCount: summary.transactionCount || 0,
        solanaSecured: summary.solanaSecured || 0,
        resilientSecured: summary.resilientSecured || 0,
        pendingRoundupCents: pendingRoundups[0]?.totalCents || 0,
        pendingRoundupCount: pendingRoundups[0]?.count || 0,
        charityCount
      },
      rails: railSummary.map(item => ({
        paymentRail: item._id.paymentRail || 'stripe',
        currency: item._id.currency || 'usd',
        totalCents: item.totalCents,
        donatedDollars: Number((item.totalCents / 100).toFixed(2)),
        count: item.count
      })),
      charities: charitySummary.map(item => ({
        ...item,
        donatedDollars: Number((item.totalCents / 100).toFixed(2))
      })),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Impact] public summary error:', error);
    res.status(500).json({ error: 'Failed to fetch impact summary' });
  }
});

module.exports = router;
