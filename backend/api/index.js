// Load environment variables FIRST
const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const stripeLib = require("stripe");

const app = express();

// Seed admin users automatically on startup
const seedAdmins = async () => {
  try {
    const bcrypt = require('bcryptjs');
    const User = require('../models/User');
    const emails = ['himanshu@charitap.com', 'admin@charitap.com', 'your-email@gmail.com'];
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('charitap', salt);

    for (const email of emails) {
      let user = await User.findOne({ email });
      if (!user) {
        await User.create({
          email,
          password: hashedPassword,
          authProvider: 'local',
          displayName: email.split('@')[0],
          role: 'admin',
          adminScope: 'wellspring'
        });
        console.log(`[Charitap] Seeded admin user: ${email}`);
      } else if (user.authProvider !== 'local') {
        user.authProvider = 'local';
        user.password = hashedPassword;
        user.role = 'admin';
        user.adminScope = 'wellspring';
        await user.save();
        console.log(`[Charitap] Updated existing user ${email} to local admin`);
      }
    }
  } catch (error) {
    console.error('[Charitap] Failed to seed admins:', error);
  }
};
// Run the seeder asynchronously
seedAdmins();

// Trust proxy for correct IP handling in production (e.g., behind Vercel) URL and any custom domain
// CORS - Allow both the frontend Vercel URL and any custom domain
const allowedOrigins = [
  process.env.CORS_ORIGIN,
  "http://localhost:3000",
  "http://localhost:3001",
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        origin.endsWith(".vercel.app")
      ) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(express.json());

// MongoDB Connection (lazy - only connect once)
let isConnected = false;
const connectDB = async () => {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGODB_URI);
  isConnected = true;
  console.log("MongoDB connected");
};

// Connect before handling requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("MongoDB connection error:", err);
    res.status(500).json({ error: "Database connection failed" });
  }
});

// Stripe setup - USD only
const stripe = stripeLib(process.env.STRIPE_SECRET_KEY);

// Import routes
const authRoutes = require("../routes/authRoutes");
const stripeRoutes = require("../routes/stripeRoutes");
const roundUpRoutes = require("../routes/roundUpRoutes");
const charityRoutes = require("../routes/charityRoutes");
const charityNominationRoutes = require("../routes/charityNominationRoutes");
const adminRoutes = require("../routes/adminRoutes");
const walletRoutes = require("../routes/walletRoutes");
const solanaRoutes = require("../routes/solanaRoutes");
const triggerRoutes = require("../routes/triggerRoutes");
const impactRoutes = require("../routes/impactRoutes");
const healthRoutes = require("../routes/healthRoutes");
const wellspringRoutes = require("../routes/wellspringRoutes");

// Use routes
app.use("/api/auth", authRoutes);
app.use("/api/stripe", stripeRoutes);
app.use("/api/roundup", roundUpRoutes);
app.use("/api/charities", charityRoutes);
app.use("/api/charity-nominations", charityNominationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/solana", solanaRoutes);
app.use("/api/triggers", triggerRoutes);
app.use("/api/impact", impactRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/wellspring", wellspringRoutes);

// Health check

// Export for Vercel serverless
module.exports = app;
