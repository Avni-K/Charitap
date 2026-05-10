# Charitap

## Project Description
Charitap is a micro-donations platform that turns everyday purchases into automated round-ups, tracks impact in a modern dashboard, supports charity discovery and nominations, and records donation receipts with blockchain and Solana-backed transparency for donors, admins, and nonprofits. across web.

## Overview
Charitap is a donation platform that makes giving feel automatic, transparent, and easy to manage. Users can round up purchases, choose donation preferences, discover charities, connect a wallet, and review their impact in a dashboard that combines modern analytics with immutable receipt tracking.

This repository currently contains three major parts:

- A React frontend for the main Charitap user experience
- A Node/Express backend for auth, donations, activity, Wellspring inventory, and Solana/Atlas support
- An Anchor workspace for the `charitap_receipts` Solana program and local receipt tests

## What It Does

- Rounds up purchases into micro-donations
- Shows donation history and impact charts
- Lets users search, like, and add charities to a donation list
- Supports card-based and wallet-based donation rails
- Records donation receipts in blockchain-backed systems
- Includes a Wellspring admin console for inventory, donations, distributions, and reporting

## Core Features

### Donor Experience
- Automated round-ups and donation settlements
- Donation activity feed with donated and collected views
- Settings for payment mode, payment rail, ZIP-based local discovery, and wallet connection
- Charity discovery with category filters, like buttons, and donation list controls

### Dashboard and Impact
- Total donation summary cards
- Monthly donation trends
- Charities Supported chart
- Blockchain and transparency metrics
- Optional Atlas dashboard embed for richer reporting

### Wellspring Admin
- Inventory tracking and distribution workflows
- Donation and distribution seeding for demo data
- Report filters for program, category, sub-category, quantity, and expiration date
- PDF report export with charts, filters, signer metadata, and inventory details

### Solana and Blockchain
- Optional Solana wallet connection for Google-authenticated users
- Local USDC mint bootstrap support for development
- Solana receipt program and tests in the Anchor workspace
- USDC/USD conversion support for donation settlement flows

## Tech Stack

| Area | Technologies |
| --- | --- |
| Frontend | React, React Router, Chart.js, Recharts, Framer Motion, Tailwind CSS |
| Backend | Node.js, Express, MongoDB, Mongoose |
| Payments | Stripe, Solana USDC support |
| Reporting | html2canvas, jsPDF |
| Blockchain | Anchor, Solana Web3, Solana SPL Token |
| Integrations | Google OAuth, Atlas embeds and triggers |

## Repository Layout

- `src/` - React app, pages, components, hooks, styles, and client services
- `backend/` - Express API, data models, services, scripts, and routes
- `programs/charitap_receipts/` - Anchor program for donation receipts
- `tests/` - Anchor tests for the receipt program
- `atlas/` - Atlas vector search index and trigger function
- `docs/` - setup notes and integration guides
- `admin_reference/` - older reference copy of the Wellspring implementation

## Getting Started

### Prerequisites
- Node.js 16 or newer
- npm
- MongoDB
- Optional: Solana CLI and Anchor if you want to run the on-chain receipt program locally

### Install Dependencies

Install the frontend dependencies from the repository root:

```bash
npm install
```

Then install backend dependencies:

```bash
cd backend
npm install
```

If you plan to run Anchor tests, install any Solana/Anchor prerequisites required by your local environment.

### Environment Setup

Create environment files for the frontend and backend as needed. Common variables include:

Frontend:

- `REACT_APP_SERVER_URL`
- `REACT_APP_GOOGLE_CLIENT_ID`
- `REACT_APP_STRIPE_PUBLIC_KEY`
- `REACT_APP_ATLAS_IMPACT_DASHBOARD_URL`
- `REACT_APP_SOLANA_USDC_MINT`
- `REACT_APP_CHROME_EXTENSION_ID`

Backend:

- `MONGODB_URI`
- `STRIPE_SECRET_KEY`
- `RESILIENTDB_URL`
- `SOLANA_ENABLED`
- `SOLANA_RPC_URL`
- `SOLANA_WS_URL`
- `SOLANA_PROGRAM_ID`
- `SOLANA_TREASURY_WALLET`
- `SOLANA_FEE_PAYER_KEYPAIR`
- `SOLANA_USDC_MINT`
- `ATLAS_TRIGGER_SECRET`
- `ADMIN_EMAILS`

### Run the App

Start the frontend from the repository root:

```bash
npm start
```

Start the backend in a separate terminal:

```bash
cd backend
npm run dev
```

## Useful Scripts

From the repository root:

- `npm start` - run the frontend in development mode
- `npm run build` - create a production frontend build
- `npm test` - run the frontend test suite
- `npm run anchor:test` - run the Solana receipt program tests
- `npm run solana:bootstrap-usdc` - create or reuse a local Solana USDC mint

From `backend/`:

- `npm run dev` - run the backend with nodemon
- `npm start` - run the backend once
- `npm run backfill:charity-search` - backfill charity embeddings and search metadata

## Wellspring Admin Notes

The Wellspring admin experience focuses on inventory operations and reporting. It includes seeded demo donations and distributions so charts, donor lists, distributor lists, and PDF exports work even in a fresh environment.

The report export is intentionally richer than the on-screen Reports tab: it captures the current inventory table state, active filters, charts, and signer information for the generated PDF.

## Solana and Atlas Notes

- The Solana receipt program lives under `programs/charitap_receipts/`
- Local Solana development can bootstrap a USDC mint with `npm run solana:bootstrap-usdc`
- Atlas Charts uses an iframe URL configured through `REACT_APP_ATLAS_IMPACT_DASHBOARD_URL`
- Atlas App Services triggers use a shared secret configured in both the backend and Atlas

## Troubleshooting

- If the dashboard charts are empty, confirm the backend is running and the demo seed data exists in MongoDB.
- If wallet features are unavailable, confirm Google sign-in and a compatible Solana wallet extension are available.
- If the report PDF is blank, check that the backend returned data and that the browser allowed html2canvas to render the report container.
- If Anchor tests fail, make sure the local validator is running and the program ID matches the workspace configuration.

## Build Status

This workspace currently builds successfully with `npm run build`.
