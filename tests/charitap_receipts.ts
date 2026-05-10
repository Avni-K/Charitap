import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import assert from "assert";

describe("charitap_receipts", () => {
  function loadLocalWallet() {
    const walletPath = process.env.ANCHOR_WALLET || path.join(process.env.HOME || "", ".config", "solana", "id.json");
    const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf8")));
    return new anchor.Wallet(anchor.web3.Keypair.fromSecretKey(secretKey));
  }

  function createProvider() {
    const rpcUrl = process.env.ANCHOR_PROVIDER_URL || "http://127.0.0.1:8899";
    const connection = new anchor.web3.Connection(rpcUrl, "confirmed");
    return new anchor.AnchorProvider(connection, loadLocalWallet(), { commitment: "confirmed" });
  }

  anchor.setProvider(createProvider());

  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.CharitapReceipts as Program;

  function hash32(value: string): Buffer {
    return createHash("sha256").update(value).digest();
  }

  it("mints a receipt and updates charity totals", async () => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const receiptId = hash32(`transaction-${uniqueSuffix}`);
    const charityHash = hash32(`charity-${uniqueSuffix}`);
    const memoHash = hash32(`memo-${uniqueSuffix}`);

    const [receiptPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("receipt"), receiptId],
      program.programId
    );
    const [charityTotalPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("charity_total"), charityHash],
      program.programId
    );

    await program.methods
      .mintReceipt([...receiptId], [...charityHash], new anchor.BN(250), new anchor.BN(1710000000), [...memoHash], 0)
      .accounts({
        payer: provider.wallet.publicKey,
        receipt: receiptPda,
        charityTotal: charityTotalPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const receipt = await program.account.donationReceipt.fetch(receiptPda);
    const charityTotal = await program.account.charityTotal.fetch(charityTotalPda);

    assert.equal(receipt.amountCents.toNumber(), 250);
    assert.equal(charityTotal.totalCents.toNumber(), 250);
    assert.equal(charityTotal.receiptCount.toNumber(), 1);

    await assert.rejects(
      () => program.methods
        .mintReceipt([...receiptId], [...charityHash], new anchor.BN(250), new anchor.BN(1710000000), [...memoHash], 0)
        .accounts({
          payer: provider.wallet.publicKey,
          receipt: receiptPda,
          charityTotal: charityTotalPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc(),
      /already in use|custom program error|account/i
    );
  });
});
