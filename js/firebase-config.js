// ==========================================
// FIREBASE CONFIGURATION - Peachy Pals Playland
// ==========================================
// BACKEND: Firebase Realtime Database
//
// RTDB RULES (paste in Firebase Console > Realtime Database > Rules):
// -------------------------------------------------------------------
// {
//   "rules": {
//     "bookings": { ".read": true, ".write": true },
//     "packages": { ".read": true, ".write": true },
//     "blockedDates": { ".read": true, ".write": true }
//   }
// }
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyCo4nZPAjeBXsFeaxJbDZWoQlP4CJcWs34",
  authDomain: "project-e0e63e59-c7f9-4e5b-b6f.firebaseapp.com",
  databaseURL: "https://project-e0e63e59-c7f9-4e5b-b6f-default-rtdb.firebaseio.com",
  projectId: "project-e0e63e59-c7f9-4e5b-b6f",
  storageBucket: "project-e0e63e59-c7f9-4e5b-b6f.firebasestorage.app",
  messagingSenderId: "226814066018",
  appId: "1:226814066018:web:e932a7ac8954943aca003b",
  measurementId: "G-Y2JJTL5E9Y"
};

// Initialize Firebase
let db;
let isFirebaseConfigured = false;

try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.database();
  isFirebaseConfigured = true;
  console.log("✅ Firebase Realtime Database connected");
} catch (e) {
  console.error("❌ Firebase initialization failed:", e);
  console.warn("⚠️ Falling back to localStorage.");
}

// ==========================================
// DATA STORE ABSTRACTION
// Uses Firebase RTDB with localStorage fallback
// ==========================================
const DataStore = {

  // ---- helpers ----
  _ref(path) { return db.ref(path); },

  // Convert RTDB snapshot to array with IDs
  _snapToArray(snap) {
    const arr = [];
    snap.forEach(child => {
      arr.push({ id: child.key, ...child.val() });
    });
    return arr;
  },

  // --- PACKAGES ---
  async getPackages() {
    if (isFirebaseConfigured) {
      const snap = await this._ref('packages').orderByChild('sortOrder').once('value');
      return this._snapToArray(snap);
    }
    return JSON.parse(localStorage.getItem('pp_packages') || '[]');
  },

  async savePackage(pkg) {
    if (isFirebaseConfigured) {
      if (pkg.id && !pkg.id.startsWith('pkg_')) {
        const id = pkg.id;
        const data = { ...pkg };
        delete data.id;
        await this._ref('packages/' + id).set(data);
        return id;
      }
      const data = { ...pkg };
      delete data.id;
      const ref = this._ref('packages').push();
      await ref.set(data);
      return ref.key;
    }
    const packages = JSON.parse(localStorage.getItem('pp_packages') || '[]');
    if (pkg.id) {
      const idx = packages.findIndex(p => p.id === pkg.id);
      if (idx >= 0) packages[idx] = pkg;
    } else {
      pkg.id = 'pkg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      packages.push(pkg);
    }
    localStorage.setItem('pp_packages', JSON.stringify(packages));
    return pkg.id;
  },

  async deletePackage(id) {
    if (isFirebaseConfigured) {
      await this._ref('packages/' + id).remove();
      return;
    }
    let packages = JSON.parse(localStorage.getItem('pp_packages') || '[]');
    packages = packages.filter(p => p.id !== id);
    localStorage.setItem('pp_packages', JSON.stringify(packages));
  },

  // --- BOOKINGS ---
  async createBooking(booking) {
    booking.createdAt = new Date().toISOString();
    booking.confirmationCode = 'PP-' + Date.now().toString(36).toUpperCase().slice(-6);
    if (isFirebaseConfigured) {
      const ref = this._ref('bookings').push();
      await ref.set(booking);
      return { id: ref.key, ...booking };
    }
    const bookings = JSON.parse(localStorage.getItem('pp_bookings') || '[]');
    booking.id = 'bk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    bookings.push(booking);
    localStorage.setItem('pp_bookings', JSON.stringify(bookings));
    return booking;
  },

  async findBookings(phone, lastName) {
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanLast = lastName.trim().toLowerCase();
    if (isFirebaseConfigured) {
      const snap = await this._ref('bookings').once('value');
      return this._snapToArray(snap)
        .filter(b => b.phone && b.phone.replace(/\D/g, '') === cleanPhone &&
                     b.lastName && b.lastName.toLowerCase() === cleanLast);
    }
    const bookings = JSON.parse(localStorage.getItem('pp_bookings') || '[]');
    return bookings.filter(b => b.phone.replace(/\D/g, '') === cleanPhone && b.lastName.toLowerCase() === cleanLast);
  },

  async getAllBookings() {
    if (isFirebaseConfigured) {
      const snap = await this._ref('bookings').orderByChild('createdAt').once('value');
      return this._snapToArray(snap).reverse();
    }
    return JSON.parse(localStorage.getItem('pp_bookings') || '[]').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async updateBooking(id, data) {
    if (isFirebaseConfigured) {
      await this._ref('bookings/' + id).update(data);
      return;
    }
    const bookings = JSON.parse(localStorage.getItem('pp_bookings') || '[]');
    const idx = bookings.findIndex(b => b.id === id);
    if (idx >= 0) Object.assign(bookings[idx], data);
    localStorage.setItem('pp_bookings', JSON.stringify(bookings));
  },

  async deleteBooking(id) {
    if (isFirebaseConfigured) {
      await this._ref('bookings/' + id).remove();
      return;
    }
    let bookings = JSON.parse(localStorage.getItem('pp_bookings') || '[]');
    bookings = bookings.filter(b => b.id !== id);
    localStorage.setItem('pp_bookings', JSON.stringify(bookings));
  },

  // --- BLOCKED DATES ---
  async getBlockedDates() {
    if (isFirebaseConfigured) {
      const snap = await this._ref('blockedDates').once('value');
      return this._snapToArray(snap);
    }
    return JSON.parse(localStorage.getItem('pp_blocked') || '[]');
  },

  async setBlockedDate(dateStr, blocked, slots, reason) {
    const data = { date: dateStr, blocked, blockedSlots: slots || [], reason: reason || '' };
    if (isFirebaseConfigured) {
      const snap = await this._ref('blockedDates').orderByChild('date').equalTo(dateStr).once('value');
      if (snap.exists()) {
        const key = Object.keys(snap.val())[0];
        await this._ref('blockedDates/' + key).update(data);
      } else {
        await this._ref('blockedDates').push().set(data);
      }
      return;
    }
    let dates = JSON.parse(localStorage.getItem('pp_blocked') || '[]');
    const idx = dates.findIndex(d => d.date === dateStr);
    if (idx >= 0) dates[idx] = { ...dates[idx], ...data };
    else { data.id = 'bd_' + Date.now(); dates.push(data); }
    localStorage.setItem('pp_blocked', JSON.stringify(dates));
  },

  // --- SEED DEFAULT PACKAGES ---
  async seedDefaults() {
    const existing = await this.getPackages();
    if (existing.length > 0) return;
    const defaults = [
      {
        name: "Just Peachy",
        subtitle: "Tues – Thurs",
        description: "Sweet, simple, and perfect for a playful celebration with your closest crew.",
        price: 229,
        maxGuests: 8,
        extraGuestFee: 12,
        duration: "2 hours",
        includes: ["Up to 8 kids", "2-hour private party room", "One drink + one snack per child", "$12 per extra child"],
        imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=400&fit=crop&auto=format",
        availableDays: ["Tuesday", "Wednesday", "Thursday"],
        active: true,
        sortOrder: 1
      },
      {
        name: "Peachy Pal",
        subtitle: "Tues – Thurs",
        description: "A classic party setup with everything you need to celebrate in style!",
        price: 379,
        maxGuests: 16,
        extraGuestFee: 12,
        duration: "2 hours",
        includes: ["Up to 16 kids", "2-hour private party room", "Everything from Just Peachy", "Goodie bag for each child", "Shirt for birthday pal", "$12 per extra child"],
        imageUrl: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600&h=400&fit=crop&auto=format",
        availableDays: ["Tuesday", "Wednesday", "Thursday"],
        active: true,
        sortOrder: 2
      },
      {
        name: "VIP Play Date",
        subtitle: "Any Day",
        description: "A fun and memorable play date for your little ones — the VIP experience!",
        price: 90,
        maxGuests: 4,
        extraGuestFee: 0,
        duration: "2 hours",
        includes: ["Up to 4 kids", "2 hours unlimited open play", "Fun arts & crafts project", "Snack & drink per child", "1 free balloon per child", "VIP guest sticker"],
        imageUrl: "https://images.unsplash.com/photo-1587654780291-39c9404d7dd0?w=600&h=400&fit=crop&auto=format",
        availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        active: true,
        sortOrder: 3
      }
    ];
    for (const pkg of defaults) {
      await this.savePackage(pkg);
    }
    console.log("✅ Default packages seeded to Firebase");
  }
};
