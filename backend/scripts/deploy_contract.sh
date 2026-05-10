#!/bin/bash
# Full deployment script for DonationReceipt contract
# Run inside the ResilientDB Docker container

set -e

echo "=== Step 1: Generate keys and certs ==="
./service/tools/kv/server_tools/generate_keys_and_certs.sh 2>&1 || echo "Keys may already exist, continuing..."
echo ""

echo "=== Step 2: Start KV service ==="
./service/tools/kv/server_tools/start_kv_service.sh &
KV_PID=$!
echo "KV service starting (PID: $KV_PID), waiting 10 seconds..."
sleep 10
echo "KV service should be ready now"
echo ""

echo "=== Step 3: Build contract tools (if needed) ==="
if [ ! -f "bazel-bin/service/tools/kv/api_tools/contract_service_tools" ]; then
  echo "Building contract_service_tools..."
  bazel build service/tools/kv/api_tools/contract_service_tools 2>&1
else
  echo "contract_service_tools already built"
fi
echo ""

echo "=== Step 4: Create owner account ==="
cat > /tmp/create_account.json << 'ENDJSON'
{
  "command": "create_account"
}
ENDJSON
echo "Running create_account..."
ACCOUNT_RESULT=$(bazel-bin/service/tools/kv/api_tools/contract_service_tools \
  -c service/tools/config/interface/service.config \
  --config_file=/tmp/create_account.json 2>&1)
echo "Account result: $ACCOUNT_RESULT"
echo "$ACCOUNT_RESULT" > /tmp/account_result.txt

# Extract address from the protobuf output
OWNER_ADDRESS=$(echo "$ACCOUNT_RESULT" | grep -oP 'address: "\K[^"]+' || echo "")
if [ -z "$OWNER_ADDRESS" ]; then
  echo "ERROR: Could not extract owner address"
  echo "Raw output: $ACCOUNT_RESULT"
  exit 1
fi
echo "Owner address: $OWNER_ADDRESS"
echo ""

echo "=== Step 5: Check for solc ==="
if command -v solc &> /dev/null; then
  SOLC_CMD="solc"
  echo "Found system solc"
elif [ -f "/usr/bin/solc" ]; then
  SOLC_CMD="/usr/bin/solc"
  echo "Found solc at /usr/bin/solc"
else
  echo "solc not found, attempting to install..."
  apt-get update -qq && apt-get install -y -qq solc 2>&1 || {
    echo "Failed to install solc via apt. Trying snap or npm..."
    npm install -g solc 2>&1 || {
      echo "ERROR: Cannot install solc. Using pre-compiled contract from example."
      SOLC_CMD=""
    }
  }
  SOLC_CMD=$(which solc 2>/dev/null || echo "")
fi
echo ""

echo "=== Step 6: Compile DonationReceipt contract ==="
if [ -n "$SOLC_CMD" ] && [ -f "/tmp/DonationReceipt.sol" ]; then
  echo "Compiling with solc..."
  $SOLC_CMD --evm-version homestead --combined-json bin,hashes --pretty-json --optimize /tmp/DonationReceipt.sol > /tmp/DonationReceipt.json 2>&1
  echo "Compiled successfully"
  cat /tmp/DonationReceipt.json
else
  echo "Using pre-existing example contract or manual compilation needed"
fi
echo ""

echo "=== Step 7: Deploy contract ==="
if [ -f "/tmp/DonationReceipt.json" ]; then
  cat > /tmp/deploy_contract.json << ENDJSON
{
  "command": "deploy",
  "contract_path": "/tmp/DonationReceipt.json",
  "contract_name": "DonationReceipt.sol:DonationReceipt",
  "init_params": "",
  "owner_address": "$OWNER_ADDRESS"
}
ENDJSON
  echo "Deploying contract..."
  DEPLOY_RESULT=$(bazel-bin/service/tools/kv/api_tools/contract_service_tools \
    -c service/tools/config/interface/service.config \
    --config_file=/tmp/deploy_contract.json 2>&1)
  echo "Deploy result: $DEPLOY_RESULT"
  
  CONTRACT_ADDRESS=$(echo "$DEPLOY_RESULT" | grep -oP 'contract_address: "\K[^"]+' || echo "")
  echo ""
  echo "============================================"
  echo "DEPLOYMENT COMPLETE"
  echo "============================================"
  echo "RESCONTRACT_OWNER_ADDRESS=$OWNER_ADDRESS"
  echo "RESCONTRACT_CONTRACT_ADDRESS=$CONTRACT_ADDRESS"
  echo "============================================"
else
  echo "ERROR: No compiled contract found at /tmp/DonationReceipt.json"
fi
