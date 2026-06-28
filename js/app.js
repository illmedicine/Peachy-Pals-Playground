/* ==========================================
   PEACHY PALS PLAYLAND — Application Logic
   ========================================== */

// ==========================================
// CONFIGURATION
// ==========================================
const CONFIG = {
  adminCode: '4931',
  depositPercent: 50,
  partyDuration: 2,
  maxCapacity: 24,
  hours: {
    // Mon=1..Sun=0
    0: { open: 11, close: 18 }, // Sunday
    1: { open: 10, close: 17 }, // Monday
    2: { open: 10, close: 17 }, // Tuesday
    3: { open: 10, close: 17 }, // Wednesday
    4: { open: 10, close: 17 }, // Thursday
    5: { open: 11, close: 18 }, // Friday
    6: { open: 11, close: 18 }  // Saturday
  },
  weekdayPriceDays: ['Tuesday', 'Wednesday', 'Thursday'],
  businessPhone: '(770) 387-1020',
  businessEmail: 'info@peachypalsplay.com',
  // EmailJS config — sign up free at emailjs.com, create a service + template
  emailjsPublicKey: '',   // paste your public key here
  emailjsServiceId: '',   // paste your service ID here
  emailjsTemplateId: '',  // paste your template ID here
  // Square — get these at developer.squareup.com > Applications
  squareAppId: '',          // paste your Square Application ID here
  squareLocationId: '',     // paste your Square Location ID here
  squarePayEndpoint: '',    // URL of your payment processing worker (see square-worker.js)
  // Payment handles — owner should update these
  paymentInfo: {
    paypal: { label: 'PayPal', handle: 'info@peachypalsplay.com', instructions: 'Send deposit to <strong>info@peachypalsplay.com</strong> via PayPal. Include your booking confirmation code in the note.' },
    venmo: { label: 'Venmo', handle: '@PeachyPals', instructions: 'Send deposit to <strong>@PeachyPals</strong> on Venmo. Include your booking confirmation code in the note.' },
    cashapp: { label: 'Cash App', handle: '$PeachyPals', instructions: 'Send deposit to <strong>$PeachyPals</strong> on Cash App. Include your booking confirmation code in the note.' },
    chime: { label: 'Chime', handle: 'Peachy Pals Playland', instructions: 'Send deposit via Chime Pay to <strong>Peachy Pals Playland</strong>. Include your booking confirmation code in the note.' },
    card: { label: 'Debit/Credit Card', handle: '', instructions: 'Card payment will be processed after booking confirmation. Our team will contact you within 24 hours to securely collect your card information via phone at <strong>(770) 387-1020</strong>.' }
  }
};

// ==========================================
// STATE
// ==========================================
let currentView = 'home';
let packages = [];
let selectedPackage = null;
let selectedDate = null;
let selectedTime = null;
let calendarMonth = new Date().getMonth();
let calendarYear = new Date().getFullYear();
let adminCalMonth = new Date().getMonth();
let adminCalYear = new Date().getFullYear();
let blockedDates = [];
let allBookings = [];
let isAdminLoggedIn = false;
let selectedMembershipPlan = null;
let dateBookings = [];

// ==========================================
// NAVIGATION & ROUTING
// ==========================================
function navigate(view) {
  window.location.hash = view;
}

function handleRoute() {
  const hash = window.location.hash.slice(1) || 'home';
  const validViews = ['home', 'packages', 'booking', 'manage', 'memberships', 'admin'];
  const view = validViews.includes(hash) ? hash : 'home';

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + view);
  if (el) el.classList.add('active');

  // Update nav active state
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.toggle('active', a.dataset.view === view);
  });

  currentView = view;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Load view-specific data
  if (view === 'packages') renderPackagesDetail();
  if (view === 'booking') { renderBookingPackages(); bookingStep(1); }
  if (view === 'memberships') { initMembershipView(); }
  if (view === 'admin' && !isAdminLoggedIn) showAdminLogin();
}

function scrollToId(id) {
  if (currentView !== 'home') {
    navigate('home');
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }, 400);
  } else {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}

// Mobile nav
function toggleMobileNav() {
  document.getElementById('mobileNav').classList.toggle('open');
  document.getElementById('mobileOverlay').classList.toggle('open');
}

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ==========================================
// MODAL
// ==========================================
function openModal(html) {
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

// ==========================================
// CONFETTI
// ==========================================
function launchConfetti() {
  const container = document.getElementById('confetti-container');
  const colors = ['#FF7043', '#26A69A', '#66BB6A', '#F48FB1', '#FFB300', '#42A5F5'];
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = (2 + Math.random() * 3) + 's';
    piece.style.animationDelay = Math.random() * 1.5 + 's';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    piece.style.width = (6 + Math.random() * 10) + 'px';
    piece.style.height = (6 + Math.random() * 10) + 'px';
    container.appendChild(piece);
  }
  setTimeout(() => { container.innerHTML = ''; }, 5000);
}

// ==========================================
// FLOATING LEAVES
// ==========================================
function initLeaves() {
  const container = document.getElementById('floatingLeaves');
  const leafEmojis = ['🍃', '🌿', '🍂', '🌱'];
  for (let i = 0; i < 15; i++) {
    const leaf = document.createElement('span');
    leaf.className = 'leaf';
    leaf.textContent = leafEmojis[Math.floor(Math.random() * leafEmojis.length)];
    leaf.style.left = Math.random() * 100 + '%';
    leaf.style.animationDuration = (8 + Math.random() * 12) + 's';
    leaf.style.animationDelay = Math.random() * 10 + 's';
    leaf.style.fontSize = (0.8 + Math.random() * 0.8) + 'rem';
    container.appendChild(leaf);
  }
}

// ==========================================
// SERVICES RENDERING (Homepage cards)
// ==========================================
let services = [];

async function renderServices() {
  try {
    services = await DataStore.getServices();
  } catch(e) {
    console.warn('Could not load services:', e);
    services = [];
  }
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;
  if (services.length === 0) {
    grid.innerHTML = renderFallbackServices();
    return;
  }
  grid.innerHTML = services.map(svc => {
    const imgStyle = svc.imageUrl ? `background-image: url('${escapeHtml(svc.imageUrl)}')` : 'background: var(--peach-light)';
    let btnHtml = '';
    if (svc.buttonText && svc.buttonAction) {
      if (svc.buttonAction.startsWith('mailto:') || svc.buttonAction.startsWith('http')) {
        btnHtml = `<a href="${escapeHtml(svc.buttonAction)}" ${svc.buttonAction.startsWith('http') ? 'target="_blank" rel="noopener"' : ''} class="btn ${svc.featured ? 'btn-primary' : 'btn-outline'} btn-sm">${escapeHtml(svc.buttonText)}</a>`;
      } else {
        btnHtml = `<button class="btn ${svc.featured ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="${escapeHtml(svc.buttonAction)}">${escapeHtml(svc.buttonText)}</button>`;
      }
    }
    return `
      <div class="svc-card ${svc.featured ? 'featured' : ''}">
        ${svc.featured ? '<div class="svc-badge">Most Popular</div>' : ''}
        <div class="svc-img" style="${imgStyle}"></div>
        <h3>${escapeHtml(svc.title)}</h3>
        ${svc.price ? `<div class="svc-price">${escapeHtml(svc.price)}${svc.priceNote ? '<small>' + escapeHtml(svc.priceNote) + '</small>' : ''}</div>` : ''}
        <p>${escapeHtml(svc.description || '')}</p>
        ${btnHtml}
      </div>
    `;
  }).join('');
}

function renderFallbackServices() {
  const fallback = [
    { title: "Open Play", price: "$12", priceNote: "/ 2 hours", description: "Flexible playtime in our indoor play space. $18 for unlimited play. Adults free. Grippy socks required.", imageUrl: "https://images.unsplash.com/photo-1566140967404-b8b3932483f5?w=600&h=300&fit=crop&auto=format" },
    { title: "Birthday Parties", price: "From $229", description: "Private party room, dedicated playtime, staff support & full cleanup.", imageUrl: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600&h=300&fit=crop&auto=format", featured: true, buttonText: "View Packages", buttonAction: "navigate('packages')" },
    { title: "Memberships", price: "From $55", priceNote: "/mo", description: "Unlimited visits! Monthly: $65/child. Annual: $55/child. +$20/mo per additional sibling.", imageUrl: "https://images.unsplash.com/photo-1587654780291-39c9404d7dd0?w=600&h=300&fit=crop&auto=format", buttonText: "View Memberships", buttonAction: "navigate('memberships')" },
    { title: "Field Trips", description: "Schools, daycares, camps & homeschool groups welcome for structured group play.", imageUrl: "https://images.unsplash.com/photo-1472162072942-cd5147eb3902?w=600&h=300&fit=crop&auto=format", buttonText: "Inquire Now", buttonAction: "mailto:info@peachypalsplay.com" },
    { title: "Balloon Bar", price: "From $3", description: "Helium fill-up $3–$5. Mini bundles from $15. Custom bouquets from $35. Characters from $10.", imageUrl: "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=600&h=300&fit=crop&auto=format" },
    { title: "Digital Waiver", description: "Complete once, play all year! Fast, easy, and good for 12 months.", imageUrl: "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=600&h=300&fit=crop&auto=format", buttonText: "Sign Waiver", buttonAction: "https://peachypals.pcsparty.com/sign/" }
  ];
  return fallback.map(svc => {
    let btnHtml = '';
    if (svc.buttonText && svc.buttonAction) {
      if (svc.buttonAction.startsWith('mailto:') || svc.buttonAction.startsWith('http')) {
        btnHtml = `<a href="${svc.buttonAction}" ${svc.buttonAction.startsWith('http') ? 'target="_blank" rel="noopener"' : ''} class="btn ${svc.featured ? 'btn-primary' : 'btn-outline'} btn-sm">${svc.buttonText}</a>`;
      } else {
        btnHtml = `<button class="btn ${svc.featured ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="${svc.buttonAction}">${svc.buttonText}</button>`;
      }
    }
    return `<div class="svc-card ${svc.featured ? 'featured' : ''}">${svc.featured ? '<div class="svc-badge">Most Popular</div>' : ''}<div class="svc-img" style="background-image:url('${svc.imageUrl}')"></div><h3>${svc.title}</h3>${svc.price ? `<div class="svc-price">${svc.price}${svc.priceNote ? '<small>' + svc.priceNote + '</small>' : ''}</div>` : ''}<p>${svc.description}</p>${btnHtml}</div>`;
  }).join('');
}

// ==========================================
// PACKAGES RENDERING
// ==========================================
function renderPackageCard(pkg, selectable = false) {
  const imgStyle = pkg.imageUrl
    ? `background-image: url('${escapeHtml(pkg.imageUrl)}'); background-color: var(--peach-light);`
    : 'background: linear-gradient(135deg, var(--peach-light), var(--teal-light));';

  const includesHtml = (pkg.includes || []).map(item =>
    `<li>${escapeHtml(item)}</li>`
  ).join('');

  return `
    <div class="pkg-card ${selectable ? 'selectable' : ''} ${selectedPackage?.id === pkg.id ? 'selected' : ''}"
         ${selectable ? `onclick="selectPackage('${pkg.id}')"` : ''}>
      <div class="pkg-card-img" style="${imgStyle}">
        ${pkg.subtitle ? `<div class="pkg-card-badge">${escapeHtml(pkg.subtitle)}</div>` : ''}
      </div>
      <div class="pkg-card-body">
        <h3>${escapeHtml(pkg.name)}</h3>
        ${pkg.subtitle ? `<div class="pkg-card-subtitle">${escapeHtml(pkg.subtitle)}</div>` : ''}
        <p>${escapeHtml(pkg.description || '')}</p>
        <div class="pkg-card-price">${pkg.weekendPrice && pkg.weekendPrice !== pkg.price ? 'From $' + pkg.price : '$' + pkg.price}<small> ${pkg.maxGuests ? '/ up to ' + pkg.maxGuests + ' guests' : ''}</small></div>
        ${pkg.weekendPrice && pkg.weekendPrice !== pkg.price ? `<div class="pkg-card-rates"><span>Tue–Thu: $${pkg.price}</span> <span>Wknd/Mon: $${pkg.weekendPrice}</span></div>` : ''}
        ${includesHtml ? `<ul class="pkg-card-includes">${includesHtml}</ul>` : ''}
        ${(pkg.addOns || []).length > 0 ? `<div class="pkg-card-addons"><span class="pkg-addons-label">Add-ons available:</span> ${pkg.addOns.map(a => `<span class="pkg-addon-tag">${escapeHtml(a.name)} +$${a.price}</span>`).join(' ')}</div>` : ''}
      </div>
      <div class="pkg-card-footer">
        ${selectable
          ? `<button class="btn ${selectedPackage?.id === pkg.id ? 'btn-success' : 'btn-primary'} btn-sm" onclick="event.stopPropagation(); selectPackage('${pkg.id}')">
               ${selectedPackage?.id === pkg.id ? '✓ Selected' : 'Select This Package'}
             </button>`
          : `<button class="btn btn-primary btn-sm" onclick="selectPackageAndBook('${pkg.id}')">Book This Package</button>`
        }
      </div>
    </div>
  `;
}

async function renderHomePackages() {
  packages = await DataStore.getPackages();
  const grid = document.getElementById('homePackagesGrid');
  if (!grid) return;
  grid.innerHTML = packages.filter(p => p.active !== false).map(p => renderPackageCard(p, false)).join('');
}

async function renderPackagesDetail() {
  packages = await DataStore.getPackages();
  const grid = document.getElementById('packagesDetailGrid');
  if (!grid) return;
  grid.innerHTML = packages.filter(p => p.active !== false).map(p => renderPackageCard(p, false)).join('');
}

async function renderBookingPackages() {
  packages = await DataStore.getPackages();
  const grid = document.getElementById('bookingPackagesGrid');
  if (!grid) return;
  grid.innerHTML = packages.filter(p => p.active !== false).map(p => renderPackageCard(p, true)).join('');
}

function selectPackage(pkgId) {
  selectedPackage = packages.find(p => p.id === pkgId);
  renderBookingPackages();
  if (selectedPackage) {
    setTimeout(() => bookingStep(2), 300);
  }
}

function selectPackageAndBook(pkgId) {
  selectedPackage = packages.find(p => p.id === pkgId);
  navigate('booking');
  setTimeout(() => {
    renderBookingPackages();
    if (selectedPackage) bookingStep(2);
  }, 400);
}

// ==========================================
// BOOKING WIZARD
// ==========================================
function bookingStep(step) {
  // Validate step transitions
  if (step === 2 && !selectedPackage) {
    showToast('Please select a package first', 'error');
    return;
  }
  if (step === 3 && (!selectedDate || !selectedTime)) {
    showToast('Please select a date and time', 'error');
    return;
  }

  // Update step indicators
  document.querySelectorAll('.steps-bar .step').forEach(s => {
    const sn = parseInt(s.dataset.step);
    s.classList.remove('active', 'done');
    if (sn < step) s.classList.add('done');
    if (sn === step) s.classList.add('active');
  });

  // Show current step
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById('bookStep' + i);
    if (el) el.classList.toggle('active', i === step);
  }

  // Step-specific initialization
  if (step === 2) initCalendar();
  if (step === 3) renderBookingAddOns();
  if (step === 4) renderPaymentSummary();
}

function validateAndGoStep4() {
  const fields = ['bkFirstName', 'bkLastName', 'bkPhone', 'bkChildName', 'bkChildAge', 'bkNumKids'];
  for (const fid of fields) {
    const el = document.getElementById(fid);
    if (!el.value.trim()) {
      el.focus();
      showToast('Please fill in all required fields', 'error');
      return;
    }
  }

  const numKids = parseInt(document.getElementById('bkNumKids').value) || 0;
  const pkgDuration = getPackageDuration(selectedPackage);
  const remaining = getSlotCapacity(selectedTime, pkgDuration, dateBookings);
  if (numKids > remaining) {
    const next = findNextAvailableSlot(selectedDate, selectedTime, numKids, selectedPackage);
    let msg = `This time slot only has ${remaining} of ${CONFIG.maxCapacity} spots available, but your party has ${numKids} children.`;
    if (next) {
      msg += ` The next available slot is ${next.label}. Would you like to switch?`;
      openModal(`
        <h2><i class="fas fa-exclamation-triangle" style="color:var(--peach)"></i> Capacity Limit Reached</h2>
        <p style="margin:1rem 0">${msg}</p>
        <div style="display:flex;gap:1rem;margin-top:1.5rem;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="selectTime('${next.value}');closeModal();showToast('Switched to ${next.label}','success')">
            <i class="fas fa-clock"></i> Switch to ${next.label}
          </button>
          <button class="btn btn-outline" onclick="closeModal()">Go Back</button>
        </div>
      `);
    } else {
      msg += ' Unfortunately, no other time slots are available on this date with enough capacity. Please try a different date.';
      showToast(msg, 'error');
    }
    return;
  }

  if (numKids > CONFIG.maxCapacity) {
    showToast(`Maximum facility capacity is ${CONFIG.maxCapacity} children per time slot.`, 'error');
    return;
  }

  bookingStep(4);
}

function renderBookingAddOns() {
  const pkg = selectedPackage;
  const section = document.getElementById('addOnsSection');
  const list = document.getElementById('addOnsList');
  const addOns = pkg?.addOns || [];
  if (addOns.length === 0) {
    section.style.display = 'none';
    list.innerHTML = '';
    return;
  }
  section.style.display = 'block';
  list.innerHTML = addOns.map((a, i) => `
    <div class="addon-select-item" data-index="${i}">
      <label class="addon-select-check">
        <input type="checkbox" class="bk-addon-cb" data-index="${i}" data-name="${escapeHtml(a.name)}" data-price="${a.price}" onchange="toggleAddonQty(${i})">
      </label>
      <span class="addon-select-name">${escapeHtml(a.name)}</span>
      <div class="addon-qty-wrap" id="addonQty_${i}" style="display:none">
        <button type="button" class="addon-qty-btn" onclick="changeAddonQty(${i},-1)">-</button>
        <input type="number" class="addon-qty-input" id="addonQtyVal_${i}" value="1" min="1" max="${a.maxQty || 99}" onchange="clampAddonQty(${i})">
        <button type="button" class="addon-qty-btn" onclick="changeAddonQty(${i},1)">+</button>
      </div>
      <span class="addon-select-price">$${a.price.toFixed(2)}<small>/ea</small></span>
    </div>
  `).join('');
}

function toggleAddonQty(idx) {
  const cb = document.querySelector(`.bk-addon-cb[data-index="${idx}"]`);
  const qtyWrap = document.getElementById('addonQty_' + idx);
  qtyWrap.style.display = cb.checked ? 'flex' : 'none';
  if (cb.checked) document.getElementById('addonQtyVal_' + idx).value = 1;
}

function changeAddonQty(idx, delta) {
  const input = document.getElementById('addonQtyVal_' + idx);
  const max = parseInt(input.max) || 99;
  let val = parseInt(input.value) || 1;
  val = Math.max(1, Math.min(max, val + delta));
  input.value = val;
}

function clampAddonQty(idx) {
  const input = document.getElementById('addonQtyVal_' + idx);
  const max = parseInt(input.max) || 99;
  let val = parseInt(input.value) || 1;
  input.value = Math.max(1, Math.min(max, val));
}

function getSelectedAddOns() {
  const checked = document.querySelectorAll('.bk-addon-cb:checked');
  return Array.from(checked).map(cb => {
    const idx = cb.dataset.index;
    const qty = parseInt(document.getElementById('addonQtyVal_' + idx)?.value) || 1;
    return {
      name: cb.dataset.name,
      unitPrice: parseFloat(cb.dataset.price),
      quantity: qty,
      price: parseFloat(cb.dataset.price) * qty
    };
  });
}

function getAddOnsTotal() {
  return getSelectedAddOns().reduce((sum, a) => sum + a.price, 0);
}

function renderPaymentSummary() {
  const pkg = selectedPackage;
  const basePrice = getPriceForDate(pkg, selectedDate);
  const rateType = isWeekdayRate(selectedDate) ? 'Tue–Thu rate' : 'Weekend/Mon rate';
  const numKids = parseInt(document.getElementById('bkNumKids').value) || 0;
  const extraKids = Math.max(0, numKids - (pkg.maxGuests || 0));
  const extraFee = extraKids * (pkg.extraGuestFee || 0);
  const selectedAddOns = getSelectedAddOns();
  const addOnsTotal = selectedAddOns.reduce((sum, a) => sum + a.price, 0);
  const total = basePrice + extraFee + addOnsTotal;
  const deposit = Math.ceil(total * CONFIG.depositPercent / 100);

  const addOnsHtml = selectedAddOns.map(a =>
    `<tr><td style="padding-left:1rem;color:var(--gray)">+ ${escapeHtml(a.name)}${a.quantity > 1 ? ' x' + a.quantity : ''}</td><td>+$${a.price.toFixed(2)}</td></tr>`
  ).join('');

  document.getElementById('paymentSummary').innerHTML = `
    <h3 style="margin-bottom:1rem">Booking Summary</h3>
    <table style="width:100%;font-size:0.95rem">
      <tr><td><strong>Package:</strong></td><td>${escapeHtml(pkg.name)}</td></tr>
      <tr><td><strong>Date:</strong></td><td>${formatDateDisplay(selectedDate)}</td></tr>
      <tr><td><strong>Time:</strong></td><td>${selectedTime}</td></tr>
      <tr><td><strong>Rate:</strong></td><td>${rateType} — $${basePrice} base</td></tr>
      <tr><td><strong>Guest:</strong></td><td>${escapeHtml(document.getElementById('bkChildName').value)}</td></tr>
      <tr><td><strong>Kids:</strong></td><td>${numKids}</td></tr>
      ${extraKids > 0 ? `<tr><td><strong>Extra kids (${extraKids}):</strong></td><td>+$${extraFee}</td></tr>` : ''}
      ${addOnsHtml ? `<tr><td><strong>Add-ons:</strong></td><td></td></tr>${addOnsHtml}` : ''}
      <tr><td colspan="2"><hr style="margin:0.5rem 0"></td></tr>
      <tr><td><strong>Total:</strong></td><td style="font-size:1.3rem;font-weight:900;color:var(--peach-dark)">$${total.toFixed(2)}</td></tr>
      <tr><td><strong>Deposit (${CONFIG.depositPercent}%):</strong></td><td style="font-size:1.2rem;font-weight:900;color:var(--teal-dark)">$${deposit}</td></tr>
    </table>
  `;

  document.querySelectorAll('input[name="payMethod"]').forEach(radio => {
    radio.addEventListener('change', function() {
      const info = CONFIG.paymentInfo[this.value];
      document.getElementById('paymentInstructions').innerHTML = info ? info.instructions : '';
    });
  });
}

async function submitBooking() {
  const payMethod = document.querySelector('input[name="payMethod"]:checked');

  const pkg = selectedPackage;
  const basePrice = getPriceForDate(pkg, selectedDate);
  const numKids = parseInt(document.getElementById('bkNumKids').value) || 0;
  const extraKids = Math.max(0, numKids - (pkg.maxGuests || 0));
  const selectedAddOns = getSelectedAddOns();
  const addOnsTotal = selectedAddOns.reduce((sum, a) => sum + a.price, 0);
  const total = basePrice + extraKids * (pkg.extraGuestFee || 0) + addOnsTotal;
  const deposit = Math.ceil(total * CONFIG.depositPercent / 100);
  const pkgDuration = getPackageDuration(pkg);

  const booking = {
    firstName: document.getElementById('bkFirstName').value.trim(),
    lastName: document.getElementById('bkLastName').value.trim(),
    phone: document.getElementById('bkPhone').value.trim(),
    email: document.getElementById('bkEmail').value.trim(),
    childName: document.getElementById('bkChildName').value.trim(),
    childAge: parseInt(document.getElementById('bkChildAge').value) || 0,
    packageId: pkg.id,
    packageName: pkg.name,
    date: selectedDate,
    timeSlot: selectedTime,
    bookingStartHour: timeToHour(selectedTime),
    bookingDuration: pkgDuration,
    numberOfKids: numKids,
    numberOfAdults: parseInt(document.getElementById('bkNumAdults').value) || 0,
    specialRequests: document.getElementById('bkRequests').value.trim(),
    addOns: selectedAddOns,
    addOnsTotal: addOnsTotal,
    status: 'pending',
    depositPaid: false,
    depositAmount: deposit,
    totalPrice: total,
    paymentMethod: payMethod ? payMethod.value : 'pay-later'
  };

  try {
    const result = await DataStore.createBooking(booking);
    launchConfetti();
    showToast('Booking created successfully!', 'success');

    const payLabel = payMethod ? (CONFIG.paymentInfo[payMethod.value]?.label || payMethod.value) : 'Pay Later';

    document.getElementById('confirmationBox').innerHTML = `
      <div style="font-size:4rem;margin-bottom:1rem">🎉</div>
      <h2>Booking Confirmed!</h2>
      <p style="color:var(--gray);margin-bottom:1rem">Your party booking has been received. Here's your confirmation code:</p>
      <div class="confirmation-code">${result.confirmationCode}</div>
      <div style="text-align:left;margin:1.5rem 0;padding:1rem;background:var(--cream);border-radius:var(--radius)">
        <p><strong>Package:</strong> ${escapeHtml(pkg.name)} (${pkgDuration}h)</p>
        <p><strong>Date:</strong> ${formatDateDisplay(selectedDate)}</p>
        <p><strong>Time:</strong> ${selectedTime}</p>
        <p><strong>Child:</strong> ${escapeHtml(booking.childName)} (Age ${booking.childAge})</p>
        <p><strong>Total:</strong> $${total.toFixed(2)} | <strong>Deposit Due:</strong> $${deposit}</p>
        <p><strong>Payment:</strong> ${payLabel}</p>
      </div>
      ${!booking.depositPaid ? `
        <div style="margin:1rem 0;padding:1rem;background:var(--cream2);border-radius:var(--radius);border:2px solid var(--peach-light)">
          <p style="font-weight:700;margin-bottom:0.5rem"><i class="fas fa-credit-card" style="color:var(--peach)"></i> Pay Your Deposit ($${deposit})</p>
          <p style="font-size:0.85rem;color:var(--gray);margin-bottom:0.75rem">You can pay now or anytime before your party via Manage Booking.</p>
          <div id="squarePayConfirm"></div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">
            ${CONFIG.paymentInfo.venmo ? `<a href="https://venmo.com/${CONFIG.paymentInfo.venmo.handle.replace('@','')}?txn=pay&amount=${deposit}&note=${encodeURIComponent('Peachy Pals ' + result.confirmationCode)}" target="_blank" class="btn btn-outline btn-sm"><i class="fab fa-vimeo-v"></i> Venmo $${deposit}</a>` : ''}
            ${CONFIG.paymentInfo.cashapp ? `<a href="https://cash.app/${CONFIG.paymentInfo.cashapp.handle}/$${ deposit}" target="_blank" class="btn btn-outline btn-sm"><i class="fas fa-dollar-sign"></i> Cash App $${deposit}</a>` : ''}
          </div>
        </div>
      ` : ''}
      <p style="color:var(--gray);font-size:0.9rem;margin-bottom:1.5rem">
        Save your confirmation code! Use your <strong>phone number</strong> and <strong>last name</strong> to manage your booking anytime.
      </p>
      <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="navigate('home')"><i class="fas fa-home"></i> Back Home</button>
        <button class="btn btn-secondary" onclick="navigate('manage')"><i class="fas fa-clipboard-list"></i> Manage Booking</button>
      </div>
    `;
    bookingStep(5);

    // Render PayPal button if configured
    renderSquarePayButton('squarePayConfirm', deposit, result.confirmationCode, result.id || booking.id);

    // Send email notification
    sendBookingEmail(booking, result.confirmationCode, total, deposit);

    resetBookingForm();
  } catch (err) {
    console.error('Booking error:', err);
    showToast('Error creating booking. Please try again.', 'error');
  }
}

function resetBookingForm() {
  selectedPackage = null;
  selectedDate = null;
  selectedTime = null;
  ['bkFirstName', 'bkLastName', 'bkPhone', 'bkEmail', 'bkChildName', 'bkChildAge', 'bkNumKids', 'bkNumAdults', 'bkRequests'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = id === 'bkNumAdults' ? '0' : '';
  });
}

// ==========================================
// SCHEDULING & CAPACITY
// ==========================================
function isDayAvailable(pkg, dayName) {
  if (!pkg || !pkg.availableDays) return true;
  const days = Array.isArray(pkg.availableDays) ? pkg.availableDays : Object.values(pkg.availableDays);
  if (days.length === 0) return true;
  if (days.includes(dayName)) return true;
  return days.some(d => typeof d === 'string' && d.includes(dayName));
}

function formatHourToTime(h) {
  const hour = Math.floor(h);
  const min = Math.round((h % 1) * 60);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
  return `${h12}:${String(min).padStart(2, '0')} ${ampm}`;
}

function timeToHour(timeStr) {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h + m / 60;
}

function getPackageDuration(pkg) {
  if (!pkg || !pkg.duration) return CONFIG.partyDuration;
  const match = pkg.duration.match(/(\d+)/);
  return match ? parseInt(match[1]) : CONFIG.partyDuration;
}

function getTimeSlotsForDate(dateStr, pkg) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayOfWeek = date.getDay();
  const hours = CONFIG.hours[dayOfWeek];
  const duration = getPackageDuration(pkg);
  const buffer = 0.5;
  const slots = [];
  let t = hours.open;
  while (t + duration <= hours.close) {
    const endH = t + duration;
    slots.push({
      value: formatHourToTime(t),
      label: formatHourToTime(t) + ' – ' + formatHourToTime(endH),
      startHour: t,
      duration: duration
    });
    t += duration + buffer;
  }
  return slots;
}

function getSlotCapacity(slotValue, slotDuration, bookings) {
  const slotStart = timeToHour(slotValue);
  const slotEnd = slotStart + slotDuration;
  let booked = 0;
  for (const b of bookings) {
    if (b.status === 'cancelled') continue;
    const bStart = b.bookingStartHour != null ? b.bookingStartHour : timeToHour(b.timeSlot);
    const bDuration = b.bookingDuration || CONFIG.partyDuration;
    const bEnd = bStart + bDuration;
    if (slotStart < bEnd && bStart < slotEnd) {
      booked += (b.numberOfKids || 0);
    }
  }
  return CONFIG.maxCapacity - booked;
}

function getDayName(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
}

function getPriceForDate(pkg, dateStr) {
  if (CONFIG.weekdayPriceDays.includes(getDayName(dateStr))) return pkg.price;
  return pkg.weekendPrice || pkg.price;
}

function isWeekdayRate(dateStr) {
  return CONFIG.weekdayPriceDays.includes(getDayName(dateStr));
}

function findNextAvailableSlot(dateStr, afterSlotValue, partySize, pkg) {
  const slots = getTimeSlotsForDate(dateStr, pkg);
  const blocked = blockedDates.find(b => b.date === dateStr);
  const blockedSlots = blocked?.blockedSlots || [];
  const duration = getPackageDuration(pkg);
  let pastCurrent = false;
  for (const slot of slots) {
    if (slot.value === afterSlotValue) { pastCurrent = true; continue; }
    if (!pastCurrent) continue;
    if (blockedSlots.includes(slot.value)) continue;
    const remaining = getSlotCapacity(slot.value, duration, dateBookings);
    if (remaining >= partySize) return slot;
  }
  return null;
}

// ==========================================
// CALENDAR
// ==========================================
async function initCalendar() {
  blockedDates = await DataStore.getBlockedDates();
  renderCalendar();
}

function calendarNav(dir) {
  calendarMonth += dir;
  if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
  if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
  renderCalendar();
}

function renderCalendar() {
  const grid = document.getElementById('calGrid');
  const monthLabel = document.getElementById('calMonth');
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  monthLabel.textContent = months[calendarMonth] + ' ' + calendarYear;

  const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let html = '';
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-day empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(calendarYear, calendarMonth, d);
    const dateStr = formatDate(date);
    const isPast = date < today;
    const isToday = date.getTime() === today.getTime();
    const isBlocked = blockedDates.some(b => b.date === dateStr && b.blocked);
    const isSelected = selectedDate === dateStr;

    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
    const pkgAvailable = isDayAvailable(selectedPackage, dayName);

    const classes = ['cal-day'];
    if (isPast || !pkgAvailable) classes.push('disabled');
    if (isToday) classes.push('today');
    if (isBlocked) classes.push('blocked');
    if (isSelected) classes.push('selected');

    const clickable = !isPast && !isBlocked && pkgAvailable;
    html += `<div class="${classes.join(' ')}" ${clickable ? `onclick="selectDate('${dateStr}')"` : ''}>${d}</div>`;
  }

  grid.innerHTML = html;
}

async function selectDate(dateStr) {
  selectedDate = dateStr;
  selectedTime = null;
  renderCalendar();
  try {
    dateBookings = await DataStore.getBookingsByDate(dateStr);
  } catch (err) {
    console.warn('Could not load bookings for date:', err);
    dateBookings = [];
  }
  renderTimeSlots();

  const rateLabel = isWeekdayRate(dateStr) ? '' : ' (weekend rate)';
  document.getElementById('selectedDateLabel').textContent = formatDateDisplay(dateStr) + rateLabel;
  document.getElementById('btnToStep3').disabled = true;
}

function renderTimeSlots() {
  const grid = document.getElementById('timeSlotsGrid');
  if (!selectedDate) { grid.innerHTML = ''; return; }

  const pkgDuration = getPackageDuration(selectedPackage);
  const slots = getTimeSlotsForDate(selectedDate, selectedPackage);
  const blocked = blockedDates.find(b => b.date === selectedDate);
  const blockedSlots = blocked?.blockedSlots || [];

  grid.innerHTML = slots.map(slot => {
    const isBlocked = blockedSlots.includes(slot.value);
    const remaining = getSlotCapacity(slot.value, pkgDuration, dateBookings);
    const isFull = remaining <= 0;
    const isSelected = selectedTime === slot.value;
    const disabled = isBlocked || isFull;

    let capacityHtml = '';
    if (isBlocked) {
      capacityHtml = '<span class="slot-capacity full">Unavailable</span>';
    } else if (isFull) {
      capacityHtml = '<span class="slot-capacity full">Full (0 of ' + CONFIG.maxCapacity + ')</span>';
    } else if (remaining < CONFIG.maxCapacity) {
      capacityHtml = '<span class="slot-capacity limited">' + remaining + ' of ' + CONFIG.maxCapacity + ' spots left</span>';
    } else {
      capacityHtml = '<span class="slot-capacity open">' + remaining + ' spots available</span>';
    }

    return `<div class="time-slot ${disabled ? 'disabled' : ''} ${isSelected ? 'selected' : ''}"
                 ${!disabled ? `onclick="selectTime('${slot.value}')"` : ''}>
              <span class="slot-time">${slot.label}</span>
              ${capacityHtml}
            </div>`;
  }).join('');
}

function selectTime(slot) {
  selectedTime = slot;
  renderTimeSlots();
  document.getElementById('btnToStep3').disabled = false;
}

// ==========================================
// MANAGE BOOKING
// ==========================================
async function lookupBooking() {
  const lastName = document.getElementById('lookupLastName').value.trim();
  const phone = document.getElementById('lookupPhone').value.trim();
  if (!lastName || !phone) {
    showToast('Please enter both last name and phone number', 'error');
    return;
  }

  const resultsDiv = document.getElementById('lookupResults');
  const editDiv = document.getElementById('editBookingBox');
  editDiv.style.display = 'none';

  try {
    const bookings = await DataStore.findBookings(phone, lastName);
    if (bookings.length === 0) {
      resultsDiv.style.display = 'block';
      resultsDiv.innerHTML = `
        <div class="no-bookings-msg">
          <div style="font-size:3rem;margin-bottom:1rem">🔍</div>
          <p>No bookings found for <strong>${escapeHtml(lastName)}</strong> with phone <strong>${escapeHtml(phone)}</strong>.</p>
          <p style="margin-top:0.5rem">Double-check your info or <a href="#booking" onclick="navigate('booking')">create a new booking</a>.</p>
        </div>`;
      return;
    }

    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = `<h2 style="margin-bottom:1rem">Your Bookings (${bookings.length})</h2>` +
      bookings.map(b => renderBookingCard(b, false)).join('');
  } catch (err) {
    console.error('Lookup error:', err);
    showToast('Error looking up bookings. Please try again.', 'error');
  }
}

function renderBookingCard(b, isAdmin) {
  const statusClass = `status-${b.status || 'pending'}`;
  const cardClass = b.status || 'pending';
  return `
    <div class="booking-result-card ${cardClass}">
      <div class="booking-result-header">
        <h3>${escapeHtml(b.packageName || 'Party')}</h3>
        <span class="booking-status ${statusClass}">${b.status || 'pending'}</span>
      </div>
      <dl class="booking-detail-grid">
        <dt>Confirmation:</dt><dd>${b.confirmationCode || 'N/A'}</dd>
        <dt>Date:</dt><dd>${formatDateDisplay(b.date)}</dd>
        <dt>Time:</dt><dd>${b.timeSlot || 'N/A'}</dd>
        <dt>Child:</dt><dd>${escapeHtml(b.childName || '')} (Age ${b.childAge || ''})</dd>
        <dt>Kids:</dt><dd>${b.numberOfKids || 0}</dd>
        <dt>Adults:</dt><dd>${b.numberOfAdults || 0}</dd>
        <dt>Total:</dt><dd>$${b.totalPrice || 0}</dd>
        <dt>Deposit:</dt><dd>$${b.depositAmount || 0} (${b.depositPaid ? '✅ Paid' : '⏳ Pending'})</dd>
        <dt>Payment:</dt><dd>${CONFIG.paymentInfo[b.paymentMethod]?.label || b.paymentMethod || 'N/A'}</dd>
        ${b.specialRequests ? `<dt>Requests:</dt><dd>${escapeHtml(b.specialRequests)}</dd>` : ''}
      </dl>
      ${!b.depositPaid && b.status !== 'cancelled' && !isAdmin ? `
        <div class="booking-pay-section">
          <p style="font-weight:700;font-size:0.9rem;margin-bottom:0.5rem"><i class="fas fa-credit-card" style="color:var(--peach)"></i> Pay Deposit — $${b.depositAmount || 0}</p>
          <div id="squarePay_${b.id}"></div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">
            <a href="https://venmo.com/${(CONFIG.paymentInfo.venmo?.handle || '').replace('@','')}?txn=pay&amount=${b.depositAmount}&note=${encodeURIComponent('Peachy Pals ' + (b.confirmationCode || ''))}" target="_blank" class="btn btn-outline btn-sm"><i class="fab fa-vimeo-v"></i> Venmo</a>
            <a href="https://cash.app/${CONFIG.paymentInfo.cashapp?.handle || ''}/${b.depositAmount}" target="_blank" class="btn btn-outline btn-sm"><i class="fas fa-dollar-sign"></i> Cash App</a>
          </div>
        </div>
      ` : ''}
      <div class="booking-actions">
        ${b.status !== 'cancelled' ? `
          <button class="btn btn-outline btn-sm" onclick="editBooking('${b.id}', ${isAdmin})"><i class="fas fa-edit"></i> Edit</button>
          <button class="btn btn-danger btn-sm" onclick="cancelBooking('${b.id}', ${isAdmin})"><i class="fas fa-times"></i> Cancel</button>
        ` : ''}
        ${isAdmin ? `
          ${b.status === 'pending' ? `<button class="btn btn-success btn-sm" onclick="confirmBookingAdmin('${b.id}')"><i class="fas fa-check"></i> Confirm</button>` : ''}
          ${!b.depositPaid ? `<button class="btn btn-primary btn-sm" onclick="markDepositPaid('${b.id}')"><i class="fas fa-dollar-sign"></i> Mark Paid</button>` : ''}
          <button class="btn btn-danger btn-sm" onclick="deleteBookingAdmin('${b.id}')"><i class="fas fa-trash"></i> Delete</button>
        ` : ''}
      </div>
    </div>
  `;
}

async function editBooking(bookingId, isAdmin) {
  let bookings;
  if (isAdmin) {
    bookings = allBookings;
  } else {
    const lastName = document.getElementById('lookupLastName').value.trim();
    const phone = document.getElementById('lookupPhone').value.trim();
    bookings = await DataStore.findBookings(phone, lastName);
  }
  const booking = bookings.find(b => b.id === bookingId);
  if (!booking) return;

  const editHtml = `
    <h2 style="margin-bottom:1rem"><i class="fas fa-edit"></i> Edit Booking</h2>
    <form onsubmit="return false">
      <div class="form-row">
        <div class="form-group"><label>Date</label><input type="date" id="editDate" value="${booking.date}"></div>
        <div class="form-group"><label>Time</label>
          <select id="editTime">
            ${CONFIG.timeSlots.map(s => `<option value="${s}" ${s === booking.timeSlot ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Number of Kids</label><input type="number" id="editNumKids" value="${booking.numberOfKids}" min="1"></div>
        <div class="form-group"><label>Number of Adults</label><input type="number" id="editNumAdults" value="${booking.numberOfAdults}" min="0"></div>
      </div>
      <div class="form-group"><label>Special Requests</label><textarea id="editRequests" rows="3">${escapeHtml(booking.specialRequests || '')}</textarea></div>
      <div style="display:flex;gap:1rem;margin-top:1rem">
        <button class="btn btn-primary" onclick="saveBookingEdit('${bookingId}', ${isAdmin})"><i class="fas fa-save"></i> Save Changes</button>
        <button class="btn btn-outline" onclick="cancelEdit(${isAdmin})">Cancel</button>
      </div>
    </form>
  `;

  if (isAdmin) {
    openModal(editHtml);
  } else {
    const editDiv = document.getElementById('editBookingBox');
    editDiv.innerHTML = editHtml;
    editDiv.style.display = 'block';
    editDiv.scrollIntoView({ behavior: 'smooth' });
  }
}

async function saveBookingEdit(bookingId, isAdmin) {
  const data = {
    date: document.getElementById('editDate').value,
    timeSlot: document.getElementById('editTime').value,
    numberOfKids: parseInt(document.getElementById('editNumKids').value) || 1,
    numberOfAdults: parseInt(document.getElementById('editNumAdults').value) || 0,
    specialRequests: document.getElementById('editRequests').value.trim()
  };

  try {
    await DataStore.updateBooking(bookingId, data);
    showToast('Booking updated successfully!', 'success');
    if (isAdmin) {
      closeModal();
      loadAdminBookings();
    } else {
      document.getElementById('editBookingBox').style.display = 'none';
      lookupBooking();
    }
  } catch (err) {
    console.error('Update error:', err);
    showToast('Error updating booking.', 'error');
  }
}

function cancelEdit(isAdmin) {
  if (isAdmin) closeModal();
  else document.getElementById('editBookingBox').style.display = 'none';
}

async function cancelBooking(bookingId, isAdmin) {
  if (!confirm('Are you sure you want to cancel this booking?')) return;
  try {
    await DataStore.updateBooking(bookingId, { status: 'cancelled' });
    showToast('Booking cancelled.', 'info');
    if (isAdmin) loadAdminBookings();
    else lookupBooking();
  } catch (err) {
    showToast('Error cancelling booking.', 'error');
  }
}

// ==========================================
// ADMIN PORTAL
// ==========================================
function showAdminLogin() {
  document.getElementById('adminLogin').style.display = 'flex';
  document.getElementById('adminDashboard').style.display = 'none';
  document.getElementById('adminError').style.display = 'none';
  ['adminPin1', 'adminPin2', 'adminPin3', 'adminPin4'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('adminPin1').focus();
}

function pinNext(el, idx) {
  if (el.value.length === 1 && idx < 4) {
    document.getElementById('adminPin' + (idx + 1)).focus();
  }
  if (idx === 4 && el.value.length === 1) adminLogin();
}

function pinBack(e, el, idx) {
  if (e.key === 'Backspace' && el.value === '' && idx > 1) {
    document.getElementById('adminPin' + (idx - 1)).focus();
  }
}

function adminLogin() {
  const code = ['adminPin1', 'adminPin2', 'adminPin3', 'adminPin4'].map(id => document.getElementById(id).value).join('');
  if (code === CONFIG.adminCode) {
    isAdminLoggedIn = true;
    document.getElementById('adminLogin').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';
    loadAdminBookings();
    loadAdminPackages();
    showToast('Welcome, Admin!', 'success');
  } else {
    document.getElementById('adminError').style.display = 'block';
    ['adminPin1', 'adminPin2', 'adminPin3', 'adminPin4'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('adminPin1').focus();
  }
}

function adminLogout() {
  isAdminLoggedIn = false;
  navigate('home');
  showToast('Logged out', 'info');
}

function adminSwitchTab(tabId) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.toggle('active', p.id === tabId));
  if (tabId === 'adminBookings') loadAdminBookings();
  if (tabId === 'adminPackages') loadAdminPackages();
  if (tabId === 'adminServices') loadAdminServices();
  if (tabId === 'adminAvailability') initAdminCalendar();
}

// Admin: Bookings
async function loadAdminBookings() {
  allBookings = await DataStore.getAllBookings();
  const filter = document.getElementById('adminBookingFilter').value;
  const filtered = filter === 'all' ? allBookings : allBookings.filter(b => b.status === filter);

  // Stats
  const total = allBookings.length;
  const pending = allBookings.filter(b => b.status === 'pending').length;
  const confirmed = allBookings.filter(b => b.status === 'confirmed').length;
  const revenue = allBookings.filter(b => b.depositPaid).reduce((sum, b) => sum + (b.depositAmount || 0), 0);

  document.getElementById('adminStats').innerHTML = `
    <div class="stat-card"><div class="stat-num">${total}</div><div class="stat-label">Total Bookings</div></div>
    <div class="stat-card"><div class="stat-num">${pending}</div><div class="stat-label">Pending</div></div>
    <div class="stat-card"><div class="stat-num">${confirmed}</div><div class="stat-label">Confirmed</div></div>
    <div class="stat-card"><div class="stat-num">$${revenue}</div><div class="stat-label">Deposits Collected</div></div>
  `;

  const list = document.getElementById('adminBookingsList');
  if (filtered.length === 0) {
    list.innerHTML = '<div class="no-bookings-msg">No bookings found.</div>';
    return;
  }
  list.innerHTML = filtered.map(b => renderBookingCard(b, true)).join('');
}

async function confirmBookingAdmin(id) {
  await DataStore.updateBooking(id, { status: 'confirmed' });
  showToast('Booking confirmed!', 'success');
  loadAdminBookings();
}

async function markDepositPaid(id) {
  await DataStore.updateBooking(id, { depositPaid: true });
  showToast('Deposit marked as paid', 'success');
  loadAdminBookings();
}

async function deleteBookingAdmin(id) {
  if (!confirm('Permanently delete this booking?')) return;
  await DataStore.deleteBooking(id);
  showToast('Booking deleted', 'info');
  loadAdminBookings();
}

// Admin: Packages
async function loadAdminPackages() {
  packages = await DataStore.getPackages();
  const list = document.getElementById('adminPackagesList');
  list.innerHTML = packages.map(pkg => `
    <div class="admin-pkg-card">
      <div class="admin-pkg-img" style="background-image:url('${escapeHtml(pkg.imageUrl || '')}');background-color:var(--peach-light);background-size:cover;background-position:center"></div>
      <div class="admin-pkg-body">
        <h3>${escapeHtml(pkg.name)}</h3>
        <div class="price">$${pkg.price}${pkg.weekendPrice && pkg.weekendPrice !== pkg.price ? ' / $' + pkg.weekendPrice + ' wknd' : ''}</div>
        <p style="font-size:0.85rem;color:var(--gray);margin-top:0.25rem">${escapeHtml(pkg.subtitle || '')} · Max ${pkg.maxGuests || '?'} guests</p>
        <p style="font-size:0.85rem;color:${pkg.active !== false ? 'var(--bamboo)' : '#e53935'};font-weight:700;margin-top:0.25rem">${pkg.active !== false ? '● Active' : '● Inactive'}</p>
        <div class="admin-pkg-actions">
          <button class="btn btn-outline btn-sm" onclick="openPackageEditor('${pkg.id}')"><i class="fas fa-edit"></i> Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deletePackageAdmin('${pkg.id}')"><i class="fas fa-trash"></i> Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

function openPackageEditor(pkgId) {
  const pkg = pkgId ? packages.find(p => p.id === pkgId) : null;
  const isEdit = !!pkg;

  const html = `
    <h2>${isEdit ? 'Edit' : 'Add'} Package</h2>
    <form onsubmit="return false" style="margin-top:1rem">
      <div class="form-group"><label>Name *</label><input type="text" id="pkgName" value="${escapeHtml(pkg?.name || '')}"></div>
      <div class="form-group"><label>Subtitle</label><input type="text" id="pkgSubtitle" value="${escapeHtml(pkg?.subtitle || '')}" placeholder="e.g. Tues – Thurs"></div>
      <div class="form-group"><label>Description</label><textarea id="pkgDesc" rows="2">${escapeHtml(pkg?.description || '')}</textarea></div>
      <div class="form-row">
        <div class="form-group"><label>Price Tue–Thu ($) *</label><input type="number" id="pkgPrice" value="${pkg?.price || ''}" min="0"></div>
        <div class="form-group"><label>Price Wknd/Mon ($)</label><input type="number" id="pkgWeekendPrice" value="${pkg?.weekendPrice || ''}" min="0" placeholder="Same as weekday if blank"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Max Guests *</label><input type="number" id="pkgMaxGuests" value="${pkg?.maxGuests || ''}" min="1"></div>
        <div class="form-group"><label>Extra Guest Fee ($)</label><input type="number" id="pkgExtraFee" value="${pkg?.extraGuestFee || 0}" min="0"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Duration</label><input type="text" id="pkgDuration" value="${escapeHtml(pkg?.duration || '2 hours')}"></div>
      </div>
      <div class="form-group">
        <label>Package Image</label>
        <div id="pkgImagePreview" style="width:100%;height:120px;border-radius:12px;background:${pkg?.imageUrl ? "url('" + escapeHtml(pkg.imageUrl) + "') center/cover" : 'var(--gray-lighter)'};margin-bottom:0.5rem;display:flex;align-items:center;justify-content:center;color:var(--gray);font-size:0.85rem">${pkg?.imageUrl ? '' : 'No image'}</div>
        <input type="file" id="pkgImageFile" accept="image/*" onchange="previewPkgImage(this)" style="margin-bottom:0.5rem">
        <div id="pkgUploadProgress" style="display:none;margin-bottom:0.5rem"><div style="background:var(--gray-lighter);border-radius:8px;overflow:hidden;height:6px"><div id="pkgUploadBar" style="height:100%;background:var(--peach);width:0%;transition:width 0.3s"></div></div><small id="pkgUploadText" style="color:var(--gray)">Uploading...</small></div>
        <input type="hidden" id="pkgImageUrl" value="${escapeHtml(pkg?.imageUrl || '')}">
      </div>
      <div class="form-group"><label>Includes (one per line)</label><textarea id="pkgIncludes" rows="4">${(pkg?.includes || []).join('\n')}</textarea></div>
      <div class="form-group">
        <label>A La Carte Add-Ons</label>
        <div id="pkgAddOnsContainer">${(pkg?.addOns || []).map((a, i) => `
          <div class="addon-row" style="display:flex;gap:0.5rem;margin-bottom:0.5rem;align-items:center">
            <input type="text" class="addon-name" value="${escapeHtml(a.name)}" placeholder="Item name" style="flex:2">
            <input type="number" class="addon-price" value="${a.price}" placeholder="$ each" min="0" step="0.01" style="flex:0.7">
            <input type="number" class="addon-maxqty" value="${a.maxQty || 99}" placeholder="Max" min="1" style="flex:0.5" title="Max quantity">
            <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()" style="padding:0.3rem 0.6rem">&times;</button>
          </div>`).join('')}
        </div>
        <button type="button" class="btn btn-outline btn-sm" onclick="addAddonRow()" style="margin-top:0.25rem"><i class="fas fa-plus"></i> Add Item</button>
      </div>
      <div class="form-group"><label>Available Days</label><input type="text" id="pkgDays" value="${(pkg?.availableDays || []).join(', ')}" placeholder="Monday, Tuesday, Wednesday..."></div>
      <div class="form-group"><label>Sort Order</label><input type="number" id="pkgSort" value="${pkg?.sortOrder || 0}"></div>
      <div class="form-group">
        <label><input type="checkbox" id="pkgActive" ${pkg?.active !== false ? 'checked' : ''}> Active (visible to customers)</label>
      </div>
      <div style="display:flex;gap:1rem;margin-top:1rem">
        <button class="btn btn-primary" onclick="savePackageAdmin('${pkgId || ''}')"><i class="fas fa-save"></i> Save Package</button>
        <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      </div>
    </form>
  `;
  openModal(html);
}

function addAddonRow() {
  const container = document.getElementById('pkgAddOnsContainer');
  const row = document.createElement('div');
  row.className = 'addon-row';
  row.style.cssText = 'display:flex;gap:0.5rem;margin-bottom:0.5rem;align-items:center';
  row.innerHTML = `
    <input type="text" class="addon-name" placeholder="Item name (e.g. Whole Pizza)" style="flex:2">
    <input type="number" class="addon-price" placeholder="$ each" min="0" step="0.01" style="flex:0.7">
    <input type="number" class="addon-maxqty" value="99" placeholder="Max" min="1" style="flex:0.5" title="Max quantity">
    <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()" style="padding:0.3rem 0.6rem">&times;</button>
  `;
  container.appendChild(row);
}

function getAddonRows() {
  const rows = document.querySelectorAll('#pkgAddOnsContainer .addon-row');
  const addOns = [];
  rows.forEach(row => {
    const name = row.querySelector('.addon-name').value.trim();
    const price = parseFloat(row.querySelector('.addon-price').value);
    const maxQty = parseInt(row.querySelector('.addon-maxqty').value) || 99;
    if (name && !isNaN(price)) {
      addOns.push({ name, price, maxQty });
    }
  });
  return addOns;
}

function previewPkgImage(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById('pkgImagePreview');
    preview.style.backgroundImage = `url('${e.target.result}')`;
    preview.style.backgroundSize = 'cover';
    preview.style.backgroundPosition = 'center';
    preview.textContent = '';
  };
  reader.readAsDataURL(file);
}

async function savePackageAdmin(pkgId) {
  const name = document.getElementById('pkgName').value.trim();
  const price = parseFloat(document.getElementById('pkgPrice').value);
  const maxGuests = parseInt(document.getElementById('pkgMaxGuests').value);

  if (!name || isNaN(price) || isNaN(maxGuests)) {
    showToast('Please fill in required fields', 'error');
    return;
  }

  let imageUrl = document.getElementById('pkgImageUrl').value.trim();
  const fileInput = document.getElementById('pkgImageFile');
  if (fileInput.files && fileInput.files[0]) {
    const progressEl = document.getElementById('pkgUploadProgress');
    try {
      progressEl.style.display = 'block';
      imageUrl = await DataStore.processAndUploadImage(fileInput.files[0], (msg, pct) => {
        document.getElementById('pkgUploadText').textContent = msg;
        document.getElementById('pkgUploadBar').style.width = pct + '%';
      });
    } catch (err) {
      console.error('Image upload failed:', err);
      showToast(err.message || 'Image upload failed. Try a smaller JPG or PNG.', 'error');
      progressEl.style.display = 'none';
      return;
    }
  }

  const weekendPrice = parseFloat(document.getElementById('pkgWeekendPrice').value);

  const pkg = {
    name,
    subtitle: document.getElementById('pkgSubtitle').value.trim(),
    description: document.getElementById('pkgDesc').value.trim(),
    price,
    weekendPrice: isNaN(weekendPrice) ? price : weekendPrice,
    maxGuests,
    extraGuestFee: parseFloat(document.getElementById('pkgExtraFee').value) || 0,
    duration: document.getElementById('pkgDuration').value.trim(),
    imageUrl,
    includes: document.getElementById('pkgIncludes').value.split('\n').map(s => s.trim()).filter(Boolean),
    addOns: getAddonRows(),
    availableDays: document.getElementById('pkgDays').value.split(',').map(s => s.trim()).filter(Boolean),
    sortOrder: parseInt(document.getElementById('pkgSort').value) || 0,
    active: document.getElementById('pkgActive').checked
  };

  if (pkgId) pkg.id = pkgId;

  try {
    await DataStore.savePackage(pkg);
    showToast('Package saved!', 'success');
    closeModal();
    loadAdminPackages();
    renderHomePackages();
  } catch (err) {
    console.error('Package save error:', err);
    showToast('Error saving package.', 'error');
  }
}

async function deletePackageAdmin(id) {
  if (!confirm('Delete this package?')) return;
  await DataStore.deletePackage(id);
  showToast('Package deleted', 'info');
  loadAdminPackages();
  renderHomePackages();
}

// Admin: Services
async function loadAdminServices() {
  services = await DataStore.getServices();
  const list = document.getElementById('adminServicesList');
  list.innerHTML = services.map(svc => {
    const imgStyle = svc.imageUrl ? `background-image:url('${escapeHtml(svc.imageUrl)}');background-size:cover;background-position:center` : 'background:var(--peach-light)';
    return `
      <div class="admin-svc-card">
        <div class="admin-svc-img" style="${imgStyle}">
          <div class="admin-svc-img-overlay"><i class="fas fa-camera"></i></div>
        </div>
        <div class="admin-svc-body">
          <h3>${escapeHtml(svc.title)}</h3>
          ${svc.price ? `<div style="color:var(--peach-dark);font-weight:800">${escapeHtml(svc.price)} ${escapeHtml(svc.priceNote || '')}</div>` : ''}
          <p style="font-size:0.8rem;color:var(--gray);margin-top:0.25rem">${escapeHtml((svc.description || '').substring(0, 60))}...</p>
          <div style="margin-top:0.75rem;display:flex;gap:0.5rem">
            <button class="btn btn-primary btn-sm" onclick="openServiceEditor('${svc.id}')"><i class="fas fa-edit"></i> Edit Card</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function triggerSvcImageUpload(svcId) {
  document.getElementById('svcFile_' + svcId).click();
}

async function uploadSvcImage(svcId, input) {
  if (!input.files || !input.files[0]) return;
  const svc = services.find(s => s.id === svcId);
  if (!svc) return;
  try {
    showToast('Compressing image...', 'info');
    const imageUrl = await DataStore.processAndUploadImage(input.files[0], (msg) => {
      showToast(msg, 'info');
    });
    svc.imageUrl = imageUrl;
    await DataStore.saveService(svc);
    showToast('Photo updated!', 'success');
    loadAdminServices();
    renderServices();
  } catch (err) {
    console.error('Service image upload failed:', err);
    showToast('Image upload failed: ' + err.message, 'error');
  }
}

function openServiceEditor(svcId) {
  const svc = services.find(s => s.id === svcId);
  if (!svc) return;
  const imgPreviewStyle = svc.imageUrl ? `background-image:url('${escapeHtml(svc.imageUrl)}');background-size:cover;background-position:center` : 'background:var(--gray-lighter)';
  const html = `
    <h2>Edit Service Card</h2>
    <form onsubmit="return false" style="margin-top:1rem">
      <div class="form-group">
        <label>Service Image</label>
        <div id="svcImagePreview" style="width:100%;height:140px;border-radius:12px;${imgPreviewStyle};margin-bottom:0.5rem;display:flex;align-items:center;justify-content:center;color:var(--gray);font-size:0.85rem">${svc.imageUrl ? '' : 'No image'}</div>
        <input type="file" id="svcImageFile" accept="image/*" onchange="previewSvcImage(this)" style="margin-bottom:0.5rem">
        <div id="svcUploadProgress" style="display:none;margin-bottom:0.5rem"><div style="background:var(--gray-lighter);border-radius:8px;overflow:hidden;height:6px"><div id="svcUploadBar" style="height:100%;background:var(--peach);width:0%;transition:width 0.3s"></div></div><small id="svcUploadText" style="color:var(--gray)">Processing...</small></div>
      </div>
      <div class="form-group"><label>Title *</label><input type="text" id="svcTitle" value="${escapeHtml(svc.title)}"></div>
      <div class="form-row">
        <div class="form-group"><label>Price Text</label><input type="text" id="svcPrice" value="${escapeHtml(svc.price || '')}" placeholder="e.g. $12 or From $229"></div>
        <div class="form-group"><label>Price Note</label><input type="text" id="svcPriceNote" value="${escapeHtml(svc.priceNote || '')}" placeholder="e.g. / 2 hours or /mo"></div>
      </div>
      <div class="form-group"><label>Description</label><textarea id="svcDesc" rows="3">${escapeHtml(svc.description || '')}</textarea></div>
      <div class="form-row">
        <div class="form-group"><label>Button Text</label><input type="text" id="svcBtnText" value="${escapeHtml(svc.buttonText || '')}" placeholder="e.g. View Packages"></div>
        <div class="form-group"><label>Button Action</label><input type="text" id="svcBtnAction" value="${escapeHtml(svc.buttonAction || '')}" placeholder="navigate('packages') or URL"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Sort Order</label><input type="number" id="svcSort" value="${svc.sortOrder || 0}"></div>
        <div class="form-group"><label><input type="checkbox" id="svcFeatured" ${svc.featured ? 'checked' : ''}> Featured (Most Popular badge)</label></div>
      </div>
      <div style="display:flex;gap:1rem;margin-top:1rem">
        <button class="btn btn-primary" onclick="saveServiceAdmin('${svcId}')"><i class="fas fa-save"></i> Save</button>
        <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      </div>
    </form>
  `;
  openModal(html);
}

function previewSvcImage(input) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById('svcImagePreview');
    preview.style.backgroundImage = `url('${e.target.result}')`;
    preview.style.backgroundSize = 'cover';
    preview.style.backgroundPosition = 'center';
    preview.textContent = '';
  };
  reader.readAsDataURL(input.files[0]);
}

async function saveServiceAdmin(svcId) {
  const svc = services.find(s => s.id === svcId);
  if (!svc) return;

  const fileInput = document.getElementById('svcImageFile');
  if (fileInput.files && fileInput.files[0]) {
    const progressEl = document.getElementById('svcUploadProgress');
    try {
      progressEl.style.display = 'block';
      svc.imageUrl = await DataStore.processAndUploadImage(fileInput.files[0], (msg, pct) => {
        document.getElementById('svcUploadText').textContent = msg;
        document.getElementById('svcUploadBar').style.width = pct + '%';
      });
    } catch (err) {
      console.error('Service image upload failed:', err);
      showToast(err.message || 'Image upload failed.', 'error');
      progressEl.style.display = 'none';
      return;
    }
  }

  svc.title = document.getElementById('svcTitle').value.trim();
  svc.price = document.getElementById('svcPrice').value.trim();
  svc.priceNote = document.getElementById('svcPriceNote').value.trim();
  svc.description = document.getElementById('svcDesc').value.trim();
  svc.buttonText = document.getElementById('svcBtnText').value.trim();
  svc.buttonAction = document.getElementById('svcBtnAction').value.trim();
  svc.sortOrder = parseInt(document.getElementById('svcSort').value) || 0;
  svc.featured = document.getElementById('svcFeatured').checked;
  if (!svc.title) { showToast('Title is required', 'error'); return; }
  try {
    await DataStore.saveService(svc);
    showToast('Service card saved!', 'success');
    closeModal();
    loadAdminServices();
    renderServices();
  } catch (err) {
    showToast('Error saving service.', 'error');
  }
}

// Admin: Availability Calendar
async function initAdminCalendar() {
  blockedDates = await DataStore.getBlockedDates();
  renderAdminCalendar();
}

function adminCalNav(dir) {
  adminCalMonth += dir;
  if (adminCalMonth > 11) { adminCalMonth = 0; adminCalYear++; }
  if (adminCalMonth < 0) { adminCalMonth = 11; adminCalYear--; }
  renderAdminCalendar();
}

function renderAdminCalendar() {
  const grid = document.getElementById('adminCalGrid');
  const monthLabel = document.getElementById('adminCalMonth');
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  monthLabel.textContent = months[adminCalMonth] + ' ' + adminCalYear;

  const firstDay = new Date(adminCalYear, adminCalMonth, 1).getDay();
  const daysInMonth = new Date(adminCalYear, adminCalMonth + 1, 0).getDate();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  let html = '';
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-day empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(adminCalYear, adminCalMonth, d);
    const dateStr = formatDate(date);
    const isBlocked = blockedDates.some(b => b.date === dateStr && b.blocked);
    const hasBooking = allBookings.some(b => b.date === dateStr && b.status !== 'cancelled');
    const isToday = date.getTime() === today.getTime();

    const classes = ['cal-day'];
    if (isToday) classes.push('today');
    if (isBlocked) classes.push('blocked');
    if (hasBooking && !isBlocked) classes.push('has-booking');

    html += `<div class="${classes.join(' ')}" onclick="adminSelectDate('${dateStr}')">${d}</div>`;
  }
  grid.innerHTML = html;
}

async function adminSelectDate(dateStr) {
  const isBlocked = blockedDates.some(b => b.date === dateStr && b.blocked);
  const dayBookings = allBookings.filter(b => b.date === dateStr && b.status !== 'cancelled');

  const detail = document.getElementById('adminDateDetail');
  detail.innerHTML = `
    <h3>${formatDateDisplay(dateStr)}</h3>
    <p style="margin:0.5rem 0"><strong>Status:</strong> ${isBlocked ? '🔴 Blocked' : '🟢 Available'}</p>
    <p><strong>Bookings:</strong> ${dayBookings.length}</p>
    ${dayBookings.map(b => `<p style="font-size:0.85rem;margin:0.25rem 0">• ${escapeHtml(b.packageName)} — ${b.timeSlot} (${escapeHtml(b.lastName)})</p>`).join('')}
    <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap">
      <button class="btn ${isBlocked ? 'btn-success' : 'btn-danger'} btn-sm" onclick="toggleBlockDate('${dateStr}', ${!isBlocked})">
        ${isBlocked ? '<i class="fas fa-check"></i> Unblock Date' : '<i class="fas fa-ban"></i> Block Date'}
      </button>
      <button class="btn btn-outline btn-sm" onclick="manageTimeSlots('${dateStr}')">
        <i class="fas fa-clock"></i> Manage Time Slots
      </button>
    </div>
  `;
}

async function toggleBlockDate(dateStr, block) {
  await DataStore.setBlockedDate(dateStr, block, [], block ? 'Admin blocked' : '');
  blockedDates = await DataStore.getBlockedDates();
  renderAdminCalendar();
  adminSelectDate(dateStr);
  showToast(block ? 'Date blocked' : 'Date unblocked', 'info');
}

function manageTimeSlots(dateStr) {
  const blocked = blockedDates.find(b => b.date === dateStr);
  const blockedSlots = blocked?.blockedSlots || [];
  const slots = getTimeSlotsForDate(dateStr);

  const html = `
    <h2>Time Slots for ${formatDateDisplay(dateStr)}</h2>
    <p style="margin:0.5rem 0 1rem;color:var(--gray)">Toggle individual time slots on/off:</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
      ${slots.map(slot => {
        const isBlocked = blockedSlots.includes(slot.value);
        return `<label style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem;border-radius:8px;background:${isBlocked ? '#FFEBEE' : '#E8F5E9'};cursor:pointer">
          <input type="checkbox" class="slot-cb" value="${slot.value}" ${isBlocked ? 'checked' : ''}> ${slot.label} ${isBlocked ? '(blocked)' : '(open)'}
        </label>`;
      }).join('')}
    </div>
    <button class="btn btn-primary" style="margin-top:1.5rem" onclick="saveTimeSlots('${dateStr}')"><i class="fas fa-save"></i> Save</button>
  `;
  openModal(html);
}

async function saveTimeSlots(dateStr) {
  const checkedSlots = [...document.querySelectorAll('.slot-cb:checked')].map(cb => cb.value);
  const slots = getTimeSlotsForDate(dateStr);
  const isFullyBlocked = checkedSlots.length === slots.length;
  await DataStore.setBlockedDate(dateStr, isFullyBlocked, checkedSlots, '');
  blockedDates = await DataStore.getBlockedDates();
  closeModal();
  renderAdminCalendar();
  adminSelectDate(dateStr);
  showToast('Time slots updated', 'success');
}

// ==========================================
// MEMBERSHIPS
// ==========================================
const MEMBERSHIP_PLANS = {
  monthly: {
    name: 'Monthly Membership',
    pricePerChild: 65,
    siblingFee: 20,
    commitment: 'month-to-month',
    cancellable: true
  },
  annual: {
    name: 'Annual Membership',
    pricePerChild: 55,
    siblingFee: 20,
    commitment: '12 months',
    cancellable: false
  }
};

function initMembershipView() {
  selectedMembershipPlan = null;
  membershipStep(1);
  document.querySelectorAll('.mem-plan-card').forEach(c => c.classList.remove('selected'));
}

function selectMembershipPlan(planType) {
  selectedMembershipPlan = planType;
  document.querySelectorAll('.mem-plan-card').forEach(c => c.classList.remove('selected'));
  document.getElementById(planType === 'monthly' ? 'planMonthly' : 'planAnnual').classList.add('selected');
  setTimeout(() => membershipStep(2), 300);
}

function membershipStep(step) {
  if (step === 2 && !selectedMembershipPlan) {
    showToast('Please select a membership plan first', 'error');
    return;
  }

  document.querySelectorAll('.steps-bar .step[data-mstep]').forEach(s => {
    const sn = parseInt(s.dataset.mstep);
    s.classList.remove('active', 'done');
    if (sn < step) s.classList.add('done');
    if (sn === step) s.classList.add('active');
  });

  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById('memStep' + i);
    if (el) el.classList.toggle('active', i === step);
  }

  if (step === 2) initSiblingFields();
  if (step === 3) renderMembershipAgreement();
  if (step === 4) renderMembershipPayment();
}

function initSiblingFields() {
  const sibInput = document.getElementById('memSiblings');
  sibInput.removeEventListener('input', updateSiblingNames);
  sibInput.addEventListener('input', updateSiblingNames);
  updateSiblingNames();

  const phoneEl = document.getElementById('memPhone');
  if (phoneEl && !phoneEl._formatted) {
    phoneEl._formatted = true;
    phoneEl.addEventListener('input', function () {
      let v = this.value.replace(/\D/g, '');
      if (v.length > 10) v = v.slice(0, 10);
      if (v.length >= 7) this.value = `(${v.slice(0, 3)}) ${v.slice(3, 6)}-${v.slice(6)}`;
      else if (v.length >= 4) this.value = `(${v.slice(0, 3)}) ${v.slice(3)}`;
      else if (v.length > 0) this.value = `(${v}`;
    });
  }
}

function updateSiblingNames() {
  const count = parseInt(document.getElementById('memSiblings').value) || 0;
  const container = document.getElementById('siblingNamesContainer');
  if (count === 0) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }
  container.style.display = 'block';
  let html = '<h4 style="margin:1rem 0 0.5rem">Sibling Information</h4>';
  for (let i = 1; i <= count; i++) {
    html += `
      <div class="form-row">
        <div class="form-group"><label>Sibling ${i} Name *</label><input type="text" id="memSibName${i}" required></div>
        <div class="form-group"><label>Sibling ${i} Age *</label><input type="number" id="memSibAge${i}" min="0" max="12" required></div>
      </div>`;
  }
  container.innerHTML = html;
  updateMembershipPricing();
}

function updateMembershipPricing() {}

function validateMemberDetailsAndContinue() {
  const required = ['memFirstName', 'memLastName', 'memPhone', 'memEmail', 'memAddress', 'memChildName', 'memChildAge'];
  for (const fid of required) {
    const el = document.getElementById(fid);
    if (!el || !el.value.trim()) {
      if (el) el.focus();
      showToast('Please fill in all required fields', 'error');
      return;
    }
  }
  const sibCount = parseInt(document.getElementById('memSiblings').value) || 0;
  for (let i = 1; i <= sibCount; i++) {
    const nameEl = document.getElementById('memSibName' + i);
    const ageEl = document.getElementById('memSibAge' + i);
    if (!nameEl?.value.trim() || !ageEl?.value.trim()) {
      showToast('Please fill in all sibling information', 'error');
      return;
    }
  }
  membershipStep(3);
}

function renderMembershipAgreement() {
  const plan = MEMBERSHIP_PLANS[selectedMembershipPlan];
  const siblings = parseInt(document.getElementById('memSiblings').value) || 0;
  const monthlyTotal = plan.pricePerChild + (siblings * plan.siblingFee);

  let childrenList = `<li>${escapeHtml(document.getElementById('memChildName').value)} (Age ${document.getElementById('memChildAge').value})</li>`;
  for (let i = 1; i <= siblings; i++) {
    const name = document.getElementById('memSibName' + i)?.value || '';
    const age = document.getElementById('memSibAge' + i)?.value || '';
    childrenList += `<li>${escapeHtml(name)} (Age ${age})</li>`;
  }

  document.getElementById('membershipSummary').innerHTML = `
    <h3>Membership Summary</h3>
    <table class="mem-summary-table">
      <tr><td><strong>Plan:</strong></td><td>${plan.name}</td></tr>
      <tr><td><strong>Member:</strong></td><td>${escapeHtml(document.getElementById('memFirstName').value)} ${escapeHtml(document.getElementById('memLastName').value)}</td></tr>
      <tr><td><strong>Phone:</strong></td><td>${escapeHtml(document.getElementById('memPhone').value)}</td></tr>
      <tr><td><strong>Email:</strong></td><td>${escapeHtml(document.getElementById('memEmail').value)}</td></tr>
      <tr><td><strong>Children:</strong></td><td><ul style="margin:0;padding-left:1.2rem">${childrenList}</ul></td></tr>
      <tr><td colspan="2"><hr style="margin:0.5rem 0"></td></tr>
      <tr><td><strong>Base Rate:</strong></td><td>$${plan.pricePerChild}/month (primary child)</td></tr>
      ${siblings > 0 ? `<tr><td><strong>Siblings (${siblings}):</strong></td><td>+$${siblings * plan.siblingFee}/month ($${plan.siblingFee} each)</td></tr>` : ''}
      <tr><td><strong>Monthly Total:</strong></td><td style="font-size:1.3rem;font-weight:900;color:var(--peach-dark)">$${monthlyTotal}/month</td></tr>
      ${selectedMembershipPlan === 'annual' ? `<tr><td><strong>Commitment:</strong></td><td style="font-weight:700;color:var(--teal-dark)">12 months ($${monthlyTotal * 12} total over term)</td></tr>` : ''}
    </table>
  `;

  let agreementHtml = '';
  if (selectedMembershipPlan === 'annual') {
    agreementHtml = `
      <h3>Annual Membership Agreement</h3>
      <div class="legal-text">
        <p><strong>MEMBERSHIP AGREEMENT — PLEASE READ CAREFULLY BEFORE SIGNING</strong></p>

        <p><strong>1. TERM AND COMMITMENT.</strong> By selecting the Annual Membership plan, you ("Member") are entering into a binding twelve (12) month membership agreement with Peachy Pals Playland ("Facility"), located at 801 West Ave Suite 201, Cartersville, Georgia 30120. This agreement begins on the date of enrollment and continues for a minimum period of twelve (12) consecutive months ("Initial Term").</p>

        <p><strong>2. MONTHLY BILLING.</strong> Member agrees to pay <strong>$${plan.pricePerChild} per month</strong> for the primary child${siblings > 0 ? ` and an additional <strong>$${plan.siblingFee} per month for each additional sibling (${siblings} sibling${siblings > 1 ? 's' : ''} = $${siblings * plan.siblingFee}/month)</strong>` : ''}, for a total recurring monthly charge of <strong>$${monthlyTotal}</strong>. This amount will be automatically charged to the payment method provided on file on a monthly basis throughout the duration of the Initial Term.</p>

        <p><strong>3. NON-CANCELLATION POLICY.</strong> Member acknowledges and agrees that this membership <strong>cannot be cancelled, terminated, or suspended</strong> during the Initial Term of twelve (12) months. Member is obligated to pay all monthly installments for the full twelve (12) month period regardless of usage, relocation, or change in personal circumstances. The total financial obligation under this agreement is <strong>$${monthlyTotal * 12}</strong> over the twelve (12) month term.</p>

        <p><strong>4. EARLY TERMINATION.</strong> There is no early termination option. If Member's payment method is declined or payment is otherwise not received, the Facility reserves the right to pursue collection of all remaining amounts due under this agreement, including any applicable late fees, collection costs, and attorney's fees permitted under Georgia law.</p>

        <p><strong>5. AUTOMATIC RENEWAL.</strong> At the conclusion of the Initial Term, this membership will automatically convert to a month-to-month membership at the then-current monthly rate, which may be adjusted by the Facility with thirty (30) days' written notice. After the Initial Term, the month-to-month membership may be cancelled by either party with thirty (30) days' written notice.</p>

        <p><strong>6. MEMBERSHIP BENEFITS.</strong> During the term of this agreement, all enrolled children shall have unlimited access to open play sessions during regular business hours, subject to the Facility's standard rules, capacity limitations, and operational schedule.</p>

        <p><strong>7. WAIVER AND RELEASE.</strong> Member acknowledges that all children must have a valid signed waiver on file with the Facility before participating in any play activities. The membership does not waive or replace any waiver, release, or assumption of risk requirements.</p>

        <p><strong>8. GOVERNING LAW.</strong> This agreement shall be governed by and construed in accordance with the laws of the State of Georgia. Any disputes arising under this agreement shall be subject to the jurisdiction of the courts in Bartow County, Georgia.</p>

        <p><strong>BY CHECKING THE BOX BELOW, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY ALL TERMS AND CONDITIONS OF THIS TWELVE (12) MONTH MEMBERSHIP AGREEMENT, INCLUDING THE NON-CANCELLATION POLICY AND YOUR OBLIGATION TO PAY ALL TWELVE (12) MONTHLY INSTALLMENTS OF $${monthlyTotal}.</strong></p>
      </div>
    `;
  } else {
    agreementHtml = `
      <h3>Monthly Membership Terms</h3>
      <div class="legal-text">
        <p><strong>MEMBERSHIP TERMS — PLEASE READ BEFORE CONTINUING</strong></p>

        <p><strong>1. MONTH-TO-MONTH MEMBERSHIP.</strong> By selecting the Monthly Membership plan, you ("Member") are enrolling in a month-to-month membership with Peachy Pals Playland ("Facility"), located at 801 West Ave Suite 201, Cartersville, Georgia 30120.</p>

        <p><strong>2. MONTHLY BILLING.</strong> Member agrees to pay <strong>$${plan.pricePerChild} per month</strong> for the primary child${siblings > 0 ? ` and an additional <strong>$${plan.siblingFee} per month for each additional sibling (${siblings} sibling${siblings > 1 ? 's' : ''} = $${siblings * plan.siblingFee}/month)</strong>` : ''}, for a total recurring monthly charge of <strong>$${monthlyTotal}</strong>. This amount will be charged to the payment method provided on file each month.</p>

        <p><strong>3. CANCELLATION.</strong> This month-to-month membership may be cancelled at any time with thirty (30) days' written notice. Member is responsible for any charges incurred up to the effective date of cancellation.</p>

        <p><strong>4. MEMBERSHIP BENEFITS.</strong> During the term of this membership, all enrolled children shall have unlimited access to open play sessions during regular business hours, subject to the Facility's standard rules, capacity limitations, and operational schedule.</p>

        <p><strong>5. WAIVER AND RELEASE.</strong> Member acknowledges that all children must have a valid signed waiver on file with the Facility before participating in any play activities.</p>

        <p><strong>BY CHECKING THE BOX BELOW, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO THE MEMBERSHIP TERMS ABOVE, INCLUDING THE RECURRING MONTHLY CHARGE OF $${monthlyTotal}.</strong></p>
      </div>
    `;
  }

  document.getElementById('membershipAgreement').innerHTML = agreementHtml;
  document.getElementById('memAgreeTerms').checked = false;
  document.getElementById('btnToMemStep4').disabled = true;
}

function updateAgreementButton() {
  document.getElementById('btnToMemStep4').disabled = !document.getElementById('memAgreeTerms').checked;
}

function renderMembershipPayment() {
  const plan = MEMBERSHIP_PLANS[selectedMembershipPlan];
  const siblings = parseInt(document.getElementById('memSiblings').value) || 0;
  const monthlyTotal = plan.pricePerChild + (siblings * plan.siblingFee);

  document.getElementById('memPaymentSummary').innerHTML = `
    <h3 style="margin-bottom:1rem">Payment Summary</h3>
    <table style="width:100%;font-size:0.95rem">
      <tr><td><strong>Plan:</strong></td><td>${plan.name}</td></tr>
      <tr><td><strong>Recurring Monthly Charge:</strong></td><td style="font-size:1.3rem;font-weight:900;color:var(--peach-dark)">$${monthlyTotal}/month</td></tr>
      ${selectedMembershipPlan === 'annual' ? `<tr><td><strong>Commitment:</strong></td><td style="color:var(--teal-dark);font-weight:700">12 months — $${monthlyTotal * 12} total</td></tr>` : ''}
      <tr><td><strong>First Charge:</strong></td><td style="font-weight:700">$${monthlyTotal} (today)</td></tr>
    </table>
    <p style="margin-top:1rem;font-size:0.85rem;color:var(--gray)">
      Your selected payment method will be charged <strong>$${monthlyTotal}</strong> today and on the same date each subsequent month${selectedMembershipPlan === 'annual' ? ' for the full 12-month term' : ' until cancelled'}.
    </p>
  `;

  document.querySelectorAll('input[name="memPayMethod"]').forEach(radio => {
    radio.addEventListener('change', function() {
      const info = CONFIG.paymentInfo[this.value];
      const instrEl = document.getElementById('memPaymentInstructions');
      if (info) {
        let text = info.instructions.replace('deposit', 'first monthly payment').replace('booking confirmation code', 'membership reference code');
        instrEl.innerHTML = text + '<p style="margin-top:0.75rem;font-size:0.85rem;color:var(--gray)"><strong>Recurring payments:</strong> Our team will contact you to set up automatic monthly billing through your selected payment method.</p>';
      }
    });
  });
}

async function submitMembership() {
  const payMethod = document.querySelector('input[name="memPayMethod"]:checked');
  if (!payMethod) {
    showToast('Please select a payment method', 'error');
    return;
  }

  const plan = MEMBERSHIP_PLANS[selectedMembershipPlan];
  const siblings = parseInt(document.getElementById('memSiblings').value) || 0;
  const monthlyTotal = plan.pricePerChild + (siblings * plan.siblingFee);

  const children = [{
    name: document.getElementById('memChildName').value.trim(),
    age: parseInt(document.getElementById('memChildAge').value) || 0
  }];
  for (let i = 1; i <= siblings; i++) {
    children.push({
      name: (document.getElementById('memSibName' + i)?.value || '').trim(),
      age: parseInt(document.getElementById('memSibAge' + i)?.value) || 0
    });
  }

  const membership = {
    planType: selectedMembershipPlan,
    planName: plan.name,
    firstName: document.getElementById('memFirstName').value.trim(),
    lastName: document.getElementById('memLastName').value.trim(),
    phone: document.getElementById('memPhone').value.trim(),
    email: document.getElementById('memEmail').value.trim(),
    address: document.getElementById('memAddress').value.trim(),
    children,
    numberOfSiblings: siblings,
    monthlyRate: monthlyTotal,
    pricePerChild: plan.pricePerChild,
    siblingFee: plan.siblingFee,
    commitment: plan.commitment,
    totalTermCost: selectedMembershipPlan === 'annual' ? monthlyTotal * 12 : null,
    paymentMethod: payMethod.value,
    agreedToTerms: true,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  try {
    const result = await DataStore.createMembership(membership);
    launchConfetti();
    showToast('Membership registered successfully!', 'success');

    const childrenHtml = children.map(c => `${escapeHtml(c.name)} (Age ${c.age})`).join(', ');

    document.getElementById('memConfirmationBox').innerHTML = `
      <div style="font-size:4rem;margin-bottom:1rem">🎉</div>
      <h2>Membership Registered!</h2>
      <p style="color:var(--gray);margin-bottom:1rem">Your membership has been submitted. Here's your reference code:</p>
      <div class="confirmation-code">${result.membershipCode}</div>
      <div style="text-align:left;margin:1.5rem 0;padding:1rem;background:var(--cream);border-radius:var(--radius)">
        <p><strong>Plan:</strong> ${plan.name}</p>
        <p><strong>Member:</strong> ${escapeHtml(membership.firstName)} ${escapeHtml(membership.lastName)}</p>
        <p><strong>Children:</strong> ${childrenHtml}</p>
        <p><strong>Monthly Charge:</strong> $${monthlyTotal}/month</p>
        ${selectedMembershipPlan === 'annual' ? `<p><strong>Commitment:</strong> 12 months ($${monthlyTotal * 12} total)</p>` : '<p><strong>Type:</strong> Month-to-month (cancel anytime with 30 days notice)</p>'}
        <p><strong>Payment:</strong> ${CONFIG.paymentInfo[payMethod.value]?.label || payMethod.value}</p>
      </div>
      <p style="color:var(--gray);font-size:0.9rem;margin-bottom:1.5rem">
        Our team will contact you within 24 hours to finalize your recurring payment setup. Save your reference code for your records!
      </p>
      <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="navigate('home')"><i class="fas fa-home"></i> Back Home</button>
      </div>
    `;
    membershipStep(5);
    resetMembershipForm();
  } catch (err) {
    console.error('Membership error:', err);
    showToast('Error creating membership. Please try again.', 'error');
  }
}

function resetMembershipForm() {
  selectedMembershipPlan = null;
  ['memFirstName', 'memLastName', 'memPhone', 'memEmail', 'memAddress', 'memChildName', 'memChildAge'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('memSiblings').value = '0';
  document.getElementById('siblingNamesContainer').innerHTML = '';
  document.getElementById('siblingNamesContainer').style.display = 'none';
  document.querySelectorAll('.mem-plan-card').forEach(c => c.classList.remove('selected'));
}

// ==========================================
// SQUARE PAYMENTS & EMAIL
// ==========================================
let squareCard = null;

async function renderSquarePayButton(containerId, amount, confirmCode, bookingId) {
  if (!CONFIG.squareAppId || !CONFIG.squareLocationId) return;
  const container = document.getElementById(containerId);
  if (!container) return;
  if (typeof Square === 'undefined') return;

  container.innerHTML = `
    <div id="sq-card-${containerId}" style="margin-bottom:0.5rem"></div>
    <button class="btn btn-primary btn-sm" id="sq-pay-${containerId}" style="width:100%" onclick="processSquarePayment('${containerId}', ${amount}, '${confirmCode}', '${bookingId}')">
      <i class="fas fa-lock"></i> Pay $${amount.toFixed(2)} with Card
    </button>
    <p id="sq-status-${containerId}" style="display:none;margin-top:0.5rem;font-size:0.85rem"></p>
  `;

  try {
    const payments = Square.payments(CONFIG.squareAppId, CONFIG.squareLocationId);
    squareCard = await payments.card();
    await squareCard.attach('#sq-card-' + containerId);
  } catch (e) {
    console.warn('Square card form failed:', e);
    container.innerHTML = '<p style="color:var(--gray);font-size:0.85rem">Card payment form unavailable. Use Venmo or Cash App below.</p>';
  }
}

async function processSquarePayment(containerId, amount, confirmCode, bookingId) {
  if (!squareCard) return;
  const btn = document.getElementById('sq-pay-' + containerId);
  const status = document.getElementById('sq-status-' + containerId);
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
  status.style.display = 'block';
  status.style.color = 'var(--gray)';
  status.textContent = 'Tokenizing card...';

  try {
    const result = await squareCard.tokenize();
    if (result.status !== 'OK') {
      throw new Error(result.errors?.[0]?.message || 'Card tokenization failed');
    }

    status.textContent = 'Processing payment...';
    const resp = await fetch(CONFIG.squarePayEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nonce: result.token,
        amount: Math.round(amount * 100),
        currency: 'USD',
        confirmationCode: confirmCode,
        bookingId: bookingId
      })
    });

    const data = await resp.json();
    if (!resp.ok || data.error) throw new Error(data.error || 'Payment failed');

    if (bookingId) {
      await DataStore.updateBooking(bookingId, { depositPaid: true, squarePaymentId: data.paymentId || '' });
    }
    btn.style.display = 'none';
    status.style.color = 'var(--bamboo)';
    status.innerHTML = '<strong><i class="fas fa-check-circle"></i> Payment successful! Deposit paid.</strong>';
    showToast('Payment successful!', 'success');
    const cardContainer = document.getElementById('sq-card-' + containerId);
    if (cardContainer) cardContainer.style.display = 'none';
  } catch (err) {
    console.error('Square payment error:', err);
    status.style.color = '#e53935';
    status.textContent = err.message || 'Payment failed. Please try again.';
    btn.disabled = false;
    btn.innerHTML = `<i class="fas fa-lock"></i> Pay $${amount.toFixed(2)} with Card`;
  }
}

async function sendBookingEmail(booking, confirmCode, total, deposit) {
  // EmailJS integration
  if (CONFIG.emailjsServiceId && CONFIG.emailjsTemplateId && CONFIG.emailjsPublicKey) {
    try {
      await emailjs.send(CONFIG.emailjsServiceId, CONFIG.emailjsTemplateId, {
        to_email: CONFIG.businessEmail,
        confirmation_code: confirmCode,
        package_name: booking.packageName,
        date: formatDateDisplay(booking.date),
        time_slot: booking.timeSlot,
        first_name: booking.firstName,
        last_name: booking.lastName,
        phone: booking.phone,
        email: booking.email || 'Not provided',
        child_name: booking.childName,
        child_age: booking.childAge,
        num_kids: booking.numberOfKids,
        num_adults: booking.numberOfAdults,
        total: '$' + total.toFixed(2),
        deposit: '$' + deposit,
        payment_method: booking.paymentMethod,
        special_requests: booking.specialRequests || 'None'
      }, CONFIG.emailjsPublicKey);
      console.log('✅ Booking email sent');
    } catch (e) { console.warn('Email send failed:', e); }
    return;
  }
  // Fallback: Web3Forms (free, no signup — just get access key at web3forms.com)
  try {
    await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_key: CONFIG.web3formsKey || '',
        subject: 'New Booking: ' + confirmCode + ' — ' + booking.packageName,
        from_name: 'Peachy Pals Playland',
        to: CONFIG.businessEmail,
        message: `New Booking Received!\n\nConfirmation: ${confirmCode}\nPackage: ${booking.packageName}\nDate: ${formatDateDisplay(booking.date)}\nTime: ${booking.timeSlot}\nGuest: ${booking.firstName} ${booking.lastName}\nPhone: ${booking.phone}\nEmail: ${booking.email || 'N/A'}\nChild: ${booking.childName} (Age ${booking.childAge})\nKids: ${booking.numberOfKids} | Adults: ${booking.numberOfAdults}\nTotal: $${total.toFixed(2)} | Deposit: $${deposit}\nPayment: ${booking.paymentMethod}\nRequests: ${booking.specialRequests || 'None'}`
      })
    });
    console.log('✅ Booking email sent via Web3Forms');
  } catch (e) { console.warn('Email fallback failed:', e); }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ==========================================
// INITIALIZATION
// ==========================================
async function init() {
  // Seed and load data — each step wrapped so one failure doesn't block the rest
  try { await DataStore.seedDefaults(); } catch(e) { console.warn('seedDefaults:', e); }
  try { await DataStore.migratePackages(); } catch(e) { console.warn('migratePackages:', e); }
  try { await DataStore.seedServices(); } catch(e) { console.warn('seedServices:', e); }
  try { await renderServices(); } catch(e) { console.warn('renderServices:', e); }
  try { await renderHomePackages(); } catch(e) { console.warn('renderHomePackages:', e); }

  // Initialize floating leaves
  initLeaves();

  // Handle routing
  window.addEventListener('hashchange', handleRoute);
  handleRoute();

  // Nav scroll effect
  window.addEventListener('scroll', () => {
    const nav = document.getElementById('mainNav');
    nav.style.boxShadow = window.scrollY > 50 ? '0 2px 20px rgba(0,0,0,0.15)' : '0 2px 20px rgba(0,0,0,0.08)';
  });

  // Phone number formatting
  ['bkPhone', 'lookupPhone'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', function () {
        let v = this.value.replace(/\D/g, '');
        if (v.length > 10) v = v.slice(0, 10);
        if (v.length >= 7) this.value = `(${v.slice(0, 3)}) ${v.slice(3, 6)}-${v.slice(6)}`;
        else if (v.length >= 4) this.value = `(${v.slice(0, 3)}) ${v.slice(3)}`;
        else if (v.length > 0) this.value = `(${v}`;
      });
    }
  });
}

// Start the app
document.addEventListener('DOMContentLoaded', init);

// ==========================================
// PWA — SERVICE WORKER & INSTALL PROMPT
// ==========================================
let deferredInstallPrompt = null;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  showInstallBanner();
});

function showInstallBanner() {
  if (localStorage.getItem('pp_pwa_dismissed')) return;
  const banner = document.getElementById('pwaInstallBanner');
  if (banner) {
    setTimeout(() => banner.classList.add('visible'), 2000);
  }
}

function installPWA() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(result => {
      if (result.outcome === 'accepted') {
        showToast('App installed! Find it on your home screen.', 'success');
      }
      deferredInstallPrompt = null;
      document.getElementById('pwaInstallBanner').classList.remove('visible');
    });
  }
}

function dismissInstallBanner() {
  document.getElementById('pwaInstallBanner').classList.remove('visible');
  localStorage.setItem('pp_pwa_dismissed', Date.now());
}

// iOS install hint (Safari doesn't fire beforeinstallprompt)
(function checkIOSInstall() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone === true;
  if (isIOS && !isStandalone && !localStorage.getItem('pp_pwa_dismissed')) {
    setTimeout(() => {
      const banner = document.getElementById('pwaInstallBanner');
      if (!banner) return;
      document.getElementById('pwaInstallBtn').textContent = 'How To';
      document.getElementById('pwaInstallBtn').onclick = function() {
        openModal(`
          <h2 style="margin-bottom:1rem"><i class="fas fa-mobile-alt" style="color:var(--peach)"></i> Install Peachy Pals</h2>
          <p style="margin-bottom:1rem">Add Peachy Pals to your iPhone home screen:</p>
          <ol style="text-align:left;line-height:2;padding-left:1.5rem">
            <li>Tap the <strong>Share</strong> button <i class="fas fa-share-square"></i> at the bottom of Safari</li>
            <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
            <li>Tap <strong>"Add"</strong> in the top right</li>
          </ol>
          <p style="margin-top:1rem;color:var(--gray);font-size:0.9rem">The app will appear on your home screen just like a regular app!</p>
          <button class="btn btn-primary" style="margin-top:1rem" onclick="closeModal();dismissInstallBanner()">Got It</button>
        `);
      };
      banner.classList.add('visible');
    }, 3000);
  }
})();

// ==========================================
// HERO IMAGE SLIDER
// ==========================================
(function initHeroSlider() {
  const slides = document.querySelectorAll('.hero-slide');
  if (!slides.length) return;
  let current = 0;
  setInterval(() => {
    slides[current].classList.remove('active');
    current = (current + 1) % slides.length;
    slides[current].classList.add('active');
  }, 5000);
})();
