const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * ResContract Client - Smart Contract integration for Charitap
 *
 * Calls ResilientDB's contract_service_tools via WSL subprocess to execute
 * functions on the deployed DonationReceipt contract.
 *
 * This works alongside (not replacing) the existing resilientdb-client.js
 * which handles raw ledger writes via the main GraphQL API.
 *
 * Prerequisites:
 *   1. ResilientDB KV service running in WSL (~/resilientdb)
 *   2. contract_service_tools built in WSL
 *   3. DonationReceipt contract deployed (addresses in .env)
 */
class ResContractClient {
    constructor() {
        this.enabled = process.env.RESCONTRACT_ENABLED === 'true';

        // Contract addresses from deployment
        this.ownerAddress = process.env.RESCONTRACT_OWNER_ADDRESS || '';
        this.contractAddress = process.env.RESCONTRACT_CONTRACT_ADDRESS || '';
        this.contractName = process.env.RESCONTRACT_CONTRACT_NAME || '/tmp/DonationReceipt.sol:DonationReceipt';

        // Don't crash the app if contract calls fail
        this.failSilently = process.env.RESCONTRACT_FAIL_SILENTLY !== 'false';

        // Paths inside WSL
        this.wslResdbDir = '~/resilientdb';
        this.wslTool = 'bazel-bin/service/tools/kv/api_tools/contract_service_tools';
        this.wslConfig = 'service/tools/config/interface/service.config';

        console.log(`[ResContract] Client initialized - ${this.enabled ? 'ENABLED (WSL mode)' : 'DISABLED'}`);
        if (this.enabled) {
            console.log(`[ResContract] Contract: ${this.contractAddress || '(not set)'}`);
        }
    }

    /**
     * Run a contract command via WSL subprocess.
     * Writes a JSON config to a temp file, calls contract_service_tools, parses output.
     *
     * @param {object} config - The JSON config for contract_service_tools
     * @returns {string|null} Raw output from the tool, or null on failure
     */
    _runContractTool(config) {
        if (!this.enabled) {
            console.log('[ResContract] Disabled - skipping contract call');
            return null;
        }

        try {
            // Write config JSON to a Windows temp file
            const tempFile = path.join(os.tmpdir(), `rescontract_${Date.now()}.json`);
            fs.writeFileSync(tempFile, JSON.stringify(config));

            // Convert Windows path to WSL path (e.g., C:\Users\... -> /mnt/c/Users/...)
            const wslTempPath = tempFile
                .replace(/\\/g, '/')
                .replace(/^([A-Z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`);

            // Build the WSL command
            const cmd = `wsl -e bash -c "cd ${this.wslResdbDir} && ${this.wslTool} -c ${this.wslConfig} --config_file=${wslTempPath} 2>&1"`;

            console.log(`[ResContract] Executing: ${config.command} ${config.function_name || ''}`);
            const output = execSync(cmd, { timeout: 20000, encoding: 'utf8' });

            // Clean up temp file
            try { fs.unlinkSync(tempFile); } catch (e) { /* ignore */ }

            console.log(`[ResContract] Raw output: ${output.trim().substring(0, 200)}`);
            return output;

        } catch (error) {
            console.error('[ResContract] ERROR:', error.message);
            if (!this.failSilently) throw error;
            return null;
        }
    }

    /**
     * Execute a function on the deployed DonationReceipt contract.
     *
     * @param {string} functionName - Function signature, e.g. "mintReceipt(uint256,uint256)"
     * @param {string} args - Comma-separated arguments, e.g. "3,250"
     * @returns {string|null} Execution result or null on failure
     */
    async executeContract(functionName, args) {
        if (!this.contractAddress || !this.ownerAddress) {
            console.warn('[ResContract] Missing contract or owner address.');
            return null;
        }

        const config = {
            command: 'execute',
            caller_address: this.ownerAddress,
            contract_address: this.contractAddress,
            func_name: functionName,
            params: args
        };

        const output = this._runContractTool(config);
        if (!output) return null;

        if (output.includes('execute contract fail')) {
            console.error('[ResContract] Execute failed. Output:', output.trim());
            return null;
        }

        // Try to extract result from the output
        const resultMatch = output.match(/result:\s*"?([^"\n]+)"?/i);
        return resultMatch ? resultMatch[1].trim() : output.trim();
    }

    /**
     * Mint a donation receipt on-chain.
     * Called after a successful Stripe transfer to a charity.
     *
     * @param {number|string} charityId - Numeric charity identifier
     * @param {number} amountCents - Donation amount in cents (e.g., 250 for $2.50)
     * @returns {Promise<string|null>} Contract execution result or null
     */
    async mintReceipt(charityId, amountCents) {
        const centsInt = Math.round(Number(amountCents));
        if (centsInt <= 0) {
            console.warn('[ResContract] Skipping receipt: amount must be positive');
            return null;
        }

        return this.executeContract(
            'mintReceipt(uint256,uint256)',
            `${charityId},${centsInt}`
        );
    }

    /**
     * Query the total donated to a charity (read-only).
     *
     * @param {number|string} charityId - Numeric charity identifier
     * @returns {Promise<string|null>} Total in cents or null
     */
    async getTotalByCharity(charityId) {
        return this.executeContract(
            'getTotalByCharity(uint256)',
            `${charityId}`
        );
    }

    /**
     * Check if the WSL ResilientDB service is reachable.
     *
     * @returns {Promise<boolean>}
     */
    async healthCheck() {
        if (!this.enabled) return false;

        try {
            const output = execSync(
                'wsl -e bash -c "ps aux | grep kv_service | grep -v grep | wc -l"',
                { timeout: 5000, encoding: 'utf8' }
            );
            const processCount = parseInt(output.trim());
            const healthy = processCount >= 5;
            console.log(`[ResContract] Health: ${healthy ? 'OK' : 'UNHEALTHY'} (${processCount} kv_service processes)`);
            return healthy;
        } catch (error) {
            console.error('[ResContract] Health check failed:', error.message);
            return false;
        }
    }
}

// Export singleton instance
module.exports = new ResContractClient();
