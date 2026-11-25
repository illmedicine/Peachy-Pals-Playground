// =====================================================
// PEACHY PALS PLAYLAND — CLOUDFLARE WORKER
// Routes:
//   POST /               → process online card payment
//   POST /webhook        → Square POS webhook (payment.completed)
//   GET  /pos-sales      → POS sales list enriched with booking data
//   POST /play-session   → start a play timer session (admin)
//   GET  /play-sessions  → list active/recent sessions
//   PATCH /play-session/:id → extend or stop a session
// Cron: every 5 min → check for sessions expiring in ≤15 min → email alerts
// Secrets: SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, SQUARE_WEBHOOK_KEY
// =====================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export default {
  // ── HTTP handler ────────────────────────────────────
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (request.method === 'POST'  && url.pathname === '/')              return handleOnlinePayment(request, env);
    if (request.method === 'POST'  && url.pathname === '/webhook')       return handleWebhook(request, env);
    if (request.method === 'GET'   && url.pathname === '/pos-sales')     return handlePosSalesFeed(request, env);
    if (request.method === 'POST'  && url.pathname === '/play-session')  return handleStartSession(request, env);
    if (request.method === 'GET'   && url.pathname === '/play-sessions') return handleGetSessions(request, env);
    if (request.method === 'PATCH' && url.pathname.startsWith('/play-session/')) return handlePatchSession(request, env, url);

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: CORS });
  },

  // ── Cron handler (every 5 min) ───────────────────────
  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkExpiringSessions(env));
  }
};

// ─────────────────────────────────────────────────────────────────
// PLAY TIMER — start session
// ─────────────────────────────────────────────────────────────────
async function handleStartSession(request, env) {
  try {
    const body = await request.json();
    const { customerName, customerEmail, customerPhone, packageName,
            durationMinutes, bookingId, confirmationCode } = body;

    if (!customerName || !durationMinutes) return json({ error: 'Missing required fields' }, 400);

    const now = new Date();
    const endTime = new Date(now.getTime() + durationMinutes * 60 * 1000);

    const session = {
      customerName,
      customerEmail:   customerEmail || '',
      customerPhone:   customerPhone || '',
      packageName:     packageName || `${durationMinutes}-Minute Play Pass`,
      durationMinutes: durationMinutes,
      startTime:       now.toISOString(),
      endTime:         endTime.toISOString(),
      status:          'active',
      notified:        false,
      bookingId:       bookingId || null,
      confirmationCode: confirmationCode || null,
      createdAt:       now.toISOString()
    };

    const resp = await fetch(`${env.FIREBASE_DB_URL}/playSessions.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    });
    const result = await resp.json();
    return json({ success: true, sessionId: result.name, session });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ─────────────────────────────────────────────────────────────────
// PLAY TIMER — get active sessions
// ─────────────────────────────────────────────────────────────────
async function handleGetSessions(request, env) {
  try {
    const resp = await fetch(`${env.FIREBASE_DB_URL}/playSessions.json?orderBy="status"&equalTo="active"`);
    const data = await resp.json();
    const sessions = data
      ? Object.entries(data).map(([id, s]) => ({ id, ...s }))
      : [];
    // Also include sessions that expired in the last hour (for recent history)
    const recentResp = await fetch(`${env.FIREBASE_DB_URL}/playSessions.json?orderBy="createdAt"&limitToLast=50`);
    const recentData = await recentResp.json();
    const all = recentData
      ? Object.entries(recentData).map(([id, s]) => ({ id, ...s }))
      : [];
    return json({ sessions: all.reverse() });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ─────────────────────────────────────────────────────────────────
// PLAY TIMER — extend or stop session
// ─────────────────────────────────────────────────────────────────
async function handlePatchSession(request, env, url) {
  try {
    const id = url.pathname.split('/play-session/')[1];
    if (!id) return json({ error: 'Missing session id' }, 400);

    const body = await request.json();
    const { action, addMinutes } = body;

    // Get current session
    const resp = await fetch(`${env.FIREBASE_DB_URL}/playSessions/${id}.json`);
    const session = await resp.json();
    if (!session) return json({ error: 'Session not found' }, 404);

    let patch = {};

    if (action === 'extend') {
      const mins = addMinutes || 120;
      const newEnd = new Date(new Date(session.endTime).getTime() + mins * 60 * 1000);
      patch = { endTime: newEnd.toISOString(), status: 'active', notified: false };
    } else if (action === 'stop') {
      patch = { status: 'stopped', stoppedAt: new Date().toISOString() };
    } else if (action === 'expire') {
      patch = { status: 'expired', expiredAt: new Date().toISOString() };
    }

    await fetch(`${env.FIREBASE_DB_URL}/playSessions/${id}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });

    return json({ success: true, sessionId: id, patch });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ─────────────────────────────────────────────────────────────────
// CRON — check expiring sessions every 5 min
// ─────────────────────────────────────────────────────────────────
async function checkExpiringSessions(env) {
  const now = Date.now();
  const windowStart = now + 10 * 60 * 1000; // 10 min from now
  const windowEnd   = now + 20 * 60 * 1000; // 20 min from now

  const resp = await fetch(`${env.FIREBASE_DB_URL}/playSessions.json?orderBy="status"&equalTo="active"`);
  const data = await resp.json();
  if (!data) return;

  for (const [id, session] of Object.entries(data)) {
    const endMs = new Date(session.endTime).getTime();

    // Mark expired
    if (endMs < now) {
      await fetch(`${env.FIREBASE_DB_URL}/playSessions/${id}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'expired', expiredAt: new Date().toISOString() })
      });
      continue;
    }

    // Send 15-min warning (once per session)
    if (!session.notified && endMs >= windowStart && endMs <= windowEnd) {
      await sendExpirationNotifications(id, session, env);
      await fetch(`${env.FIREBASE_DB_URL}/playSessions/${id}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notified: true, notifiedAt: new Date().toISOString() })
      });
    }
  }
}

async function sendExpirationNotifications(sessionId, session, env) {
  const siteUrl  = env.SITE_URL || 'https://peachypalsplay.com';
  const extendUrl = `${siteUrl}/#booking?extend=1`;
  const minsLeft = Math.round((new Date(session.endTime) - new Date()) / 60000);

  // ── Email to customer ───────────────────────────────
  if (session.customerEmail) {
    const customerMsg = `Hi ${session.customerName.split(' ')[0]}!

Your ${session.packageName} at Peachy Pals Playland is almost up — you have about ${minsLeft} minutes left.

We hope the kids had a blast! 🍑

Want to keep the fun going? You can extend your session:

  👉 Book another 2-Hour Play Pass or Unlimited Play:
     ${extendUrl}

Just head to the front desk or book online and we'll get you set up!

See you again soon,
Cherish & the Peachy Pals Team
Peachy Pals Playland`;

    await sendEmail(env, {
      to:       session.customerEmail,
      replyto:  env.ADMIN_EMAIL,
      subject:  `⏰ Your play session ends in ~${minsLeft} min — extend your fun!`,
      fromName: 'Peachy Pals Playland',
      message:  customerMsg
    });
  }

  // ── Email to Cherish ────────────────────────────────
  const adminMsg = `⏰ PLAY SESSION EXPIRING SOON

Guest: ${session.customerName}
Package: ${session.packageName}
Time remaining: ~${minsLeft} minutes
Session ends: ${new Date(session.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })}
${session.customerEmail ? `Customer email: ${session.customerEmail}` : ''}
${session.customerPhone ? `Customer phone: ${session.customerPhone}` : ''}
${session.confirmationCode ? `Booking: ${session.confirmationCode}` : ''}

A reminder email has been sent to the customer with an extend link.
View all active sessions in Admin → Active Sessions.`;

  await sendEmail(env, {
    to:       env.ADMIN_EMAIL,
    subject:  `⏰ Play session expiring: ${session.customerName} (~${minsLeft} min left)`,
    fromName: 'Peachy Pals Playland',
    message:  adminMsg
  });
}

async function sendEmail(env, { to, subject, fromName, message, replyto }) {
  try {
    await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_key: env.WEB3FORMS_KEY,
        subject,
        from_name: fromName || 'Peachy Pals Playland',
        to,
        replyto: replyto || undefined,
        message
      })
    });
  } catch (e) {
    console.error('Email send failed:', e);
  }
}

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
// Square webhook — POS payment.completed
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
  if ((payment.note || '').startsWith('Peachy Pals Playland —')) return new Response('OK', { status: 200 });

  const match = await findMatchingBooking(payment, env.FIREBASE_DB_URL);

  const sale = {
    squarePaymentId:  payment.id,
    createdAt:        payment.created_at,
    amountCents:      payment.amount_money?.amount || 0,
    currency:         payment.amount_money?.currency || 'USD',
    status:           payment.status,
    sourceType:       payment.source_type,
    cardBrand:        payment.card_details?.card?.card_brand || '',
    cardLast4:        payment.card_details?.card?.last_4 || '',
    note:             payment.note || '',
    receiptUrl:       payment.receipt_url || '',
    locationId:       payment.location_id || '',
    orderId:          payment.order_id || '',
    source:           'square_pos',
    bookingId:        match?.bookingId || null,
    confirmationCode: match?.booking?.confirmationCode || null,
    customerName:     match ? `${match.booking.firstName || ''} ${match.booking.lastName || ''}`.trim() : null,
    bookingDate:      match?.booking?.date || null,
    packageName:      match?.booking?.packageName || null,
    bookingTotal:     match?.booking?.total || null,
    depositPaid:      match?.booking?.deposit || null
  };

  const saleResp = await fetch(`${env.FIREBASE_DB_URL}/pos_sales.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sale)
  });
  const saleResult = await saleResp.json();
  const posSaleId = saleResult?.name;

  if (match?.bookingId && posSaleId) {
    await fetch(`${env.FIREBASE_DB_URL}/bookings/${match.bookingId}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        posSaleId,
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
// POS sales feed — enriched
// ─────────────────────────────────────────────────────────────────
async function handlePosSalesFeed(request, env) {
  try {
    const begin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const [sqResp, fbResp] = await Promise.all([
      fetch(`${env.SQUARE_API_URL}/payments?location_id=${env.SQUARE_LOCATION_ID}&begin_time=${begin}&limit=200`, {
        headers: squareHeaders(env)
      }),
      fetch(`${env.FIREBASE_DB_URL}/bookings.json?orderBy="createdAt"&limitToLast=200`)
    ]);

    const sqData = await sqResp.json();
    if (!sqResp.ok) return json({ error: sqData.errors?.[0]?.detail || 'Square error' }, 400);

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

    const fbSalesResp = await fetch(`${env.FIREBASE_DB_URL}/pos_sales.json?orderBy="createdAt"&limitToLast=200`);
    const fbSalesData = await fbSalesResp.json();
    const fbSales = [];
    if (fbSalesData && typeof fbSalesData === 'object') {
      for (const [id, s] of Object.entries(fbSalesData)) {
        const booking = s.bookingId ? bookingsById[s.bookingId] : null;
        fbSales.push({
          ...s, fbSaleId: id,
          bookingTotal: booking?.total || s.bookingTotal,
          depositPaid:  booking?.deposit || s.depositPaid,
          paidInFull:   booking?.paidInFull || s.paidInFull || false
        });
      }
    }

    const merged = [...payments];
    for (const s of fbSales) {
      if (!merged.some(p => p.squarePaymentId === s.squarePaymentId)) merged.push(s);
    }
    merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return json({ payments: merged });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ─────────────────────────────────────────────────────────────────
// Booking match helpers
// ─────────────────────────────────────────────────────────────────
async function findMatchingBooking(payment, firebaseDbUrl) {
  const note = (payment.note || '').toUpperCase();
  const payDate = payment.created_at ? payment.created_at.substring(0, 10) : '';

  const codeMatch = note.match(/\bPP-[A-Z0-9]{4,8}\b/);
  if (codeMatch) {
    const resp = await fetch(`${firebaseDbUrl}/bookings.json?orderBy="confirmationCode"&equalTo="${codeMatch[0]}"`);
    const data = await resp.json();
    if (data && typeof data === 'object') {
      const entries = Object.entries(data);
      if (entries.length > 0) return { bookingId: entries[0][0], booking: entries[0][1] };
    }
  }

  if (payDate) {
    const resp = await fetch(`${firebaseDbUrl}/bookings.json?orderBy="date"&equalTo="${payDate}"`);
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
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
