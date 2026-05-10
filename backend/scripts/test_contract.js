// Comprehensive test for contract execution via WSL
require('dotenv').config();

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const contractAddress = process.env.RESCONTRACT_CONTRACT_ADDRESS;
const ownerAddress = process.env.RESCONTRACT_OWNER_ADDRESS;
const contractName = process.env.RESCONTRACT_CONTRACT_NAME;

// Helper to execute a contract command
function executeResContract(commandName, funcName, params = '') {
    console.log(`\n=== Executing: ${funcName} ===`);

    // Create config JSON
    const config = {
        command: 'execute',
        caller_address: ownerAddress,
        contract_address: contractAddress,
        func_name: funcName,
        params: params
    };

    // Write config to temp file accessible by WSL
    // We use os.tmpdir() but need to convert to WSL path for the command
    // Actually, executed from Windows Node, os.tmpdir() is C:\...
    // We can write to a file in the current directory (d:\Masters\Charitap\backend) 
    // and reference it as /mnt/d/Masters/Charitap/backend/temp_config.json

    const tempFileName = `temp_exec_${Date.now()}.json`;
    const tempFilePath = path.join(__dirname, '..', tempFileName);
    fs.writeFileSync(tempFilePath, JSON.stringify(config, null, 2));

    const wslConfigPath = `/mnt/d/Masters/Charitap/backend/${tempFileName}`;
    const toolCmd = `bazel-bin/service/tools/kv/api_tools/contract_service_tools -c service/tools/config/interface/service.config --config_file=${wslConfigPath}`;

    const wslCmd = `wsl -e bash -c "cd ~/resilientdb && ${toolCmd}"`;

    try {
        console.log(`Running: ${wslCmd}`);
        const output = execSync(wslCmd, { encoding: 'utf8', stdio: 'pipe' });
        console.log("Output:", output);
        return output;
    } catch (error) {
        console.error("Execution Failed:", error.message);
        if (error.stdout) console.log("Stdout:", error.stdout.toString());
        if (error.stderr) console.log("Stderr:", error.stderr.toString());
        return null;
    } finally {
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    }
}

async function runTests() {
    if (!contractAddress || !ownerAddress) {
        console.error("Missing contract/owner address in .env");
        return;
    }

    // 1. Get initial count
    console.log("1. Getting initial receipt count...");
    executeResContract('execute', 'receiptCount()');

    // 2. Mint a receipt (charityId=123, amount=5000 cents)
    console.log("2. Minting receipt...");
    executeResContract('execute', 'mintReceipt(uint256,uint256)', '123,5000');

    // 3. Get new count
    console.log("3. Getting new receipt count...");
    executeResContract('execute', 'receiptCount()');

    // 4. Get the receipt details (receiptId 1, assuming it's the first or user can adjust)
    // Note: If previous tests ran, receiptId might be > 1.
    // We can't easily parse the return value here without regex, but the logs will show it.
    console.log("4. Getting receipt #1 details...");
    executeResContract('execute', 'getReceipt(uint256)', '1');
}

runTests();
