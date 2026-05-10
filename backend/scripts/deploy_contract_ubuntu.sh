#!/bin/bash
# ==============================================================
# Charitap - DonationReceipt Smart Contract Deployment
# ==============================================================
# SELF-CONTAINED: The Solidity contract is embedded below.
# Just copy this single file to Ubuntu and run it.
#
# Usage:
#   chmod +x deploy_contract_ubuntu.sh
#   ./deploy_contract_ubuntu.sh
# ==============================================================

set -e

RESDB_DIR="$HOME/resilientdb"

echo "============================================"
echo " Charitap Contract Deployment (Ubuntu)"
echo "============================================"
echo ""

# --- Embedded Contract ---
cat > /tmp/DonationReceipt.sol << 'SOLIDITY_EOF'
// SPDX-License-Identifier: MIT
pragma solidity >= 0.5.0;

contract DonationReceipt {
    struct Receipt {
        uint256 charityId;
        uint256 amountCents;
        uint256 timestamp;
        bool exists;
    }

    mapping(uint256 => Receipt) public receipts;
    mapping(uint256 => uint256) public totalByCharity;
    uint256 public receiptCount;

    event ReceiptMinted(uint256 indexed receiptId, uint256 indexed charityId, uint256 amountCents);

    function mintReceipt(uint256 _charityId, uint256 _amountCents) public {
        require(_amountCents > 0, "Amount must be positive");
        receiptCount = receiptCount + 1;
        receipts[receiptCount] = Receipt({
            charityId: _charityId,
            amountCents: _amountCents,
            timestamp: block.timestamp,
            exists: true
        });
        totalByCharity[_charityId] = totalByCharity[_charityId] + _amountCents;
        emit ReceiptMinted(receiptCount, _charityId, _amountCents);
    }

    function getReceipt(uint256 _receiptId) public view returns (
        uint256 charityId, uint256 amountCents, uint256 timestamp, bool exists
    ) {
        Receipt memory r = receipts[_receiptId];
        return (r.charityId, r.amountCents, r.timestamp, r.exists);
    }

    function getTotalByCharity(uint256 _charityId) public view returns (uint256) {
        return totalByCharity[_charityId];
    }
}
SOLIDITY_EOF
echo "Contract written to /tmp/DonationReceipt.sol"
echo ""

# --- Step 1: Clone & build ResilientDB ---
if [ ! -d "$RESDB_DIR" ]; then
  echo "[1/6] Cloning ResilientDB..."
  git clone https://github.com/apache/incubator-resilientdb.git "$RESDB_DIR"
  cd "$RESDB_DIR"
  echo "[1/6] Installing dependencies (this may take 15-20 min first time)..."
  ./INSTALL.sh
else
  echo "[1/6] ResilientDB already exists at $RESDB_DIR"
  cd "$RESDB_DIR"
fi
echo ""

# --- Step 2: Build contract_service_tools ---
echo "[2/6] Building contract_service_tools..."
if [ ! -f "bazel-bin/service/tools/kv/api_tools/contract_service_tools" ]; then
  bazel build service/tools/kv/api_tools/contract_service_tools 2>&1
else
  echo "Already built, skipping"
fi
echo "[2/6] Build complete"
echo ""

# --- Step 3: Start KV service ---
echo "[3/6] Starting KV service..."
killall -9 kv_service 2>/dev/null || true
sleep 1
./service/tools/kv/server_tools/start_kv_service.sh &
echo "[3/6] Waiting 15 seconds for service to initialize..."
sleep 15
echo "[3/6] KV service should be ready"
echo ""

# --- Step 4: Create owner account ---
echo "[4/6] Creating owner account..."
cat > /tmp/charitap_create_account.json << 'EOF'
{
  "command": "create_account"
}
EOF

ACCOUNT_OUTPUT=$(bazel-bin/service/tools/kv/api_tools/contract_service_tools \
  -c service/tools/config/interface/service.config \
  --config_file=/tmp/charitap_create_account.json 2>&1)

echo "Account output: $ACCOUNT_OUTPUT"

OWNER_ADDRESS=$(echo "$ACCOUNT_OUTPUT" | grep -oP '0x[0-9a-fA-F]+' | head -1 || echo "")
if [ -z "$OWNER_ADDRESS" ]; then
  echo ""
  echo "Could not auto-extract address. Please find it in the output above."
  read -p "Enter owner address (0x...): " OWNER_ADDRESS
fi
echo "[4/6] Owner address: $OWNER_ADDRESS"
echo ""

# --- Step 5: Compile the contract ---
echo "[5/6] Compiling DonationReceipt.sol..."
if ! command -v solc &> /dev/null; then
  echo "Installing solc..."
  sudo add-apt-repository -y ppa:ethereum/ethereum 2>/dev/null || true
  sudo apt-get update -qq
  sudo apt-get install -y solc
fi

solc --evm-version homestead --combined-json bin,hashes --pretty-json --optimize \
  /tmp/DonationReceipt.sol > /tmp/DonationReceipt.json 2>&1

echo "[5/6] Contract compiled"
echo ""

# --- Step 6: Deploy the contract ---
echo "[6/6] Deploying DonationReceipt contract..."
cat > /tmp/charitap_deploy.json << ENDJSON
{
  "command": "deploy",
  "contract_path": "/tmp/DonationReceipt.json",
  "contract_name": "DonationReceipt.sol:DonationReceipt",
  "init_params": "",
  "owner_address": "$OWNER_ADDRESS"
}
ENDJSON

DEPLOY_OUTPUT=$(bazel-bin/service/tools/kv/api_tools/contract_service_tools \
  -c service/tools/config/interface/service.config \
  --config_file=/tmp/charitap_deploy.json 2>&1)

echo "Deploy output: $DEPLOY_OUTPUT"

CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP '0x[0-9a-fA-F]+' | head -1 || echo "")

echo ""
echo "============================================"
echo " DEPLOYMENT COMPLETE"
echo "============================================"
echo ""
echo " Add these to your Charitap backend/.env:"
echo ""
echo "   RESCONTRACT_ENABLED=true"
echo "   RESCONTRACT_OWNER_ADDRESS=$OWNER_ADDRESS"
echo "   RESCONTRACT_CONTRACT_ADDRESS=$CONTRACT_ADDRESS"
echo ""
echo "============================================"
