const BASE = process.env.REACT_APP_SERVER_URL || 'http://localhost:3001';

function getAuthHeaders() {
  try {
    const auth = JSON.parse(localStorage.getItem('charitap_auth') || '{}');
    return auth.token ? { Authorization: `Bearer ${auth.token}` } : {};
  } catch {
    return {};
  }
}

async function jsonResponse(res) {
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch (e) { return text; } })() : null;
  if (!res.ok) {
    throw new Error(data?.error || data || 'Wellspring API request failed');
  }
  return data;
}

async function wellspringFetch(path, options = {}) {
  const headers = {
    ...getAuthHeaders(),
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  return jsonResponse(res);
}

export async function getSummary() {
  return wellspringFetch('/api/wellspring/summary');
}

export async function postDonation(payload) {
  return wellspringFetch('/api/wellspring/donations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getDonations() {
  return wellspringFetch('/api/wellspring/donations');
}

export async function getInventory(search = "") {
  const url = new URL(`${BASE}/api/wellspring/inventory`);
  if (search && search.trim()) {
    url.searchParams.set("search", search.trim());
  }
  const path = `${url.pathname}${url.search}`;
  return wellspringFetch(path);
}

export async function postDistribution(payload) {
  return wellspringFetch('/api/wellspring/distributions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getDistributions() {
  return wellspringFetch('/api/wellspring/distributions');
}

export async function getWellspringMongoSummary() {
  return wellspringFetch('/api/charities/wellspring/summary');
}

const wellspringApi = {
  getSummary,
  postDonation,
  getDonations,
  getInventory,
  postDistribution,
  getDistributions,
  getWellspringMongoSummary,
};

export default wellspringApi;
