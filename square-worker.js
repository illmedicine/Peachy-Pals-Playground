// =====================================================
// PEACHY PALS PLAYLAND — CLOUDFLARE WORKER
// Routes:
//   POST /           → process online card payment (Square Web SDK)
//   POST /webhook    → receive Square POS webhook events → reconcile to bookings
//   GET  /pos-sales  → proxy POS sales list to admin dashboard (enriched)
// Secrets (set via wrangler secret put):
//   SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, SQUARE_WEBHOOK_KEY
// =====================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (request.method === 'POST' && url.pathname === '/') {
      return handleOnlinePayment(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/webhook') {
      return handleWebhook(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/pos-sales') {
      return handlePosSalesFeed(request, env);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: CORS });
  }
};

// ─────────────────────────────────────────────────────────────────
// Online card payment
// ─────────────────────────────────────────────────────────────────
async function handleOnlinePayment(request, env) {
  try {
    const { nonce, amount, currency, confirmationCode } = await request.json();
    if (!nonce || !amount) return json({ error: 'Missing nonce or amount' }, 400);

    const res = await fetch(`${env.SQUARE_API_URL}/payments`, {
      method: 'POST',
      headers: squareHeaders(env),
      body: JSON.stringify({
        source_id: nonce,
        idempotency_key: crypto.randomUUID(),
        amount_money: { amount, currency: currency || 'USD' },
        location_id: env.SQUARE_LOCATION_ID,
        note: 'Peachy Pals Playland — ' + (confirmationCode || 'Deposit')
      })
    });

    const result = await res.json();
    if (!res.ok || result.errors) {
      return json({ error: result.errors?.[0]?.detail || 'Payment failed' }, 400);
    }
    return json({ success: true, paymentId: result.payment?.id || '' });
  } catch (err) {
    return json({ error: 'Server error: ' + err.message }, 500);
  }
}

// ─────────────────────────────────────────────────────────────────
// Square webhook — POS payment.completed events
// Tries to reconcile each payment to an existing booking
// ─────────────────────────────────────────────────────────────────
async function handleWebhook(request, env) {
  const body = await request.text();

  if (env.SQUARE_WEBHOOK_KEY) {
    const sig = request.headers.get('x-square-hmacsha256-signature') || '';
    const expected = await hmacSHA256(env.SQUARE_WEBHOOK_KEY, request.url + body);
    if (sig !== expected) return new Response('Unauthorized', { status: 401 });
  }

  let event;
  try { event = JSON.parse(body); } catch { return new Response('Bad JSON', { status: 400 }); }

  if (event.type !== 'payment.completed') return new Response('OK', { status: 200 });

  const payment = event.data?.object?.payment;
  if (!payment) return new Response('OK', { status: 200 });

  // Skip online deposits — they're already tracked via the app
  if ((payment.note || '').startsWith('Peachy Pals Playland —')) {
    return new Response('OK', { status: 200 });
  }

  // Try to match to a booking
  const match = await findMatchingBooking(payment, env.FIREBASE_DB_URL);

  const sale = {
    squarePaymentId: payment.id,
    createdAt:       payment.created_at,
    amountCents:     payment.amount_money?.amount || 0,
    currency:        payment.amount_money?.currency || 'USD',
    status:          payment.status,
    sourceType:      payment.source_type,
    cardBrand:       payment.card_details?.card?.card_brand || '',
    cardLast4:       payment.card_details?.card?.last_4 || '',
    note:            payment.note || '',
    receiptUrl:      payment.receipt_url || '',
    locationId:      payment.location_id || '',
    orderId:         payment.order_id || '',
    source:          'square_pos',
    // Reconciliation fields (null if unmatched)
    bookingId:       match?.bookingId || null,
    confirmationCode: match?.booking?.confirmationCode || null,
    customerName:    match ? `${match.booking.firstName || ''} ${match.booking.lastName || ''}`.trim() : null,
    bookingDate:     match?.booking?.date || null,
    packageName:     match?.booking?.packageName || null,
    bookingTotal:    match?.booking?.total || null,
    depositPaid:     match?.booking?.deposit || null
  };

  // Write pos_sale to Firebase
  const saleResp = await fetch(`${env.FIREBASE_DB_URL}/pos_sales.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sale)
  });
  const saleResult = await saleResp.json();
  const posSaleId = saleResult?.name;

  // If matched, patch the booking to record this in-person payment
  if (match?.bookingId && posSaleId) {
    await fetch(`${env.FIREBASE_DB_URL}/bookings/${match.bookingId}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        posSaleId: posSaleId,
        posAmountCents: sale.amountCents,
        posPaymentDate: sale.createdAt,
        posCardLast4:   sale.cardLast4,
        posReceiptUrl:  sale.receiptUrl,
        paidInFull:     isPaidInFull(match.booking, sale.amountCents)
      })
    });
  }

  return new Response('OK', { status: 200 });
}

// ─────────────────────────────────────────────────────────────────
// POS sales feed — enriched with booking data
// ─────────────────────────────────────────────────────────────────
async function handlePosSalesFeed(request, env) {
  try {
    const begin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch Square payments + Firebase bookings in parallel
    const [sqResp, fbResp] = await Promise.all([
      fetch(`${env.SQUARE_API_URL}/payments?location_id=${env.SQUARE_LOCATION_ID}&begin_time=${begin}&limit=200`, {
        headers: squareHeaders(env)
      }),
      fetch(`${env.FIREBASE_DB_URL}/bookings.json?orderBy="createdAt"&limitToLast=200`)
    ]);

    const sqData = await sqResp.json();
    if (!sqResp.ok) return json({ error: sqData.errors?.[0]?.detail || 'Square error' }, 400);

    // Build a lookup map: confirmationCode → booking
    const fbData = await fbResp.json();
    const bookingsByCode = {};
    const bookingsById = {};
    if (fbData && typeof fbData === 'object') {
      for (const [id, b] of Object.entries(fbData)) {
        bookingsById[id] = b;
        if (b.confirmationCode) bookingsByCode[b.confirmationCode.toUpperCase()] = { id, ...b };
      }
    }

    const payments = (sqData.payments || [])
      .filter(p => p.status === 'COMPLETED')
      .map(p => {
        const isOnlineDeposit = (p.note || '').startsWith('Peachy Pals Playland —');
        // Extract confirmation code from note if present
        const codeMatch = (p.note || '').match(/\bPP-[A-Z0-9]{4,8}\b/i);
        const matchedBooking = codeMatch ? bookingsByCode[codeMatch[0].toUpperCase()] : null;

        return {
          squarePaymentId: p.id,
          createdAt:   p.created_at,
          amountCents: p.amount_money?.amount || 0,
          currency:    p.amount_money?.currency || 'USD',
          sourceType:  p.source_type,
          cardBrand:   p.card_details?.card?.card_brand || '',
          cardLast4:   p.card_details?.card?.last_4 || '',
          note:        p.note || '',
          receiptUrl:  p.receipt_url || '',
          source:      isOnlineDeposit ? 'online_deposit' : 'square_pos',
          // Reconciliation
          bookingId:        matchedBooking?.id || null,
          confirmationCode: matchedBooking?.confirmationCode || null,
          customerName:     matchedBooking ? `${matchedBooking.firstName || ''} ${matchedBooking.lastName || ''}`.trim() : null,
          bookingDate:      matchedBooking?.date || null,
          packageName:      matchedBooking?.packageName || null,
          bookingTotal:     matchedBooking?.total || null,
          depositPaid:      matchedBooking?.deposit || null,
          posAmountCents:   matchedBooking?.posAmountCents || null,
          paidInFull:       matchedBooking?.paidInFull || false
        };
      });

    // Also pull pos_sales from Firebase (webhook-written records) so nothing is missed
    const fbSalesResp = await fetch(`${env.FIREBASE_DB_URL}/pos_sales.json?orderBy="createdAt"&limitToLast=200`);
    const fbSalesData = await fbSalesResp.json();
    const fbSaleIds = new Set();
    const fbSales = [];
    if (fbSalesData && typeof fbSalesData === 'object') {
      for (const [id, s] of Object.entries(fbSalesData)) {
        fbSaleIds.add(s.squarePaymentId);
        // Enrich with fresh booking data if we have it
        const booking = s.bookingId ? bookingsById[s.bookingId] : null;
        fbSales.push({
          ...s,
          fbSaleId: id,
          bookingTotal:  booking?.total || s.bookingTotal,
          depositPaid:   booking?.deposit || s.depositPaid,
          paidInFull:    booking?.paidInFull || s.paidInFull || false
        });
      }
    }

    // Merge: Square list is authoritative for amounts; FB records fill gaps
    const merged = [...payments];
    for (const s of fbSales) {
      if (!merged.some(p => p.squarePaymentId === s.squarePaymentId)) {
        merged.push(s);
      }
    }

    merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return json({ payments: merged });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ─────────────────────────────────────────────────────────────────
// Match a POS payment to a Firebase booking
// Checks: confirmation code in note, then name+date fuzzy match
// ─────────────────────────────────────────────────────────────────
async function findMatchingBooking(payment, firebaseDbUrl) {
  const note = (payment.note || '').toUpperCase();
  const payDate = payment.created_at ? payment.created_at.substring(0, 10) : '';

  // 1. Confirmation code in note
  const codeMatch = note.match(/\bPP-[A-Z0-9]{4,8}\b/);
  if (codeMatch) {
    const code = codeMatch[0];
    const resp = await fetch(
      `${firebaseDbUrl}/bookings.json?orderBy="confirmationCode"&equalTo="${code}"`
    );
    const data = await resp.json();
    if (data && typeof data === 'object') {
      const entries = Object.entries(data);
      if (entries.length > 0) {
        return { bookingId: entries[0][0], booking: entries[0][1] };
      }
    }
  }

  // 2. Same-day bookings — fetch by date and check name fragments in note
  if (payDate) {
    const resp = await fetch(
      `${firebaseDbUrl}/bookings.json?orderBy="date"&equalTo="${payDate}"`
    );
    const data = await resp.json();
    if (data && typeof data === 'object') {
      for (const [id, booking] of Object.entries(data)) {
        const firstName = (booking.firstName || '').toUpperCase();
        const lastName  = (booking.lastName  || '').toUpperCase();
        if (firstName && note.includes(firstName)) return { bookingId: id, booking };
        if (lastName  && note.includes(lastName))  return { bookingId: id, booking };
      }
    }
  }

  return null;
}

function isPaidInFull(booking, posAmountCents) {
  if (!booking?.total) return false;
  const depositCents = Math.round((booking.deposit || 0) * 100);
  const totalCents   = Math.round(booking.total * 100);
  return (depositCents + posAmountCents) >= totalCents;
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
function squareHeaders(env) {
  return {
    'Square-Version': '2024-01-18',
    'Authorization': 'Bearer ' + env.SQUARE_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

async function hmacSHA256(key, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
