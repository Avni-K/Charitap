// API service for backend communication
const API_BASE_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:3001';

// Helper function to get auth token
const getAuthToken = () => {
  const auth = localStorage.getItem('charitap_auth');
  if (auth) {
    try {
      const data = JSON.parse(auth);
      return data.token;
    } catch (e) {
      return null;
    }
  }
  return null;
};

// Helper function for API calls
const apiCall = async (endpoint, options = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }

  return data;
};

// Authentication APIs
export const authAPI = {
  // Signup with email and password
  signup: async (email, password) => {
    return apiCall('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  // Login with email and password
  login: async (email, password) => {
    return apiCall('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  // Google OAuth
  googleAuth: async (googleId, email, displayName, profilePicture, firstName, lastName) => {
    console.log('API: Calling Google auth with:', { googleId, email, displayName, profilePicture, firstName, lastName });
    const result = await apiCall('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ googleId, email, displayName, profilePicture, firstName, lastName }),
    });
    console.log('API: Google auth response:', result);
    return result;
  },

  // Get current user profile
  getProfile: async () => {
    return apiCall('/api/auth/me');
  },

  // Update profile
  updateProfile: async (profileData) => {
    return apiCall('/api/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(profileData),
    });
  },

  // Change password
  changePassword: async (currentPassword, newPassword) => {
    return apiCall('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  // Delete account
  deleteAccount: async () => {
    return apiCall('/api/auth/delete', {
      method: 'DELETE',
    });
  },

  // Push browser geolocation to backend (called silently on every login)
  updateGeolocation: async (lat, lng) => {
    return apiCall('/api/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ lat, lng }),
    });
  },
};

// Dashboard APIs
export const dashboardAPI = {
  // Get total donated
  getTotalDonated: async () => {
    return apiCall('/api/roundup/total-donated');
  },

  // Get collected this month
  getCollectedThisMonth: async () => {
    return apiCall('/api/roundup/collected-this-month');
  },

  // Get unique charities count
  getUniqueCharities: async () => {
    return apiCall('/api/roundup/dashboard/unique-charities');
  },

  // Get monthly donations for last 12 months
  getMonthlyDonations: async () => {
    return apiCall('/api/roundup/dashboard/monthly-donations');
  },

  // Get charity breakdown (for donut chart)
  getCharityBreakdown: async () => {
    return apiCall('/api/roundup/dashboard/charity-breakdown');
  },
  
  // Get blockchain security stats
  getBlockchainStats: async () => {
    return apiCall('/api/roundup/dashboard/blockchain-stats');
  },
};

// Activity APIs
export const activityAPI = {
  // Get collected round-ups
  getCollected: async () => {
    return apiCall('/api/roundup/activity/collected');
  },

  // Get donations
  getDonations: async () => {
    return apiCall('/api/roundup/activity/donated');
  },
};

// RoundUp APIs
export const roundUpAPI = {
  // Get user's roundup history
  getHistory: async () => {
    return apiCall('/api/roundup/history');
  },

  // Get pending roundups
  getPending: async () => {
    return apiCall('/api/roundup/pending');
  },
};

// Settings APIs
export const settingsAPI = {
  // Get all charities
  getCharities: async () => {
    return apiCall('/api/charities');
  },

  // Toggle charity selection
  toggleCharity: async (charityId) => {
    return apiCall('/api/auth/settings/charities/toggle', {
      method: 'POST',
      body: JSON.stringify({ charityId }),
    });
  },

  // Update all selected charities at once
  updateCharities: async (charityIds) => {
    return apiCall('/api/auth/settings/charities', {
      method: 'PATCH',
      body: JSON.stringify({ charityIds }),
    });
  },

  // Update payment preference
  updatePaymentPreference: async (paymentPreference) => {
    return apiCall('/api/auth/settings/payment-preference', {
      method: 'PATCH',
      body: JSON.stringify({ paymentPreference }),
    });
  },

  updatePaymentRailPreference: async (paymentRailPreference) => {
    return apiCall('/api/auth/settings/payment-rail-preference', {
      method: 'PATCH',
      body: JSON.stringify({ paymentRailPreference }),
    });
  },

  searchCharities: async (params = {}) => {
    const query = new URLSearchParams(params);
    return apiCall(`/api/charities/search?${query.toString()}`);
  },

  // Nominate a charity
  nominateCharity: async (nominationData) => {
    return apiCall('/api/charity-nominations/nominate', {
      method: 'POST',
      body: JSON.stringify(nominationData),
    });
  },

  // Get user's nominations
  getMyNominations: async () => {
    return apiCall('/api/charity-nominations/my-nominations');
  },
};

export const walletAPI = {
  createNonce: async (walletAddress) => {
    return apiCall('/api/wallet/connect/nonce', {
      method: 'POST',
      body: JSON.stringify({ walletAddress }),
    });
  },

  verifyWallet: async ({ walletAddress, signature, message }) => {
    return apiCall('/api/wallet/connect/verify', {
      method: 'POST',
      body: JSON.stringify({ walletAddress, signature, message }),
    });
  },
};

export const solanaAPI = {
  createPaymentIntent: async ({ amount, charityIds }) => {
    return apiCall('/api/solana/payments/create-intent', {
      method: 'POST',
      body: JSON.stringify({ amount, charityIds }),
    });
  },

  confirmPayment: async ({ intentId, signature }) => {
    return apiCall('/api/solana/payments/confirm', {
      method: 'POST',
      body: JSON.stringify({ intentId, signature }),
    });
  },

  getReceipt: async (transactionId) => {
    return apiCall(`/api/solana/receipts/${transactionId}`);
  },
};

export const impactAPI = {
  getPublicSummary: async () => {
    return apiCall('/api/impact/public-summary');
  },
};

// Charities public page APIs
export const charitiesAPI = {
  // Get all charities with geo ranking and like/select state
  getAll: async () => {
    return apiCall('/api/charities');
  },

  // Search charities (AI/geo/keyword)
  search: async (params = {}) => {
    const query = new URLSearchParams(params);
    return apiCall(`/api/charities/search?${query.toString()}`);
  },

  // Toggle like/unlike a charity
  like: async (charityId) => {
    return apiCall(`/api/charities/${charityId}/like`, { method: 'POST' });
  },

  // Add/remove a charity from the user's donation list
  addToList: async (charityId) => {
    return apiCall(`/api/charities/${charityId}/add-to-list`, { method: 'POST' });
  },

  // Get conversion info for a charity + payment rail
  getConversionInfo: async (charityId, rail) => {
    return apiCall(`/api/solana/conversion-info?charityId=${charityId}&rail=${rail}`);
  },
};



// Stripe APIs
export const stripeAPI = {
  // Create Stripe customer
  createCustomer: async (email, name) => {
    return apiCall('/api/stripe/create-customer', {
      method: 'POST',
      body: JSON.stringify({ email, name }),
    });
  },

  // Create setup intent (Note: Check backend if this endpoint exists)
  createSetupIntent: async (email, name) => {
    return apiCall('/api/stripe/create-setup-intent', {
      method: 'POST',
      body: JSON.stringify({ email, name }),
    });
  },

  // List payment methods (Note: Check backend if this endpoint exists)
  listPaymentMethods: async (email) => {
    return apiCall('/api/stripe/list-payment-methods', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  // Set default payment method (Note: Check backend if this endpoint exists)
  setDefaultPaymentMethod: async (email, paymentMethodId) => {
    return apiCall('/api/stripe/set-default-payment-method', {
      method: 'POST',
      body: JSON.stringify({ email, paymentMethodId }),
    });
  },

  // Detach payment method (Note: Check backend if this endpoint exists)
  detachPaymentMethod: async (paymentMethodId) => {
    return apiCall('/api/stripe/detach-payment-method', {
      method: 'POST',
      body: JSON.stringify({ paymentMethodId }),
    });
  },
};

const apiServices = {
  authAPI,
  dashboardAPI,
  activityAPI,
  roundUpAPI,
  settingsAPI,
  stripeAPI,
  walletAPI,
  solanaAPI,
  impactAPI,
  charitiesAPI,
};

export default apiServices;
