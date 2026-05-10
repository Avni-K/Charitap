const express = require('express');
const router = express.Router();
const CharityApplication = require('../models/CharityApplication');
const Charity = require('../models/Charity');
const { authenticateToken } = require('../middleware/auth');
const { requireWellspringAdmin } = require('../utils/accessControl');

/**
 * Get all charity applications
 * GET /api/admin/charity-applications
 * Query params: status (pending, under_review, approved, rejected)
 */
router.get('/charity-applications', authenticateToken, requireWellspringAdmin, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    
    const query = {};
    if (status) {
      query.status = status;
    }
    
    const applications = await CharityApplication.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .lean();
    
    const totalCount = await CharityApplication.countDocuments(query);
    
    res.json({
      applications,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: totalCount > parseInt(offset) + parseInt(limit)
      }
    });
  } catch (error) {
    console.error('[Admin] Error fetching applications:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

/**
 * Get single charity application
 * GET /api/admin/charity-applications/:id
 */
router.get('/charity-applications/:id', authenticateToken, requireWellspringAdmin, async (req, res) => {
  try {
    const application = await CharityApplication.findById(req.params.id);
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    res.json({ application });
  } catch (error) {
    console.error('[Admin] Error fetching application:', error);
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

/**
 * Update charity application (for admin notes, status changes, etc.)
 * PATCH /api/admin/charity-applications/:id
 */
router.patch('/charity-applications/:id', authenticateToken, requireWellspringAdmin, async (req, res) => {
  try {
    const { 
      status, 
      stripeAccountId, 
      adminNotes, 
      contactName, 
      contactPhone,
      ein,
      website,
      description,
      zipCode,
      solanaWalletAddress,
      payoutPreference
    } = req.body;
    
    const application = await CharityApplication.findById(req.params.id);
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    // Update fields if provided
    if (status) application.status = status;
    if (stripeAccountId) {
      application.stripeAccountId = stripeAccountId;
      application.stripeOnboardingComplete = true;
    }
    if (adminNotes !== undefined) application.adminNotes = adminNotes;
    if (contactName) application.contactName = contactName;
    if (contactPhone) application.contactPhone = contactPhone;
    if (ein) application.ein = ein;
    if (website) application.website = website;
    if (description) application.description = description;
    if (zipCode) application.zipCode = zipCode;
    if (solanaWalletAddress !== undefined) application.solanaWalletAddress = solanaWalletAddress;
    if (payoutPreference) application.payoutPreference = payoutPreference;
    
    // Track reviewer
    if (status === 'under_review' && !application.reviewedAt) {
      application.reviewedAt = new Date();
      application.reviewedBy = req.user.email;
    }
    
    await application.save();
    
    console.log(`[Admin] Updated application ${req.params.id} by ${req.user.email}`);
    
    res.json({
      message: 'Application updated successfully',
      application
    });
  } catch (error) {
    console.error('[Admin] Error updating application:', error);
    res.status(500).json({ error: 'Failed to update application' });
  }
});

/**
 * Approve charity application and create charity
 * POST /api/admin/charity-applications/:id/approve
 */
router.post('/charity-applications/:id/approve', authenticateToken, requireWellspringAdmin, async (req, res) => {
  try {
    const { stripeAccountId, solanaWalletAddress, payoutPreference } = req.body;
    
    if (!stripeAccountId) {
      return res.status(400).json({ 
        error: 'Stripe Account ID is required to approve charity' 
      });
    }
    
    const application = await CharityApplication.findById(req.params.id);
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    if (application.status === 'approved') {
      return res.status(400).json({ error: 'Application is already approved' });
    }
    
    // Check if charity with this name already exists
    const existingCharity = await Charity.findOne({ 
      name: new RegExp(`^${application.charityName}$`, 'i') 
    });
    
    if (existingCharity) {
      return res.status(400).json({ 
        error: 'A charity with this name already exists in the system' 
      });
    }
    
    // Create the charity
    const newCharity = new Charity({
      name: application.charityName,
      description: application.description || `Supporting ${application.category} causes`,
      type: application.category,
      stripeAccountId,
      solanaWalletAddress: solanaWalletAddress || application.solanaWalletAddress,
      payoutPreference: payoutPreference || application.payoutPreference || 'usd',
      zipCode: application.zipCode,
      location: application.location
    });
    
    await newCharity.save();
    
    // Update application
    application.status = 'approved';
    application.stripeAccountId = stripeAccountId;
    application.stripeOnboardingComplete = true;
    application.approvedAt = new Date();
    application.reviewedBy = req.user.email;
    application.reviewedAt = new Date();
    
    await application.save();
    
    console.log(`[Admin] Approved charity: ${application.charityName} by ${req.user.email}`);
    
    res.json({
      message: 'Charity approved and added to platform!',
      charity: newCharity,
      application
    });
  } catch (error) {
    console.error('[Admin] Error approving application:', error);
    res.status(500).json({ error: 'Failed to approve application' });
  }
});

/**
 * Reject charity application
 * POST /api/admin/charity-applications/:id/reject
 */
router.post('/charity-applications/:id/reject', authenticateToken, requireWellspringAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ 
        error: 'Rejection reason is required' 
      });
    }
    
    const application = await CharityApplication.findById(req.params.id);
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    application.status = 'rejected';
    application.rejectionReason = reason;
    application.reviewedBy = req.user.email;
    application.reviewedAt = new Date();
    
    await application.save();
    
    console.log(`[Admin] Rejected charity: ${application.charityName} by ${req.user.email}`);
    
    res.json({
      message: 'Application rejected',
      application
    });
  } catch (error) {
    console.error('[Admin] Error rejecting application:', error);
    res.status(500).json({ error: 'Failed to reject application' });
  }
});

/**
 * Delete charity application
 * DELETE /api/admin/charity-applications/:id
 */
router.delete('/charity-applications/:id', authenticateToken, requireWellspringAdmin, async (req, res) => {
  try {
    const application = await CharityApplication.findByIdAndDelete(req.params.id);
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    console.log(`[Admin] Deleted application: ${application.charityName} by ${req.user.email}`);
    
    res.json({
      message: 'Application deleted successfully'
    });
  } catch (error) {
    console.error('[Admin] Error deleting application:', error);
    res.status(500).json({ error: 'Failed to delete application' });
  }
});

/**
 * Get admin dashboard stats
 * GET /api/admin/stats
 */
router.get('/stats', authenticateToken, requireWellspringAdmin, async (req, res) => {
  try {
    const [pending, underReview, approved, rejected, totalCharities] = await Promise.all([
      CharityApplication.countDocuments({ status: 'pending' }),
      CharityApplication.countDocuments({ status: 'under_review' }),
      CharityApplication.countDocuments({ status: 'approved' }),
      CharityApplication.countDocuments({ status: 'rejected' }),
      Charity.countDocuments()
    ]);
    
    res.json({
      applications: {
        pending,
        underReview,
        approved,
        rejected,
        total: pending + underReview + approved + rejected
      },
      charities: {
        total: totalCharities
      }
    });
  } catch (error) {
    console.error('[Admin] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
