const express = require('express');
const settlementService = require('../services/roundup-settlement-service');

const router = express.Router();

function authenticateAtlasTrigger(req, res, next) {
  const expected = process.env.ATLAS_TRIGGER_SECRET;
  if (!expected) {
    return res.status(503).json({ error: 'ATLAS_TRIGGER_SECRET is not configured' });
  }

  const authHeader = req.headers.authorization || '';
  if (authHeader !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'Unauthorized trigger request' });
  }

  next();
}

router.post('/roundups/process-user', authenticateAtlasTrigger, async (req, res) => {
  try {
    const { email, force = false, batchId } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    const result = await settlementService.processUserRoundups(email, {
      force: Boolean(force),
      batchId
    });

    res.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[AtlasTrigger] process-user error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
