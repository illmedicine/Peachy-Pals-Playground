/* ==========================================
   PEACHY PALS PLAYLAND — Application Logic
   ========================================== */

// ==========================================
// CONFIGURATION
// ==========================================
const CONFIG = {
  adminCode: '4931',
  depositPercent: 50,
  timeSlots: ['10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'],
  businessPhone: '(770) 387-1020',
  businessEmail: 'info@peachypalsplay.com',
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

// ==========================================
// NAVIGATION & ROUTING
// ==========================================
function navigate(view) {
  window.location.hash = view;
}

function handleRoute() {
  const hash = window.location.hash.slice(1) || 'home';
  const validViews = ['home', 'packages', 'booking', 'manage', 'admin'];
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
        <div class="pkg-card-price">$${pkg.price}<small> ${pkg.maxGuests ? '/ up to ' + pkg.maxGuests + ' guests' : ''}</small></div>
        ${includesHtml ? `<ul class="pkg-card-includes">${includesHtml}</ul>` : ''}
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
  bookingStep(4);
}

function renderPaymentSummary() {
  const pkg = selectedPackage;
  const numKids = parseInt(document.getElementById('bkNumKids').value) || 0;
  const extraKids = Math.max(0, numKids - (pkg.maxGuests || 0));
  const extraFee = extraKids * (pkg.extraGuestFee || 0);
  const total = pkg.price + extraFee;
  const deposit = Math.ceil(total * CONFIG.depositPercent / 100);

  document.getElementById('paymentSummary').innerHTML = `
    <h3 style="margin-bottom:1rem">Booking Summary</h3>
    <table style="width:100%;font-size:0.95rem">
      <tr><td><strong>Package:</strong></td><td>${escapeHtml(pkg.name)}</td></tr>
      <tr><td><strong>Date:</strong></td><td>${formatDateDisplay(selectedDate)}</td></tr>
      <tr><td><strong>Time:</strong></td><td>${selectedTime}</td></tr>
      <tr><td><strong>Guest:</strong></td><td>${escapeHtml(document.getElementById('bkChildName').value)}</td></tr>
      <tr><td><strong>Kids:</strong></td><td>${numKids}</td></tr>
      ${extraKids > 0 ? `<tr><td><strong>Extra kids (${extraKids}):</strong></td><td>+$${extraFee}</td></tr>` : ''}
      <tr><td colspan="2"><hr style="margin:0.5rem 0"></td></tr>
      <tr><td><strong>Total:</strong></td><td style="font-size:1.3rem;font-weight:900;color:var(--peach-dark)">$${total}</td></tr>
      <tr><td><strong>Deposit (${CONFIG.depositPercent}%):</strong></td><td style="font-size:1.2rem;font-weight:900;color:var(--teal-dark)">$${deposit}</td></tr>
    </table>
  `;

  // Payment method listeners
  document.querySelectorAll('input[name="payMethod"]').forEach(radio => {
    radio.addEventListener('change', function() {
      const info = CONFIG.paymentInfo[this.value];
      document.getElementById('paymentInstructions').innerHTML = info ? info.instructions : '';
    });
  });
}

async function submitBooking() {
  const payMethod = document.querySelector('input[name="payMethod"]:checked');
  if (!payMethod) {
    showToast('Please select a payment method', 'error');
    return;
  }

  const pkg = selectedPackage;
  const numKids = parseInt(document.getElementById('bkNumKids').value) || 0;
  const extraKids = Math.max(0, numKids - (pkg.maxGuests || 0));
  const total = pkg.price + extraKids * (pkg.extraGuestFee || 0);
  const deposit = Math.ceil(total * CONFIG.depositPercent / 100);

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
    numberOfKids: numKids,
    numberOfAdults: parseInt(document.getElementById('bkNumAdults').value) || 0,
    specialRequests: document.getElementById('bkRequests').value.trim(),
    status: 'pending',
    depositPaid: false,
    depositAmount: deposit,
    totalPrice: total,
    paymentMethod: payMethod.value
  };

  try {
    const result = await DataStore.createBooking(booking);
    launchConfetti();
    showToast('Booking created successfully!', 'success');

    document.getElementById('confirmationBox').innerHTML = `
      <div style="font-size:4rem;margin-bottom:1rem">🎉</div>
      <h2>Booking Confirmed!</h2>
      <p style="color:var(--gray);margin-bottom:1rem">Your party booking has been received. Here's your confirmation code:</p>
      <div class="confirmation-code">${result.confirmationCode}</div>
      <div style="text-align:left;margin:1.5rem 0;padding:1rem;background:var(--cream);border-radius:var(--radius)">
        <p><strong>Package:</strong> ${escapeHtml(pkg.name)}</p>
        <p><strong>Date:</strong> ${formatDateDisplay(selectedDate)}</p>
        <p><strong>Time:</strong> ${selectedTime}</p>
        <p><strong>Child:</strong> ${escapeHtml(booking.childName)} (Age ${booking.childAge})</p>
        <p><strong>Total:</strong> $${total} | <strong>Deposit Due:</strong> $${deposit}</p>
        <p><strong>Payment:</strong> ${CONFIG.paymentInfo[payMethod.value]?.label || payMethod.value}</p>
      </div>
      <p style="color:var(--gray);font-size:0.9rem;margin-bottom:1.5rem">
        Save your confirmation code! Use your <strong>phone number</strong> and <strong>last name</strong> to manage your booking anytime.
      </p>
      <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="navigate('home')"><i class="fas fa-home"></i> Back Home</button>
        <button class="btn btn-secondary" onclick="navigate('manage')"><i class="fas fa-clipboard-list"></i> Manage Booking</button>
      </div>
    `;
    bookingStep(5);
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
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-day empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(calendarYear, calendarMonth, d);
    const dateStr = formatDate(date);
    const isPast = date < today;
    const isToday = date.getTime() === today.getTime();
    const isBlocked = blockedDates.some(b => b.date === dateStr && b.blocked);
    const isSelected = selectedDate === dateStr;

    // Check if package is available on this day
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
    const pkgAvailable = !selectedPackage?.availableDays || selectedPackage.availableDays.includes(dayName);

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

function selectDate(dateStr) {
  selectedDate = dateStr;
  selectedTime = null;
  renderCalendar();
  renderTimeSlots();
  document.getElementById('selectedDateLabel').textContent = formatDateDisplay(dateStr);
  document.getElementById('btnToStep3').disabled = true;
}

function renderTimeSlots() {
  const grid = document.getElementById('timeSlotsGrid');
  if (!selectedDate) { grid.innerHTML = ''; return; }

  const blocked = blockedDates.find(b => b.date === selectedDate);
  const blockedSlots = blocked?.blockedSlots || [];

  grid.innerHTML = CONFIG.timeSlots.map(slot => {
    const isBlocked = blockedSlots.includes(slot);
    const isSelected = selectedTime === slot;
    return `<div class="time-slot ${isBlocked ? 'disabled' : ''} ${isSelected ? 'selected' : ''}"
                 ${!isBlocked ? `onclick="selectTime('${slot}')"` : ''}>${slot}</div>`;
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
        <div class="price">$${pkg.price}</div>
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
        <div class="form-group"><label>Price ($) *</label><input type="number" id="pkgPrice" value="${pkg?.price || ''}" min="0"></div>
        <div class="form-group"><label>Max Guests *</label><input type="number" id="pkgMaxGuests" value="${pkg?.maxGuests || ''}" min="1"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Extra Guest Fee ($)</label><input type="number" id="pkgExtraFee" value="${pkg?.extraGuestFee || 0}" min="0"></div>
        <div class="form-group"><label>Duration</label><input type="text" id="pkgDuration" value="${escapeHtml(pkg?.duration || '2 hours')}"></div>
      </div>
      <div class="form-group"><label>Image URL</label><input type="url" id="pkgImageUrl" value="${escapeHtml(pkg?.imageUrl || '')}" placeholder="https://..."></div>
      <div class="form-group"><label>Includes (one per line)</label><textarea id="pkgIncludes" rows="4">${(pkg?.includes || []).join('\n')}</textarea></div>
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

async function savePackageAdmin(pkgId) {
  const name = document.getElementById('pkgName').value.trim();
  const price = parseFloat(document.getElementById('pkgPrice').value);
  const maxGuests = parseInt(document.getElementById('pkgMaxGuests').value);

  if (!name || isNaN(price) || isNaN(maxGuests)) {
    showToast('Please fill in required fields', 'error');
    return;
  }

  const pkg = {
    name,
    subtitle: document.getElementById('pkgSubtitle').value.trim(),
    description: document.getElementById('pkgDesc').value.trim(),
    price,
    maxGuests,
    extraGuestFee: parseFloat(document.getElementById('pkgExtraFee').value) || 0,
    duration: document.getElementById('pkgDuration').value.trim(),
    imageUrl: document.getElementById('pkgImageUrl').value.trim(),
    includes: document.getElementById('pkgIncludes').value.split('\n').map(s => s.trim()).filter(Boolean),
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

  const html = `
    <h2>Time Slots for ${formatDateDisplay(dateStr)}</h2>
    <p style="margin:0.5rem 0 1rem;color:var(--gray)">Toggle individual time slots on/off:</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
      ${CONFIG.timeSlots.map(slot => {
        const isBlocked = blockedSlots.includes(slot);
        return `<label style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem;border-radius:8px;background:${isBlocked ? '#FFEBEE' : '#E8F5E9'};cursor:pointer">
          <input type="checkbox" class="slot-cb" value="${slot}" ${isBlocked ? 'checked' : ''}> ${slot} ${isBlocked ? '(blocked)' : '(open)'}
        </label>`;
      }).join('')}
    </div>
    <button class="btn btn-primary" style="margin-top:1.5rem" onclick="saveTimeSlots('${dateStr}')"><i class="fas fa-save"></i> Save</button>
  `;
  openModal(html);
}

async function saveTimeSlots(dateStr) {
  const checkedSlots = [...document.querySelectorAll('.slot-cb:checked')].map(cb => cb.value);
  const isFullyBlocked = checkedSlots.length === CONFIG.timeSlots.length;
  await DataStore.setBlockedDate(dateStr, isFullyBlocked, checkedSlots, '');
  blockedDates = await DataStore.getBlockedDates();
  closeModal();
  renderAdminCalendar();
  adminSelectDate(dateStr);
  showToast('Time slots updated', 'success');
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
  // Seed default packages if empty
  await DataStore.seedDefaults();

  // Render home packages
  await renderHomePackages();

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
