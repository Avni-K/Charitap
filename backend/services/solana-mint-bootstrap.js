const fs = require('fs');
const path = require('path');

const ROOT_ENV_PATH = path.resolve(__dirname, '..', '..', '.env');
const BACKEND_ENV_PATH = path.resolve(__dirname, '..', '.env');

function normalizeValue(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function readEnvValue(filePath, key) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
    if (!match) return '';
    return normalizeValue(match[1].replace(/^['"]|['"]$/g, ''));
  } catch (error) {
    return '';
  }
}

function writeEnvValue(filePath, key, value) {
  const nextValue = normalizeValue(value);
  let content = '';
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    content = '';
  }

  const pattern = new RegExp(`^${key}=.*$`, 'm');
  const line = `${key}=${nextValue}`;

  if (pattern.test(content)) {
    content = content.replace(pattern, line);
  } else {
    if (content && !content.endsWith('\n')) {
      content += '\n';
    }
    content += `${line}\n`;
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

function getConfiguredMintAddress() {
  return (
    normalizeValue(process.env.SOLANA_USDC_MINT) ||
    normalizeValue(process.env.REACT_APP_SOLANA_USDC_MINT) ||
    readEnvValue(BACKEND_ENV_PATH, 'SOLANA_USDC_MINT') ||
    readEnvValue(ROOT_ENV_PATH, 'REACT_APP_SOLANA_USDC_MINT')
  );
}

function getConfiguredTreasuryWallet() {
  return (
    normalizeValue(process.env.SOLANA_TREASURY_WALLET) ||
    readEnvValue(BACKEND_ENV_PATH, 'SOLANA_TREASURY_WALLET')
  );
}

function persistMintConfiguration({ mintAddress, treasuryWallet }) {
  if (mintAddress) {
    writeEnvValue(BACKEND_ENV_PATH, 'SOLANA_USDC_MINT', mintAddress);
    writeEnvValue(ROOT_ENV_PATH, 'REACT_APP_SOLANA_USDC_MINT', mintAddress);
  }

  if (treasuryWallet) {
    writeEnvValue(BACKEND_ENV_PATH, 'SOLANA_TREASURY_WALLET', treasuryWallet);
  }
}

async function bootstrapLocalUsdcMint({
  connection,
  feePayer,
  treasuryWallet,
  initialSupplyUsdc = '1000000',
  decimals = 6,
  force = false
}) {
  if (!connection) throw new Error('A Solana connection is required');
  if (!feePayer) throw new Error('A fee payer signer is required');

  const web3 = require('@solana/web3.js');
  const token = require('@solana/spl-token');

  const existingMintAddress = getConfiguredMintAddress();
  const mintKeypair = web3.Keypair.generate();
  const mintAddress = existingMintAddress || mintKeypair.publicKey.toBase58();
  const mintPublicKey = new web3.PublicKey(mintAddress);
  const mintExists = Boolean(await connection.getAccountInfo(mintPublicKey));

  if (existingMintAddress && mintExists && !force) {
    const treasury = normalizeValue(treasuryWallet) || getConfiguredTreasuryWallet() || feePayer.publicKey.toBase58();
    persistMintConfiguration({ mintAddress: existingMintAddress, treasuryWallet: treasury });
    return {
      created: false,
      mintAddress: existingMintAddress,
      treasuryWallet: treasury,
      note: 'Mint already exists on-chain; env files were refreshed.'
    };
  }

  const mintSpace = token.getMintLen([]);
  const mintRent = await connection.getMinimumBalanceForRentExemption(mintSpace);
  const treasuryPublicKey = new web3.PublicKey(
    normalizeValue(treasuryWallet) || getConfiguredTreasuryWallet() || feePayer.publicKey.toBase58()
  );
  const donorPublicKey = feePayer.publicKey;

  const createMintAccountInstruction = web3.SystemProgram.createAccount({
    fromPubkey: feePayer.publicKey,
    newAccountPubkey: mintKeypair.publicKey,
    space: mintSpace,
    lamports: mintRent,
    programId: token.TOKEN_PROGRAM_ID
  });

  const initializeMintInstruction = token.createInitializeMintInstruction(
    mintKeypair.publicKey,
    decimals,
    feePayer.publicKey,
    feePayer.publicKey,
    token.TOKEN_PROGRAM_ID
  );

  const donorAta = token.getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    donorPublicKey,
    false,
    token.TOKEN_PROGRAM_ID,
    token.ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const treasuryAta = token.getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    treasuryPublicKey,
    false,
    token.TOKEN_PROGRAM_ID,
    token.ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const setupInstructions = [createMintAccountInstruction, initializeMintInstruction];

  const donorAtaInfo = await connection.getAccountInfo(donorAta);
  if (!donorAtaInfo) {
    setupInstructions.push(
      token.createAssociatedTokenAccountInstruction(
        feePayer.publicKey,
        donorAta,
        donorPublicKey,
        mintKeypair.publicKey,
        token.TOKEN_PROGRAM_ID,
        token.ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  if (treasuryAta.toBase58() !== donorAta.toBase58()) {
    const treasuryAtaInfo = await connection.getAccountInfo(treasuryAta);
    if (!treasuryAtaInfo) {
      setupInstructions.push(
        token.createAssociatedTokenAccountInstruction(
          feePayer.publicKey,
          treasuryAta,
          treasuryPublicKey,
          mintKeypair.publicKey,
          token.TOKEN_PROGRAM_ID,
          token.ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }
  }

  const initialSupplyBaseUnits = Number(BigInt(String(initialSupplyUsdc || '0')) * 1_000_000n);
  setupInstructions.push(
    token.createMintToCheckedInstruction(
      mintKeypair.publicKey,
      donorAta,
      feePayer.publicKey,
      initialSupplyBaseUnits,
      decimals,
      [],
      token.TOKEN_PROGRAM_ID
    )
  );

  await web3.sendAndConfirmTransaction(
    connection,
    new web3.Transaction().add(...setupInstructions),
    [feePayer, mintKeypair],
    { commitment: 'confirmed' }
  );

  persistMintConfiguration({
    mintAddress: mintKeypair.publicKey.toBase58(),
    treasuryWallet: treasuryPublicKey.toBase58()
  });

  return {
    created: true,
    mintAddress: mintKeypair.publicKey.toBase58(),
    treasuryWallet: treasuryPublicKey.toBase58(),
    donorAta: donorAta.toBase58(),
    treasuryAta: treasuryAta.toBase58(),
    decimals,
    initialSupplyBaseUnits,
    initialSupplyUsdc: String(initialSupplyUsdc)
  };
}

module.exports = {
  BACKEND_ENV_PATH,
  ROOT_ENV_PATH,
  bootstrapLocalUsdcMint,
  getConfiguredMintAddress,
  getConfiguredTreasuryWallet,
  persistMintConfiguration,
  readEnvValue,
  writeEnvValue
};