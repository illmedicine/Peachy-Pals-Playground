// =====================================================
// SQUARE PAYMENT WORKER — Deploy to Cloudflare Workers
// =====================================================
//
// This processes Square card payments for Peachy Pals Playland.
// It receives a card nonce from the website and charges it via Square API.
//
// SETUP (5 minutes):
// 1. Go to https://developer.squareup.com > Applications
// 2. Click your app > Credentials tab
// 3. Copy your "Access Token" (production) and paste below
// 4. Go to https://workers.cloudflare.com and sign up (free)
// 5. Click "Create a Worker"
// 6. Paste this entire file as the worker code
// 7. Click "Deploy"
// 8. Copy the worker URL (e.g. https://your-worker.username.workers.dev)
// 9. Paste that URL as squarePayEndpoint in your site's CONFIG
//
// TESTING: Use sandbox credentials first, then switch to production
// =====================================================

// ⚠️ PASTE YOUR ACCESS TOKEN ONLY HERE IN CLOUDFLARE — NEVER COMMIT IT TO GITHUB
const SQUARE_ACCESS_TOKEN = 'YOUR_SQUARE_ACCESS_TOKEN';

// Sandbox for testing, switch to production when ready:
// Sandbox: 'https://connect.squareupsandbox.com/v2/payments'
// Production: 'https://connect.squareup.com/v2/payments'
const SQUARE_API_URL = 'https://connect.squareupsandbox.com/v2/payments';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405, headers: CORS_HEADERS
      });
    }

    try {
      const { nonce, amount, currency, confirmationCode } = await request.json();

      if (!nonce || !amount) {
        return new Response(JSON.stringify({ error: 'Missing nonce or amount' }), {
          status: 400, headers: CORS_HEADERS
        });
      }

      const idempotencyKey = crypto.randomUUID();

      const squareResponse = await fetch(SQUARE_API_URL, {
        method: 'POST',
        headers: {
          'Square-Version': '2024-01-18',
          'Authorization': 'Bearer ' + SQUARE_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source_id: nonce,
          idempotency_key: idempotencyKey,
          amount_money: {
            amount: amount,  // in cents
            currency: currency || 'USD'
          },
          note: 'Peachy Pals Playland — ' + (confirmationCode || 'Deposit')
        })
      });

      const result = await squareResponse.json();

      if (!squareResponse.ok || result.errors) {
        const errMsg = result.errors?.[0]?.detail || 'Payment processing failed';
        return new Response(JSON.stringify({ error: errMsg }), {
          status: 400, headers: CORS_HEADERS
        });
      }

      return new Response(JSON.stringify({
        success: true,
        paymentId: result.payment?.id || ''
      }), { headers: CORS_HEADERS });

    } catch (err) {
      return new Response(JSON.stringify({ error: 'Server error: ' + err.message }), {
        status: 500, headers: CORS_HEADERS
      });
    }
  }
};
