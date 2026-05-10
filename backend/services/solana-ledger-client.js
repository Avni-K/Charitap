const crypto = require('crypto');
const fs = require('fs');
const {
  getConfiguredMintAddress,
  getConfiguredTreasuryWallet,
  BACKEND_ENV_PATH,
  ROOT_ENV_PATH,
  readEnvValue
} = require('./solana-mint-bootstrap');

const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const DEFAULT_LOCAL_USDC_MINT = 'So11111111111111111111111111111111111111112';

function normalizeValue(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

class SolanaLedgerClient {
  constructor() {
    this.enabled = process.env.SOLANA_ENABLED === 'true';
    this.rpcUrl = process.env.SOLANA_RPC_URL || 'http://localhost:8899';
    this.wsUrl = process.env.SOLANA_WS_URL || 'ws://localhost:8900';
    this.programId = process.env.SOLANA_PROGRAM_ID || '';
    this.commitment = process.env.SOLANA_COMMITMENT || 'confirmed';
    this.failSilently = process.env.SOLANA_FAIL_SILENTLY !== 'false';
    this.allowUnverifiedLocalPayments = process.env.SOLANA_ALLOW_UNVERIFIED_LOCAL_PAYMENTS === 'true';

    this._web3 = null;
    this._splToken = null;
    this._bs58 = null;
    this._connection = null;
    this._feePayer = null;

    console.log(`[Solana] Client initialized - ${this.enabled ? 'ENABLED' : 'DISABLED'}`);
    if (this.enabled) {
      console.log(`[Solana] RPC Endpoint: ${this.rpcUrl}`);
    }
  }

  get usdcMint() {
    return (
      normalizeValue(process.env.SOLANA_USDC_MINT) ||
      normalizeValue(process.env.REACT_APP_SOLANA_USDC_MINT) ||
      getConfiguredMintAddress() ||
      readEnvValue(BACKEND_ENV_PATH, 'SOLANA_USDC_MINT') ||
      readEnvValue(ROOT_ENV_PATH, 'REACT_APP_SOLANA_USDC_MINT') ||
      DEFAULT_LOCAL_USDC_MINT
    );
  }

  get treasuryWallet() {
    return (
      normalizeValue(process.env.SOLANA_TREASURY_WALLET) ||
      getConfiguredTreasuryWallet() ||
      ''
    );
  }

  loadDeps() {
    if (this._web3) return true;
    try {
      this._web3 = require('@solana/web3.js');
      this._splToken = require('@solana/spl-token');
      const bs58Module = require('bs58');
      this._bs58 = bs58Module.default || bs58Module;
      return true;
    } catch (error) {
      console.warn(`[Solana] Optional dependencies unavailable: ${error.message}`);
      return false;
    }
  }

  get connection() {
    if (!this.loadDeps()) return null;
    if (!this._connection) {
      this._connection = new this._web3.Connection(this.rpcUrl, this.commitment);
    }
    return this._connection;
  }

  get feePayer() {
    if (!this.loadDeps()) return null;
    if (this._feePayer) return this._feePayer;

    const rawKeypair = process.env.SOLANA_FEE_PAYER_KEYPAIR;
    if (!rawKeypair) return null;

    try {
      const keypairText = rawKeypair.trim().startsWith('[')
        ? rawKeypair
        : fs.readFileSync(rawKeypair, 'utf8');
      const secret = Uint8Array.from(JSON.parse(keypairText));
      this._feePayer = this._web3.Keypair.fromSecretKey(secret);
      return this._feePayer;
    } catch (error) {
      console.error(`[Solana] Failed to load fee payer keypair: ${error.message}`);
      return null;
    }
  }

  hash(value) {
    return crypto.createHash('sha256').update(String(value || '')).digest('hex');
  }

  hashBuffer(value) {
    return crypto.createHash('sha256').update(String(value || '')).digest();
  }

  hashSensitiveData(value) {
    return this.hash(value).substring(0, 16);
  }

  dollarsToCents(amount) {
    return Math.round(Number(amount || 0) * 100);
  }

  centsToUsdcBaseUnits(cents) {
    return String(BigInt(Math.max(0, Number(cents || 0))) * 10000n);
  }

  buildReceiptPayload(input) {
    const amountCents = input.amountCents ?? this.dollarsToCents(input.amount);
    const timestamp = input.timestamp ? new Date(input.timestamp) : new Date();
    const charityId = String(input.charityId || 'unknown');

    return {
      version: 'charitap-solana-receipt-v1',
      transactionId: String(input.transactionId),
      userHash: this.hashSensitiveData(input.userEmail),
      charityId,
      charityHash: this.hash(charityId),
      amountCents,
      currency: input.currency || 'usd',
      paymentRail: input.paymentRail || 'stripe',
      timestamp: timestamp.toISOString(),
      status: input.status || 'settled',
      sourceHash: this.hash([
        input.stripeTransferId,
        input.stripePaymentIntentId,
        input.usdcSignature,
        input.transactionId
      ].filter(Boolean).join(':'))
    };
  }

  buildMemo(payload) {
    const canonical = JSON.stringify(payload);
    const memoHash = this.hash(canonical);
    const memo = [
      'charitap',
      'v1',
      payload.transactionId,
      payload.charityId,
      payload.amountCents,
      payload.currency,
      memoHash.substring(0, 24)
    ].join(':');

    return { memo, memoHash };
  }

  deriveReceiptId(payload) {
    return this.hash([
      payload.transactionId,
      payload.charityId,
      payload.amountCents,
      payload.currency,
      payload.timestamp
    ].join(':'));
  }

  derivePdas(receiptId, charityHash) {
    if (!this.loadDeps() || !this.programId) {
      return { receiptPda: null, charityTotalPda: null };
    }

    try {
      const programPublicKey = new this._web3.PublicKey(this.programId);
      const receiptSeed = Buffer.from(receiptId, 'hex');
      const charitySeed = Buffer.from(charityHash, 'hex');
      const [receiptPda] = this._web3.PublicKey.findProgramAddressSync(
        [Buffer.from('receipt'), receiptSeed],
        programPublicKey
      );
      const [charityTotalPda] = this._web3.PublicKey.findProgramAddressSync(
        [Buffer.from('charity_total'), charitySeed],
        programPublicKey
      );

      return {
        receiptPda: receiptPda.toBase58(),
        charityTotalPda: charityTotalPda.toBase58()
      };
    } catch (error) {
      console.error(`[Solana] PDA derivation failed: ${error.message}`);
      return { receiptPda: null, charityTotalPda: null };
    }
  }

  createMemoInstruction(memo) {
    const programId = new this._web3.PublicKey(MEMO_PROGRAM_ID);
    return new this._web3.TransactionInstruction({
      keys: [],
      programId,
      data: Buffer.from(memo, 'utf8')
    });
  }

  createMintReceiptInstruction({ payload, memoHash, receiptId, receiptPda, charityTotalPda }) {
    if (!this.programId || !receiptPda || !charityTotalPda) return null;

    const discriminator = crypto.createHash('sha256').update('global:mint_receipt').digest().subarray(0, 8);
    const amount = Buffer.alloc(8);
    amount.writeBigUInt64LE(BigInt(payload.amountCents));
    const timestamp = Buffer.alloc(8);
    timestamp.writeBigInt64LE(BigInt(Math.floor(new Date(payload.timestamp).getTime() / 1000)));
    const data = Buffer.concat([
      discriminator,
      Buffer.from(receiptId, 'hex'),
      Buffer.from(payload.charityHash, 'hex'),
      amount,
      timestamp,
      Buffer.from(memoHash, 'hex'),
      Buffer.from([payload.paymentRail === 'solana' ? 1 : 0])
    ]);

    return new this._web3.TransactionInstruction({
      programId: new this._web3.PublicKey(this.programId),
      keys: [
        { pubkey: this.feePayer.publicKey, isSigner: true, isWritable: true },
        { pubkey: new this._web3.PublicKey(receiptPda), isSigner: false, isWritable: true },
        { pubkey: new this._web3.PublicKey(charityTotalPda), isSigner: false, isWritable: true },
        { pubkey: this._web3.SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      data
    });
  }

  async recordReceipt(input) {
    const payload = this.buildReceiptPayload(input);
    const { memo, memoHash } = this.buildMemo(payload);
    const receiptId = this.deriveReceiptId(payload);
    const pdaData = this.derivePdas(receiptId, payload.charityHash);

    const baseResult = {
      enabled: this.enabled,
      memo,
      memoHash,
      receiptId,
      receiptPda: pdaData.receiptPda,
      charityTotalPda: pdaData.charityTotalPda,
      programId: this.programId || null,
      usdcMint: this.usdcMint,
      verified: false
    };

    if (!this.enabled) return baseResult;
    if (!this.loadDeps()) {
      return { ...baseResult, error: 'Solana dependencies are not installed' };
    }
    if (!this.feePayer) {
      return { ...baseResult, error: 'SOLANA_FEE_PAYER_KEYPAIR is not configured' };
    }

    try {
      const transaction = new this._web3.Transaction().add(this.createMemoInstruction(memo));
      const receiptInstruction = this.createMintReceiptInstruction({
        payload,
        memoHash,
        receiptId,
        receiptPda: pdaData.receiptPda,
        charityTotalPda: pdaData.charityTotalPda
      });
      if (receiptInstruction) transaction.add(receiptInstruction);

      const signature = await this._web3.sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.feePayer],
        { commitment: this.commitment }
      );

      return {
        ...baseResult,
        signature,
        verified: true,
        recordedAt: new Date()
      };
    } catch (error) {
      console.error(`[Solana] Receipt write failed: ${error.message}`);
      if (!this.failSilently) throw error;
      return { ...baseResult, error: error.message };
    }
  }

  async recordMemoOnly(input) {
    const payload = this.buildReceiptPayload(input);
    const { memo, memoHash } = this.buildMemo(payload);
    const baseResult = {
      enabled: this.enabled,
      memo,
      memoHash,
      receiptId: null,
      receiptPda: null,
      charityTotalPda: null,
      programId: this.programId || null,
      usdcMint: this.usdcMint,
      verified: false
    };

    if (!this.enabled) return baseResult;
    if (!this.loadDeps()) {
      return { ...baseResult, error: 'Solana dependencies are not installed' };
    }
    if (!this.feePayer) {
      return { ...baseResult, error: 'SOLANA_FEE_PAYER_KEYPAIR is not configured' };
    }

    try {
      const transaction = new this._web3.Transaction().add(this.createMemoInstruction(memo));
      const signature = await this._web3.sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.feePayer],
        { commitment: this.commitment }
      );
      return { ...baseResult, signature, verified: true, recordedAt: new Date() };
    } catch (error) {
      console.error(`[Solana] Memo write failed: ${error.message}`);
      if (!this.failSilently) throw error;
      return { ...baseResult, error: error.message };
    }
  }

  async verifyUsdcPayment({ signature, expectedRecipient, expectedAmountBaseUnits, expectedMemoHash }) {
    if (!this.enabled && !this.allowUnverifiedLocalPayments) {
      return { valid: false, error: 'Solana verification is disabled' };
    }
    if (this.allowUnverifiedLocalPayments) {
      return { valid: true, localBypass: true };
    }
    if (!this.loadDeps()) {
      return { valid: false, error: 'Solana dependencies are not installed' };
    }

    try {
      const tx = await this.connection.getParsedTransaction(signature, {
        commitment: this.commitment,
        maxSupportedTransactionVersion: 0
      });
      if (!tx) return { valid: false, error: 'Transaction not found' };

      const memoText = tx.transaction.message.instructions
        .filter(ix => ix.program === 'spl-memo' || ix.programId?.toBase58?.() === MEMO_PROGRAM_ID)
        .map(ix => ix.parsed || '')
        .join(';');

      if (expectedMemoHash && !memoText.includes(String(expectedMemoHash).substring(0, 24))) {
        return { valid: false, error: 'Memo hash mismatch' };
      }

      const tokenTransfers = tx.meta?.postTokenBalances || [];
      const mintMatches = tokenTransfers.some(balance => balance.mint === this.usdcMint);
      if (!mintMatches) return { valid: false, error: 'USDC mint not found in transaction balances' };

      if (expectedRecipient) {
        const recipientFound = JSON.stringify(tx).includes(expectedRecipient);
        if (!recipientFound) return { valid: false, error: 'Expected recipient not found' };
      }

      if (expectedAmountBaseUnits) {
        const amountFound = JSON.stringify(tx).includes(String(expectedAmountBaseUnits));
        if (!amountFound) return { valid: false, error: 'Expected amount not found' };
      }

      return { valid: true, transaction: tx };
    } catch (error) {
      console.error(`[Solana] Payment verification failed: ${error.message}`);
      return { valid: false, error: error.message };
    }
  }
}

module.exports = new SolanaLedgerClient();
