#!/bin/bash

# --- CONFIGURATION ---
SERVER_URL="http://localhost:3000"
BOT_ID="15ea9753-53e2-4aff-ae6a-b76f0b5ff1c3"
USER_ID="user_3EFle2TUSC2FQX2vtK3vMc8lOsL"
# ---------------------

echo "=================================================="
echo "🚀 STEP 1: Checking Endpoint Health..."
echo "=================================================="
curl -X GET "$SERVER_URL/api/bot/execute"
echo -e "\n\n"

echo "=================================================="
echo "🤖 STEP 2: Activating the Bot..."
echo "=================================================="
START_RESP=$(curl -s -X POST "$SERVER_URL/api/bot/start" \
  -H "Content-Type: application/json" \
  -d "{\"bot_id\": \"$BOT_ID\", \"user_id\": \"$USER_ID\"}")
echo "$START_RESP"
echo -e "\n"

echo "=================================================="
echo "📈 STEP 3: Injecting Mock Trading Signal (R_75 CALL)..."
echo "=================================================="
EXEC_RESP=$(curl -s -X POST "$SERVER_URL/api/bot/execute" \
  -H "Content-Type: application/json" \
  -d "{
    \"bot_id\": \"$BOT_ID\",
    \"user_id\": \"$USER_ID\",
    \"symbol\": \"R_75\",
    \"contract_type\": \"CALL\",
    \"stake\": 1.00,
    \"duration\": 5
  }")
echo "$EXEC_RESP"
echo -e "\n"

echo "=================================================="
echo "🏁 Test Sequence Completed"
echo "=================================================="
