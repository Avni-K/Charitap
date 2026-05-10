# Charitap Atlas and Solana Local Setup

## Solana Local Validator

1. Install Node.js, npm, Solana CLI, and Anchor.
2. Start a validator:
   ```bash
   solana-test-validator --reset
   ```
3. Build and deploy the Anchor program from the repo root:
   ```bash
   anchor build
   anchor deploy
   ```
4. Copy the deployed program id into `backend/.env` as `SOLANA_PROGRAM_ID`.
5. Create a local fee payer keypair and set `SOLANA_FEE_PAYER_KEYPAIR` to the keypair JSON path.
6. Set `SOLANA_ENABLED=true` when the local validator is running.
7. Bootstrap the local USDC mint and treasury ATA:
   ```bash
   npm run solana:bootstrap-usdc
   ```
   This creates a 6-decimal local SPL mint on the validator, mints test supply to the fee payer ATA, and writes the mint address into both `.env` files.

## Atlas Charts

1. Create an Atlas Charts dashboard using the `transactions`, `roundups`, and `charities` collections.
2. Enable unauthenticated or authenticated embedding.
3. Copy the iframe URL into the frontend env var:
   ```bash
   REACT_APP_ATLAS_IMPACT_DASHBOARD_URL=
   ```
4. The React `/dashboard` page automatically uses the iframe when this value exists and falls back to local Chart.js visualizations otherwise.
5. The `/impact` route now redirects to `/dashboard`, so there is only one dashboard surface to maintain.

### Getting The URL

Use the Atlas UI, not an API key. Open your Atlas cluster, then:

1. Open **Charts**.
2. Open the dashboard or chart you want to embed.
3. Click **Share** or **Embed**.
4. Copy the embed `iframe` URL or dashboard URL that Atlas gives you.
5. Paste that URL into `REACT_APP_ATLAS_IMPACT_DASHBOARD_URL`.

## Atlas Database Trigger

1. Pick a random shared secret string, for example with `openssl rand -hex 32`.
2. Put that exact string in `backend/.env` as `ATLAS_TRIGGER_SECRET`.
3. In Atlas App Services, create a matching value called `CHARITAP_ATLAS_TRIGGER_SECRET`.
4. Also create `CHARITAP_BACKEND_URL` in Atlas App Services so the trigger knows where to call your backend.
5. Create a Database Trigger on the `roundups` collection for inserts and updates.
6. Use a match expression that limits events to pending roundups, for example:
   ```json
   {
     "$or": [
       { "operationType": "insert" },
       { "updateDescription.updatedFields.roundUpAmount": { "$exists": true } },
       { "updateDescription.updatedFields.isPaid": false }
     ]
   }
   ```
7. Use `atlas/triggers/process-roundups-function.js` as the trigger function.

## Atlas Vector Search

1. Store charity embeddings in `charities.embedding`.
2. Create the Atlas Vector Search index from `atlas/vector-search-index.json`.
3. Set `ATLAS_VECTOR_SEARCH_ENABLED=true`.
4. Keep `EMBEDDINGS_PROVIDER=local` for deterministic local development or set `EMBEDDINGS_PROVIDER=openai` with `OPENAI_API_KEY` for production embeddings.
