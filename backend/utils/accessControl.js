function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminEmail(email) {
  return getAdminEmails().includes(String(email || '').trim().toLowerCase());
}

function applyComputedAccess(user) {
  if (!user) return user;

  const isAdmin = isAdminEmail(user.email);
  if (isAdmin) {
    user.role = 'admin';
    user.adminScope = 'wellspring';
  }
  return user;
}

function serializeUser(user) {
  return {
    id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    authProvider: user.authProvider,
    profilePicture: user.profilePicture,
    role: user.role || 'user',
    adminScope: user.adminScope || null,
    paymentPreference: user.paymentPreference,
    paymentRailPreference: user.paymentRailPreference,
    solanaWalletAddress: user.solanaWalletAddress,
    solanaWalletConnectedAt: user.solanaWalletConnectedAt,
    zipCode: user.zipCode,
    selectedCharities: user.selectedCharities
  };
}

function requireWellspringAdmin(req, res, next) {
  applyComputedAccess(req.user);
  if (req.user.role !== 'admin' || req.user.adminScope !== 'wellspring') {
    return res.status(403).json({ error: 'Access denied. Wellspring admin privileges required.' });
  }
  next();
}

module.exports = {
  applyComputedAccess,
  getAdminEmails,
  isAdminEmail,
  requireWellspringAdmin,
  serializeUser
};
