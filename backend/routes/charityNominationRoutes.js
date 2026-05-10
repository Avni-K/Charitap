const express = require('express');
const router = express.Router();
const CharityApplication = require('../models/CharityApplication');
const Charity = require('../models/Charity');
const { authenticateToken } = require('../middleware/auth');
const emailService = require('../services/email-service');
const zipGeocoder = require('../services/zip-geocoder');

/**
 * User nominates a charity to join Charitap
 * POST /api/charity-nominations/nominate
 */
router.post('/nominate', authenticateToken, async (req, res) => {
  try {
    console.log('[DEBUG] Nomination request received:', {
      user: req.user.email,
      body: req.body
    });
    const { charityName, charityEmail, category, message, zipCode } = req.body;

    // Validate required fields
    if (!charityName || !charityEmail) {
      return res.status(400).json({
        error: 'Charity name and email are required'
      });
    }

    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(charityEmail)) {
      return res.status(400).json({
        error: 'Please provide a valid email address'
      });
    }

    if (zipCode && !/^\d{5}$/.test(String(zipCode).trim())) {
      return res.status(400).json({
        error: 'Please provide a valid 5-digit ZIP code'
      });
    }

    // Restrict to .org and .edu domains
    const allowedDomains = ['.org', '.edu'];
    const emailLower = charityEmail.toLowerCase();
    const isAllowedDomain = allowedDomains.some(domain => emailLower.endsWith(domain));
    if (!isAllowedDomain) {
      return res.status(400).json({
        error: 'Only registered non-profit domains (.org, .edu) are allowed for nominations.'
      });
    }

    // Check if charity already exists (approved)
    const existingCharity = await Charity.findOne({
      name: new RegExp(`^${charityName}$`, 'i')
    });

    if (existingCharity) {
      return res.status(400).json({
        error: `Great news! ${charityName} is already available on Charitap. You can select it in your charity preferences in Settings.`,
        existingCharity: true
      });
    }

    // Check if application already exists
    const existingApplication = await CharityApplication.findOne({
      charityEmail: charityEmail.toLowerCase()
    });

    if (existingApplication) {
      // Add a rate limit check: block multiple emails sent to the same charity within 24 hours
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
      if (existingApplication.updatedAt && existingApplication.updatedAt > twentyFourHoursAgo) {
        // If it's within 24 hours, let the user know it's already under review or recently nominated
        if (['pending', 'under_review'].includes(existingApplication.status)) {
          return res.status(400).json({
            error: 'This charity has already been nominated and is currently under review. Please try again after 24 hours to send another reminder.',
            status: existingApplication.status
          });
        }
        return res.status(429).json({
          error: 'This charity has already been nominated recently. Please try again after 24 hours.',
          status: existingApplication.status
        });
      }

      // If more than 24 hours have passed, we allow re-nomination/resending the email regardless of current status.
      // Update the existing application
      existingApplication.charityName = charityName;
      existingApplication.category = category || existingApplication.category;
      existingApplication.nominatedBy = req.user.email;
      if (zipCode) {
        existingApplication.zipCode = zipCode;
        existingApplication.location = await zipGeocoder.geocodeZip(zipCode);
      }

      if (existingApplication.status === 'rejected') {
        existingApplication.status = 'pending';
        existingApplication.rejectionReason = null;
      }

      await existingApplication.save();

      // Send emails again
      try {
        await emailService.sendCharityNomination(
          charityEmail,
          charityName,
          req.user.email
        );

        await emailService.sendAdminNotification({
          charityName,
          charityEmail,
          category: category || 'Other',
          nominatedBy: req.user.email
        });
      } catch (emailError) {
        console.error('[Nomination] Email error:', emailError.message);
        // Continue anyway - nomination is saved
      }

      return res.status(201).json({
        message: 'Charity reminder sent successfully! We\'ll reach out to them again.',
        application: {
          id: existingApplication._id,
          charityName: existingApplication.charityName,
          status: existingApplication.status
        }
      });
    }

    // Create new charity application
    const newApplication = new CharityApplication({
      charityName,
      charityEmail: charityEmail.toLowerCase(),
      category: category || 'Other',
      zipCode,
      location: zipCode ? await zipGeocoder.geocodeZip(zipCode) : undefined,
      nominatedBy: req.user.email,
      status: 'pending'
    });

    await newApplication.save();

    console.log(`[Nomination] New charity nominated: ${charityName} by ${req.user.email}`);

    // Send email notifications (non-blocking)
    try {
      // Email to charity
      await emailService.sendCharityNomination(
        charityEmail,
        charityName,
        req.user.email
      );

      // Email to admin
      await emailService.sendAdminNotification({
        charityName,
        charityEmail,
        category: category || 'Other',
        nominatedBy: req.user.email
      });

      console.log(`[Nomination] Emails sent successfully`);
    } catch (emailError) {
      console.error('[Nomination] Email error:', emailError.message);
      // Don't fail the request if email fails - nomination is still saved
    }

    res.status(201).json({
      message: 'Thank you! We\'ve notified the charity and will review their application.',
      application: {
        id: newApplication._id,
        charityName: newApplication.charityName,
        status: newApplication.status,
        createdAt: newApplication.createdAt
      }
    });

  } catch (error) {
    console.error('[Nomination] ERROR:', error.message);
    console.error('[Nomination] Stack:', error.stack);
    res.status(500).json({
      error: 'Failed to submit charity nomination. Please try again.'
    });
  }
});

/**
 * Get user's nomination history
 * GET /api/charity-nominations/my-nominations
 */
router.get('/my-nominations', authenticateToken, async (req, res) => {
  try {
    const nominations = await CharityApplication.find({
      nominatedBy: req.user.email
    })
      .select('charityName charityEmail category status createdAt')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      nominations,
      count: nominations.length
    });
  } catch (error) {
    console.error('[Nomination] Error fetching nominations:', error);
    res.status(500).json({ error: 'Failed to fetch nominations' });
  }
});

module.exports = router;
