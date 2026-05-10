const fs = require('fs');
const { exec } = require('child_process');
const mongoose = require('mongoose');
const util = require('util');
const path = require('path');
const execPromise = util.promisify(exec);

// Paths
const ENV_PATH = path.join(__dirname, '.env');

// Main Recovery Script
async function recoverSmartContract() {
    console.log('\n🔧 Charitap Smart Contract Recovery');
    console.log('====================================');
    console.log('This script will:');
    console.log('1. Restart local ResilientDB service');
    console.log('2. Redeploy the DonationReceipt contract');
    console.log('3. Update .env with new Owner/Contract addresses');
    console.log('4. Clear old receipts from MongoDB');
    console.log('5. Backfill all transactions to the new contract');
    console.log('====================================\n');

    try {
        // --- Step 1: Restart Service & Deploy ---
        console.log('🔄 [1/5] Restarting Service & Deploying Contract (this takes ~30-60s)...');

        // Chain the scripts: Restart -> Deploy
        // Note: We use the deploy_local_contract.sh which compiles and deploys
        const cmd = 'wsl -e bash -c "bash /tmp/start_resdb.sh && bash ./deploy_local_contract.sh"';

        const { stdout, stderr } = await execPromise(cmd, { maxBuffer: 1024 * 1024 * 5 }); // 5MB buffer
        // console.log(stdout); // Verbose log if needed

        // --- Step 2: Parse Output ---
        console.log('✅ [2/5] Deployment Complete. Parsing addresses...');

        // Find Owner (first hash after ACCOUNT) or RESCONTRACT_OWNER_ADDRESS=...
        const ownerMatch = stdout.match(/RESCONTRACT_OWNER_ADDRESS=(0x[0-9a-fA-F]{40})/);
        const contractMatch = stdout.match(/RESCONTRACT_CONTRACT_ADDRESS=(0x[0-9a-fA-F]{40})/);

        if (!ownerMatch || !contractMatch) {
            console.error('❌ Failed to extract addresses from output.');
            console.log('Full Output:\n', stdout);
            process.exit(1);
        }

        const newOwner = ownerMatch[1];
        const newContract = contractMatch[1];

        console.log(`   Owner:    ${newOwner}`);
        console.log(`   Contract: ${newContract}`);

        // --- Step 3: Update .env ---
        console.log('📝 [3/5] Updating .env file...');
        let envContent = fs.readFileSync(ENV_PATH, 'utf8');

        // Replace or Append
        if (envContent.includes('RESCONTRACT_OWNER_ADDRESS=')) {
            envContent = envContent.replace(/RESCONTRACT_OWNER_ADDRESS=.*/g, `RESCONTRACT_OWNER_ADDRESS=${newOwner}`);
        } else {
            envContent += `\nRESCONTRACT_OWNER_ADDRESS=${newOwner}`;
        }

        if (envContent.includes('RESCONTRACT_CONTRACT_ADDRESS=')) {
            envContent = envContent.replace(/RESCONTRACT_CONTRACT_ADDRESS=.*/g, `RESCONTRACT_CONTRACT_ADDRESS=${newContract}`);
        } else {
            envContent += `\nRESCONTRACT_CONTRACT_ADDRESS=${newContract}`;
        }

        fs.writeFileSync(ENV_PATH, envContent);
        console.log('✅ .env updated.');

        // Update process.env for the rest of this script execution (and mongoose connection)
        process.env.RESCONTRACT_ENABLED = 'true';
        process.env.RESCONTRACT_OWNER_ADDRESS = newOwner;
        process.env.RESCONTRACT_CONTRACT_ADDRESS = newContract;

        // Reload dotenv to be safe
        require('dotenv').config({ override: true });

        // --- Step 4: Reset Receipts in DB ---
        console.log('🧹 [4/5] Clearing old receipt IDs from MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        const Transaction = require('./models/Transaction');

        // Only clear Valid transactions that were previously synced to a contract
        const result = await Transaction.updateMany(
            { contractReceiptId: { $ne: null } },
            { $unset: { contractReceiptId: "" } }
        );
        console.log(`✅ Cleared receipts from ${result.modifiedCount} transactions.`);

        // --- Step 5: Backfill ---
        console.log('📥 [5/5] Starting Backfill Process...');

        // We can spawn the backfill script to run in a fresh process with new env
        // Alternatively, since we updated process.env, we could require the logic directly.
        // Spawning is cleaner for isolation.

        const backfillCmd = `node backfill_smart_contract.js`;
        const child = require('child_process').spawn('node', ['backfill_smart_contract.js'], {
            stdio: 'inherit',
            shell: true
        });

        child.on('close', (code) => {
            mongoose.disconnect();
            if (code === 0) {
                console.log('\n🎉 RECOVERY COMPLETE! The system is back online.');
            } else {
                console.error('\n⚠️  Backfill script exited with error code:', code);
            }
        });

    } catch (err) {
        console.error('\n❌ RECOVERY FAILED:', err.message);
        if (err.stderr) console.error(err.stderr);
        if (mongoose.connection.readyState !== 0) mongoose.disconnect();
        process.exit(1);
    }
}

recoverSmartContract();
