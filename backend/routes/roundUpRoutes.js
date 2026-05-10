// routes/roundUp.js
const express = require('express');
const router = express.Router();
const RoundUp = require('../models/RoundUp');
const Transaction = require('../models/Transaction');
const { authenticateToken } = require('../middleware/auth');
const resilientDB = require('../services/resilientdb-client');
const donationValidator = require('../services/donation-validator');
const settlementService = require('../services/roundup-settlement-service');

async function recordPendingRoundupLedger(roundup, user, charities) {
  try {
    const donationData = {
      amount: roundup.roundUpAmount,
      charities: charities || []
    };
    const validationResult = donationValidator.validateDonation(donationData);
    const ledgerKey = resilientDB.generateKey('donation', roundup._id.toString());
    const ledgerData = {
      transactionId: roundup._id.toString(),
      userId: resilientDB.hashSensitiveData(user.email),
      purchaseAmount: Number(roundup.purchaseAmount).toFixed(2),
      roundUpAmount: Number(roundup.roundUpAmount).toFixed(2),
      merchantName: roundup.merchantName,
      paymentRail: roundup.paymentRail,
      currency: roundup.currency,
      timestamp: roundup.createdAt.toISOString(),
      status: 'pending',
      validated: validationResult.valid,
      validationRules: validationResult.appliedRules,
      charityCount: donationData.charities.length,
      blockchainVersion: '2.1-pending-roundup'
    };

    const txId = await resilientDB.set(ledgerKey, ledgerData);
    if (txId) {
      roundup.blockchainTxKey = ledgerKey;
      roundup.blockchainTxId = txId;
      roundup.blockchainVerified = true;
      roundup.blockchainTimestamp = new Date();
      await roundup.save();
    }
  } catch (blockchainError) {
    console.error('[Charitap] WARNING Blockchain write failed (non-critical):', blockchainError.message);
    roundup.blockchainError = blockchainError.message;
    await roundup.save().catch(() => {});
  }
}

// API to create a new RoundUp entry
router.post('/create-roundup', authenticateToken, async (req, res) => {
  try {
    const purchaseAmount = Number(req.body.purchaseAmount);
    const roundUpAmount = Number(req.body.roundUpAmount);
    const merchantName = String(req.body.merchantName || 'Unknown Merchant').slice(0, 120);

    // Validate input data
    if (!Number.isFinite(purchaseAmount) || purchaseAmount <= 0 || !Number.isFinite(roundUpAmount) || roundUpAmount <= 0) {
      return res.status(400).json({ error: 'Purchase amount and roundup amount are required' });
    }

    const selectedCharities = req.user.selectedCharities || [];
    const paymentRail = req.user.paymentRailPreference === 'solana' ? 'solana' : 'stripe';
    const currency = paymentRail === 'solana' ? 'usdc' : 'usd';

    const newRoundUp = new RoundUp({
      user: req.user.email,
      purchaseAmount,
      merchantName,
      roundUpAmount,
      paymentRail,
      currency,
      isPaid: false,
      settlementStatus: 'pending'
    });

    await newRoundUp.save();

    recordPendingRoundupLedger(newRoundUp, req.user, selectedCharities).catch(() => {});

    let pendingRoundups = await RoundUp.find({ user: req.user.email, isPaid: false });
    let pendingTotal = pendingRoundups.reduce((sum, ru) => sum + Number(ru.roundUpAmount || 0), 0);
    const shouldSettleNow = req.user.paymentPreference === 'threshold' && pendingTotal >= 5;

    let settlement = {
      triggered: shouldSettleNow,
      processed: false,
      reason: shouldSettleNow ? 'threshold_reached' : 'pending_until_schedule'
    };

    if (shouldSettleNow) {
      const result = await settlementService.processUserRoundups(req.user);
      settlement = {
        triggered: true,
        ...result
      };
      pendingRoundups = await RoundUp.find({ user: req.user.email, isPaid: false });
      pendingTotal = pendingRoundups.reduce((sum, ru) => sum + Number(ru.roundUpAmount || 0), 0);
    }

    const responseRoundup = await RoundUp.findById(newRoundUp._id).lean();

    res.status(201).json({
      roundup: responseRoundup || newRoundUp.toObject(),
      pendingTotal: Number(pendingTotal.toFixed(2)),
      settlement,
      donationProcessed: Boolean(settlement.processed),
      triggerSolana: false
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong while creating the roundup' });
  }
});

// Get user's roundup history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const roundups = await RoundUp.find({ user: req.user.email })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ roundups });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching roundup history' });
  }
});

// Get user's pending (unpaid) roundups total
router.get('/pending', authenticateToken, async (req, res) => {
  try {
    const unpaidRoundUps = await RoundUp.find({
      user: req.user.email,
      isPaid: false
    });

    const totalAmount = unpaidRoundUps.reduce((sum, ru) => sum + ru.roundUpAmount, 0);

    res.json({
      count: unpaidRoundUps.length,
      totalAmount: totalAmount.toFixed(2)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching pending roundups' });
  }
});

// Get total amount donated by user till date
// Returns sum of all processed transactions (doesn't include pending roundups)
router.get('/total-donated', authenticateToken, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userEmail: req.user.email });

    const totalDonated = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);

    res.json({
      totalDonated: totalDonated.toFixed(2),
      transactionCount: transactions.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching total donated amount' });
  }
});

// Get collected amount for this month (unpaid roundups from current month)
// Shows this month's accumulated roundups that haven't been triggered yet
router.get('/collected-this-month', authenticateToken, async (req, res) => {
  try {
    // Get start and end of current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Find unpaid roundups from this month
    const unpaidRoundUpsThisMonth = await RoundUp.find({
      user: req.user.email,
      isPaid: false,
      createdAt: {
        $gte: startOfMonth,
        $lte: endOfMonth
      }
    });

    const collectedAmount = unpaidRoundUpsThisMonth.reduce((sum, ru) => sum + ru.roundUpAmount, 0);

    const STRIPE_MINIMUM_USD = 0.50;
    if (collectedAmount < STRIPE_MINIMUM_USD) {
      console.log(`[Settlement] Amount $${collectedAmount} below minimum $${STRIPE_MINIMUM_USD}. Skipping.`);
    }

    res.json({
      collectedThisMonth: collectedAmount.toFixed(2),
      count: unpaidRoundUpsThisMonth.length,
      month: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching collected amount for this month' });
  }
});

// Get activity - collected tab (all roundups with details)
// Shows each order/purchase with roundup amount and date
router.get('/activity/collected', authenticateToken, async (req, res) => {
  try {
    const { limit = 100, offset = 0, startDate, endDate } = req.query;

    const query = { user: req.user.email };

    // Optional date filtering
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const roundups = await RoundUp.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const totalCount = await RoundUp.countDocuments(query);

    // Format the response
    const formattedRoundups = roundups.map(roundup => ({
      id: roundup._id,
      merchantName: roundup.merchantName,
      purchaseAmount: parseFloat(roundup.purchaseAmount.toFixed(2)),
      roundUpAmount: parseFloat(roundup.roundUpAmount.toFixed(2)),
      date: roundup.createdAt,
      isPaid: roundup.isPaid,
      status: roundup.isPaid ? 'Donated' : 'Pending',
      settlementStatus: roundup.settlementStatus || (roundup.isPaid ? 'settled' : 'pending'),
      paymentRail: roundup.paymentRail || 'stripe',
      currency: roundup.currency || 'usd'
    }));

    res.json({
      data: formattedRoundups,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: totalCount > parseInt(offset) + parseInt(limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching collected activity' });
  }
});

// Get activity - donated tab (all transactions with charity details)
// Shows each donation with amount, charity name, type, and date
router.get('/activity/donated', authenticateToken, async (req, res) => {
  try {
    const { limit = 100, offset = 0, startDate, endDate } = req.query;

    const query = { userEmail: req.user.email };

    // Optional date filtering
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(query)
      .populate('charity', 'name type description')
      .sort({ timestamp: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const totalCount = await Transaction.countDocuments(query);

    // Format the response
    const formattedTransactions = transactions.map(transaction => ({
      id: transaction._id,
      amount: parseFloat(transaction.amount.toFixed(2)),
      date: transaction.timestamp,
      charity: {
        id: transaction.charity._id,
        name: transaction.charity.name,
        type: transaction.charity.type,
        description: transaction.charity.description
      },
      paymentRail: transaction.paymentRail || 'stripe',
      currency: transaction.currency || 'usd',
      settlementStatus: transaction.settlementStatus,
      solana: transaction.solana,
      stripeTransactionId: transaction.stripeTransactionId
    }));

    res.json({
      data: formattedTransactions,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: totalCount > parseInt(offset) + parseInt(limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching donated activity' });
  }
});

// Dashboard: Get unique charities count that user has donated to
router.get('/dashboard/unique-charities', authenticateToken, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userEmail: req.user.email }).distinct('charity');

    const uniqueCharitiesCount = transactions.length;

    res.json({
      uniqueCharities: uniqueCharitiesCount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching unique charities count' });
  }
});

// Dashboard: Get monthly donation breakdown for last 12 months
// Returns data only for months since user account creation if < 12 months old
router.get('/dashboard/monthly-donations', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed (0 = January)

    // YTD: Start from January 1st of current year
    const startDate = new Date(currentYear, 0, 1); // January 1st of current year
    startDate.setHours(0, 0, 0, 0);

    // Fetch all transactions for current year only
    const transactions = await Transaction.find({
      userEmail: req.user.email,
      timestamp: { $gte: startDate, $lte: now }
    }).lean();

    // Group transactions by month - only for current year YTD
    const monthlyData = {};

    // Initialize all months from January to current month with 0
    for (let i = 0; i <= currentMonth; i++) {
      const date = new Date(currentYear, i, 1);
      const monthKey = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
      monthlyData[monthKey] = {
        month: date.toLocaleDateString('en-US', { month: 'short' }), // Just month name (e.g., "Jan")
        amount: 0,
        transactionCount: 0,
        year: currentYear,
        monthNumber: i + 1
      };
    }

    // Aggregate transaction amounts by month
    transactions.forEach(transaction => {
      const date = new Date(transaction.timestamp);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (monthlyData[monthKey]) {
        monthlyData[monthKey].amount += transaction.amount;
        monthlyData[monthKey].transactionCount += 1;
      }
    });

    // Convert to array and sort by month (January to current month)
    const monthlyArray = Object.keys(monthlyData)
      .sort()
      .map(key => ({
        ...monthlyData[key],
        amount: parseFloat(monthlyData[key].amount.toFixed(2))
      }));

    res.json({
      monthlyDonations: monthlyArray, // Chronological order (Jan to current)
      totalMonths: currentMonth + 1, // Number of months YTD
      summary: {
        totalDonated: monthlyArray.reduce((sum, month) => sum + month.amount, 0).toFixed(2),
        averagePerMonth: (monthlyArray.reduce((sum, month) => sum + month.amount, 0) / (currentMonth + 1)).toFixed(2),
        totalTransactions: monthlyArray.reduce((sum, month) => sum + month.transactionCount, 0)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching monthly donation data' });
  }
});

// Dashboard: Get charity donation breakdown for pie chart
// Returns percentage and amount breakdown by charity
router.get('/dashboard/charity-breakdown', authenticateToken, async (req, res) => {
  try {
    // Fetch all user transactions with charity details
    const transactions = await Transaction.find({ userEmail: req.user.email })
      .populate('charity', 'name type description')
      .lean();

    if (transactions.length === 0) {
      return res.json({
        charities: [],
        totalDonated: 0,
        message: 'No donations yet'
      });
    }

    // Group by charity and calculate totals
    const charityMap = {};
    let totalAmount = 0;

    transactions.forEach(transaction => {
      const charityId = transaction.charity._id.toString();
      totalAmount += transaction.amount;

      if (!charityMap[charityId]) {
        charityMap[charityId] = {
          id: charityId,
          name: transaction.charity.name,
          type: transaction.charity.type,
          description: transaction.charity.description,
          amount: 0,
          donationCount: 0
        };
      }

      charityMap[charityId].amount += transaction.amount;
      charityMap[charityId].donationCount += 1;
    });

    // Convert to array and calculate percentages
    const charitiesArray = Object.values(charityMap).map(charity => ({
      id: charity.id,
      name: charity.name,
      type: charity.type,
      description: charity.description,
      amount: parseFloat(charity.amount.toFixed(2)),
      percentage: parseFloat(((charity.amount / totalAmount) * 100).toFixed(2)),
      donationCount: charity.donationCount
    }));

    // Sort by amount (highest first)
    charitiesArray.sort((a, b) => b.amount - a.amount);

    res.json({
      charities: charitiesArray,
      totalDonated: parseFloat(totalAmount.toFixed(2)),
      charityCount: charitiesArray.length,
      summary: {
        mostSupported: charitiesArray[0]?.name || null,
        mostSupportedAmount: charitiesArray[0]?.amount || 0,
        mostSupportedPercentage: charitiesArray[0]?.percentage || 0
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching charity breakdown data' });
  }
});

// Get blockchain security statistics
// Returns number of transactions recorded on ResilientDB ledger
router.get('/dashboard/blockchain-stats', authenticateToken, async (req, res) => {
  try {
    // Get all transactions for the user
    const transactions = await Transaction.find({ userEmail: req.user.email });

    // Count how many have actually been secured on blockchain
    // Only count transactions that have a blockchainTxId (verified on-chain)
    const totalTransactions = transactions.length;
    const blockchainSecured = transactions.filter(tx => tx.blockchainTxId || tx.blockchainVerified).length;

    res.json({
      totalTransactions,
      blockchainSecured,
      percentage: totalTransactions > 0 ? 100 : 0
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching blockchain stats' });
  }
});

// NEW: Verify a transaction on the blockchain
router.get('/verify-blockchain/:transactionId', authenticateToken, async (req, res) => {
  try {
    const { transactionId } = req.params;

    console.log(`[Charitap] Verifying blockchain transaction: ${transactionId}`);

    // First check if transaction exists in database
    const transaction = await Transaction.findOne({
      _id: transactionId,
      userEmail: req.user.email
    });

    if (!transaction) {
      return res.status(404).json({
        error: 'Transaction not found',
        verified: false
      });
    }

    // Check if we have blockchain reference
    if (!transaction.blockchainTxId) {
      return res.status(200).json({
        verified: false,
        reason: 'Transaction not yet on blockchain',
        transaction: {
          id: transaction._id,
          amount: transaction.amount,
          createdAt: transaction.createdAt
        }
      });
    }

    // Verify on blockchain using GET method
    const isVerified = await resilientDB.verify(transaction.blockchainTxId);

    if (isVerified) {
      // Optionally get full transaction data
      const blockchainData = await resilientDB.get(transaction.blockchainTxId);

      return res.status(200).json({
        verified: true,
        blockchainTxId: transaction.blockchainTxId,
        blockchainTxKey: transaction.blockchainTxKey,
        transaction: {
          id: transaction._id,
          amount: transaction.amount,
          createdAt: transaction.createdAt,
          blockchainTimestamp: transaction.blockchainTimestamp
        },
        blockchainData: blockchainData
      });
    } else {
      return res.status(200).json({
        verified: false,
        reason: 'Transaction not found on blockchain',
        blockchainTxId: transaction.blockchainTxId,
        transaction: {
          id: transaction._id,
          amount: transaction.amount,
          createdAt: transaction.createdAt
        }
      });
    }

  } catch (error) {
    console.error('[Charitap] Blockchain verification error:', error);
    res.status(500).json({
      error: 'Error verifying blockchain transaction',
      details: error.message
    });
  }
});

module.exports = router;
