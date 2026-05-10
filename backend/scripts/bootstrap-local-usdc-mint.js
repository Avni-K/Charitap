const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Connection, Keypair } = require('@solana/web3.js');

const {
  bootstrapLocalUsdcMint,
  getConfiguredMintAddress,
  readEnvValue,
  ROOT_ENV_PATH,
  BACKEND_ENV_PATH
} = require('../services/solana-mint-bootstrap');

dotenv.config({ path: BACKEND_ENV_PATH });
dotenv.config({ path: ROOT_ENV_PATH });

function loadFeePayer() {
  const keypairSource = process.env.SOLANA_FEE_PAYER_KEYPAIR;
  if (!keypairSource) {
    throw new Error('SOLANA_FEE_PAYER_KEYPAIR is required');
  }

  const keypairText = keypairSource.trim().startsWith('[')
    ? keypairSource
    : fs.readFileSync(path.resolve(keypairSource), 'utf8');
  const secretKey = Uint8Array.from(JSON.parse(keypairText));
  return Keypair.fromSecretKey(secretKey);
}

async function main() {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'http://localhost:8899';
  const connection = new Connection(rpcUrl, 'confirmed');
  const feePayer = loadFeePayer();
  const treasuryWallet = process.env.SOLANA_TREASURY_WALLET || feePayer.publicKey.toBase58();
  const targetMint = getConfiguredMintAddress() || readEnvValue(ROOT_ENV_PATH, 'REACT_APP_SOLANA_USDC_MINT');

  console.log('[Solana] Bootstrap starting');
  console.log(`[Solana] RPC: ${rpcUrl}`);
  console.log(`[Solana] Treasury wallet: ${treasuryWallet}`);

  const balance = await connection.getBalance(feePayer.publicKey);
  if (balance < 2_000_000_000) {
    console.log('[Solana] Requesting airdrop to fee payer for mint bootstrap');
    const signature = await connection.requestAirdrop(feePayer.publicKey, 5_000_000_000);
    await connection.confirmTransaction(signature, 'confirmed');
  }

  const result = await bootstrapLocalUsdcMint({
    connection,
    feePayer,
    treasuryWallet,
    initialSupplyUsdc: process.env.SOLANA_BOOTSTRAP_USDC_SUPPLY || '1000000',
    decimals: 6,
    force: process.argv.includes('--force') || Boolean(process.env.SOLANA_FORCE_BOOTSTRAP)
  });

  console.log(JSON.stringify({
    existingMint: targetMint || null,
    ...result
  }, null, 2));

  console.log('');
  console.log('Updated env files:');
  console.log(`- ${BACKEND_ENV_PATH}`);
  console.log(`- ${ROOT_ENV_PATH}`);
  console.log('');
  console.log('Next steps: restart the backend if it is already running, then refresh the frontend.');
}

main().catch(error => {
  console.error('[Solana] Mint bootstrap failed:', error);
  process.exit(1);
});