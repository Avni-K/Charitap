// src/App.test.js
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/AuthContext';

jest.mock('./services/api', () => ({
  authAPI: {
    updateGeolocation: jest.fn(() => Promise.resolve({}))
  },
  dashboardAPI: {
    getTotalDonated: jest.fn(() => Promise.resolve({ totalDonated: '12.50' }))
  },
  roundUpAPI: {
    getPending: jest.fn(() => Promise.resolve({ totalAmount: '1.25' }))
  },
  activityAPI: {
    getCollected: jest.fn(() => Promise.resolve({ data: [] })),
    getDonations: jest.fn(() => Promise.resolve({ data: [] }))
  }
}));

jest.mock('./services/wellspringApi', () => ({
  getDonations: jest.fn(() => Promise.resolve([])),
  getDistributions: jest.fn(() => Promise.resolve([])),
  getInventory: jest.fn(() => Promise.resolve([])),
  getWellspringMongoSummary: jest.fn(() => Promise.resolve({ totalCollected: 0, transactionCount: 0 })),
  postDistribution: jest.fn(() => Promise.resolve({ ok: true })),
  postDonation: jest.fn(() => Promise.resolve({ ok: true }))
}));

function renderApp(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('App component', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  test('renders the public Charitap home for signed-out visitors', async () => {
    renderApp('/');

    expect(await screen.findAllByText(/Charitap/i)).not.toHaveLength(0);
    expect(screen.getAllByRole('button', { name: /join now/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /Dashboard/i })).not.toBeInTheDocument();
  });

  test('renders normal user navigation for signed-in users', async () => {
    localStorage.setItem('charitap_auth', JSON.stringify({
      id: 'user-1',
      email: 'user@example.com',
      displayName: 'Demo User',
      authProvider: 'google',
      role: 'user',
      adminScope: null,
      token: 'demo-token',
      expiresAt: Date.now() + 60_000
    }));

    renderApp('/');

    expect((await screen.findAllByRole('link', { name: /Dashboard/i })).length).toBeGreaterThan(0);
    expect(screen.getByText(/Collected:/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Admin/i })).not.toBeInTheDocument();
  });

  test('redirects allowlisted admins to the Wellspring console', async () => {
    localStorage.setItem('charitap_auth', JSON.stringify({
      id: 'admin-1',
      email: 'admin@example.com',
      displayName: 'Wellspring Admin',
      authProvider: 'google',
      role: 'admin',
      adminScope: 'wellspring',
      token: 'admin-token',
      expiresAt: Date.now() + 60_000
    }));

    renderApp('/dashboard');

    expect((await screen.findAllByText(/Wellspring Admin/i)).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /Dashboard/i })).not.toBeInTheDocument();
  });
});
