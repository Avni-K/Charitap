require('dotenv').config();
const resContract = require('./services/rescontract-client');
console.log(`[DEBUG] Loaded Env: ${process.env.RESCONTRACT_CONTRACT_ADDRESS}`);

async function inspectContract() {
    console.log('--- ResilientDB Smart Contract Inspector ---');
    console.log(`Contract: ${resContract.contractAddress}`);
    console.log('============================================');

    // 1. Get Total Receipt Count (need to deduce this or just scan)
    // The contract has public receiptCount, let's try to get it.
    // Solidity public variables create getter functions.
    // 'receiptCount()' should work.

    console.log("Reading global state...");
    let count = 0;
    try {
        const countHex = await resContract.executeContract("receiptCount()", "");
        count = parseInt(countHex, 16);
        console.log(`Total Receipts Minted: ${count}`);
    } catch (e) {
        console.log("Could not read receiptCount (maybe function signature mismatch?).");
    }

    if (count > 0) {
        console.log("\nLast 5 Receipts:");
        const start = Math.max(1, count - 4);
        for (let i = start; i <= count; i++) {
            try {
                // getReceipt returns (uint256 charityId, uint256 amountCents)
                // The raw output is likely a tuple or joined hex string
                const raw = await resContract.executeContract("getReceipt(uint256)", `${i}`);
                // Simplified parser: ResDB usually returns a comma-sep string or JSON-like structure
                // depending on the tool version. Based on logs, it returns hex values.
                // We might need to inspect the raw output to parse it perfectly.
                console.log(`  Receipt #${i}: ${raw}`);
            } catch (e) {
                console.log(`  Receipt #${i}: Error reading`);
            }
        }
    }

    console.log("\nSample Charity Totals (Charity IDs 123, 1, 0):");
    const testIds = [123, 1, 0];
    for (const id of testIds) {
        const totalHex = await resContract.getTotalByCharity(id);
        const total = parseInt(totalHex, 16);
        if (total > 0) {
            console.log(`  Charity ID ${id}: $${(total / 100).toFixed(2)} (${total} cents)`);
        }
    }
}

inspectContract();
