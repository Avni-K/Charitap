/* eslint-disable no-console */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
let stripe = null;
try {
  if (STRIPE_SECRET_KEY) {
    stripe = require('stripe')(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  }
} catch (e) {
  console.error('Stripe SDK init failed:', e.message);
}

const app = express();
app.use(cors({ origin: ['http://localhost:3000'], credentials: false }));
app.use(bodyParser.json());

// Simple health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Ensure a customer exists for the given email; returns customer id
async function getOrCreateCustomerByEmail(email, name) {
  if (!email) throw new Error('Email is required');
  // Try to find existing customer
  if (!stripe) throw new Error('Stripe disabled');
  const matched = await stripe.customers.search({ query: `email:'${email}'` });
  if (matched.data && matched.data.length > 0) {
    return matched.data[0].id;
  }
  const created = await stripe.customers.create({ email, name });
  return created.id;
}

// Create a SetupIntent for saving a card
app.post('/api/create-setup-intent', async (req, res) => {
  try {
    if (!stripe) throw new Error('Stripe secret missing. Set STRIPE_SECRET_KEY in server/.env');
    const { email, name } = req.body || {};
    const customerId = await getOrCreateCustomerByEmail(email, name);
    const setupIntent = await stripe.setupIntents.create({ customer: customerId, usage: 'off_session' });
    res.json({ clientSecret: setupIntent.client_secret, customerId });
  } catch (err) {
    console.error('Failed to create setup intent', err);
    res.status(400).json({ error: err.message });
  }
});

// List payment methods
app.post('/api/list-payment-methods', async (req, res) => {
  try {
    if (!stripe) throw new Error('Stripe secret missing. Set STRIPE_SECRET_KEY in server/.env');
    const { email } = req.body || {};
    const customerId = await getOrCreateCustomerByEmail(email);
    const pms = await stripe.paymentMethods.list({ customer: customerId, type: 'card' });
    res.json({ paymentMethods: pms.data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Set default payment method for customer
app.post('/api/set-default-payment-method', async (req, res) => {
  try {
    if (!stripe) throw new Error('Stripe secret missing. Set STRIPE_SECRET_KEY in server/.env');
    const { email, paymentMethodId } = req.body || {};
    const customerId = await getOrCreateCustomerByEmail(email);
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Detach a payment method
app.post('/api/detach-payment-method', async (req, res) => {
  try {
    if (!stripe) throw new Error('Stripe secret missing. Set STRIPE_SECRET_KEY in server/.env');
    const { paymentMethodId } = req.body || {};
    const pm = await stripe.paymentMethods.detach(paymentMethodId);
    res.json({ ok: true, paymentMethod: pm });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PaymentIntent (for wallets)
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    if (!stripe) throw new Error('Stripe disabled');
    const { email, amount = 100, currency = 'usd', description = 'Charitap wallet attach' } = req.body || {};
    const customerId = await getOrCreateCustomerByEmail(email);
    const pi = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      description,
      setup_future_usage: 'off_session',
    });
    res.json({ clientSecret: pi.client_secret });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Subscriptions (optional)
app.post('/api/create-subscription', async (req, res) => {
  try {
    if (!stripe) throw new Error('Stripe disabled');
    const { email, priceId } = req.body || {};
    if (!priceId) throw new Error('Missing priceId');
    const customerId = await getOrCreateCustomerByEmail(email);
    const sub = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });
    res.json({ id: sub.id, status: sub.status, latestInvoice: sub.latest_invoice });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Minimal OTP email flow for password reset / verify
const otpStore = new Map(); // email -> { hash, exp }
function sha256(val) { return crypto.createHash('sha256').update(String(val)).digest('hex'); }
const transporter = nodemailer.createTransport(process.env.SMTP_URL ? process.env.SMTP_URL : {
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
});

app.post('/api/password/request-otp', async (req, res) => {
  try {
    const { email } = req.body || {};
    const code = (Math.floor(100000 + Math.random() * 900000)).toString();
    otpStore.set(email, { hash: sha256(code), exp: Date.now() + 10 * 60 * 1000 });
    const html = `
      <div style="font-family:Arial,sans-serif;">
        <h2>Charitap verification code</h2>
        <p>Your one-time code is:</p>
        <div style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</div>
        <p>This code expires in 10 minutes.</p>
      </div>
    `;
    await transporter.sendMail({ from: process.env.GMAIL_USER, to: email, subject: 'Your Charitap verification code', html });
    res.json({ ok: true });
  } catch (err) {
    console.error('OTP send failed', err);
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/password/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body || {};
    const rec = otpStore.get(email);
    if (!rec || Date.now() > rec.exp) throw new Error('Code expired');
    if (rec.hash !== sha256(otp)) throw new Error('Invalid code');
    otpStore.delete(email);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const port = process.env.PORT || 4242;
app.listen(port, () => console.log(`Local server listening on http://localhost:${port}`));


