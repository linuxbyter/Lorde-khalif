#!/usr/bin/env node
// scripts/test-deriv-connection.js

const https = require('https');

// Configuration - using the defaults you provided
const APP_ID = process.env.DERIV_APP_ID || '33mZdzOJ000s1hj182NFG';
const BEARER_TOKEN = process.env.DERIV_BEARER_TOKEN || 'pat_19981df3e902c7ce2b04a4cdf164a565682e41fba745d46b6751048e5d3c8281';
const ACCOUNT_ID = process.env.DERIV_ACCOUNT_ID || 'DOT92305340';

console.log(`
╔════════════════════════════════════════════════════════════╗
║           DERIV API CONNECTION TEST                        ║
╚════════════════════════════════════════════════════════════╝

Configuration:
- App ID: ${APP_ID}
- Bearer Token: ${BEARER_TOKEN.substring(0, 20)}...
- Account ID: ${ACCOUNT_ID}
- Is Demo: ${ACCOUNT_ID.startsWith('DOT') ? 'YES' : 'NO (REAL)'}
`);

console.log('\n📡 STEP 1: Testing REST API (Get OTP)...\n');

const options = {
  hostname: 'api.derivws.com',
  port: 443,
  path: `/trading/v1/options/accounts/${ACCOUNT_ID}/otp`,
  method: 'POST',
  headers: {
    'Deriv-App-ID': APP_ID,
    'Authorization': `Bearer ${BEARER_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': 0,
  },
};

const startTime = Date.now();

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    const elapsed = Date.now() - startTime;
    console.log(`\n✅ Response received in ${elapsed}ms`);
    console.log(`Status: ${res.statusCode}`);

    if (res.statusCode === 200) {
      try {
        const parsed = JSON.parse(data);
        console.log('\n✅ OTP Response (parsed):');
        console.log(JSON.stringify(parsed, null, 2));

        if (parsed.websocket_url) {
          console.log('\n✅ WebSocket URL found!');
          console.log(`
╔════════════════════════════════════════════════════════════╗
║ ✅ SUCCESS: REST API is working                            ║
╚════════════════════════════════════════════════════════════╝
          `);
        } else {
          console.log('\n❌ No websocket_url in response!');
        }
      } catch (e) {
        console.error('Error parsing JSON:', e.message);
      }
    } else {
      console.log('\n❌ Request failed');
      console.log('Response body:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ Network error:', error.message);
});

req.setTimeout(10000);
req.end();
