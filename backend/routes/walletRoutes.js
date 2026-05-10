const crypto = require('crypto');
const express = require('express');
const nacl = require('tweetnacl');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function getBs58() {
  const bs58Module = require('bs58');
  return bs58Module.default || bs58Module;
}

function requireGoogleUser(req, res, next) {
  if (req.user.authProvider !== 'google') {
    return res.status(403).json({
      error: 'Crypto wallet features are available for Google OAuth accounts only.'
    });
  }
  next();
}

function buildWalletMessage({ email, walletAddress, nonce }) {
  return [
    'Charitap wallet connection',
    `EmailHash: ${crypto.createHash('sha256').update(email).digest('hex').substring(0, 16)}`,
    `Wallet: ${walletAddress}`,
    `Nonce: ${nonce}`,
    'Purpose: Enable optional USDC donation receipts'
  ].join('\n');
}

router.post('/connect/nonce', authenticateToken, requireGoogleUser, async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
    }

    const nonce = crypto.randomBytes(24).toString('hex');
    req.user.walletNonce = nonce;
    req.user.walletNonceExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await req.user.save();

    res.json({
      walletAddress,
      nonce,
      message: buildWalletMessage({
        email: req.user.email,
        walletAddress,
        nonce
      })
    });
  } catch (error) {
    console.error('[Wallet] Nonce error:', error);
    res.status(500).json({ error: 'Failed to create wallet nonce' });
  }
});

router.post('/connect/verify', authenticateToken, requireGoogleUser, async (req, res) => {
  try {
    const { walletAddress, signature, message } = req.body;
    if (!walletAddress || !signature || !message) {
      return res.status(400).json({ error: 'walletAddress, signature, and message are required' });
    }

    if (!req.user.walletNonce || !req.user.walletNonceExpiresAt || req.user.walletNonceExpiresAt < new Date()) {
      return res.status(400).json({ error: 'Wallet nonce is missing or expired' });
    }

    const expectedMessage = buildWalletMessage({
      email: req.user.email,
      walletAddress,
      nonce: req.user.walletNonce
    });
    if (message !== expectedMessage) {
      return res.status(400).json({ error: 'Wallet message mismatch' });
    }

    const bs58 = getBs58();
    const publicKeyBytes = bs58.decode(walletAddress);
    const signatureBytes = bs58.decode(signature);
    const verified = nacl.sign.detached.verify(
      Buffer.from(message, 'utf8'),
      signatureBytes,
      publicKeyBytes
    );

    if (!verified) {
      return res.status(401).json({ error: 'Wallet signature verification failed' });
    }

    req.user.solanaWalletAddress = walletAddress;
    req.user.solanaWalletConnectedAt = new Date();
    req.user.walletNonce = undefined;
    req.user.walletNonceExpiresAt = undefined;
    await req.user.save();

    res.json({
      message: 'Wallet connected',
      walletAddress: req.user.solanaWalletAddress,
      connectedAt: req.user.solanaWalletConnectedAt
    });
  } catch (error) {
    console.error('[Wallet] Verify error:', error);
    res.status(500).json({ error: 'Failed to verify wallet signature' });
  }
});

module.exports = router;
