// ==========================================
// FIREBASE CONFIGURATION - Peachy Pals Playland
// ==========================================
// SETUP INSTRUCTIONS:
// 1. Go to https://console.firebase.google.com
// 2. Select your existing Firebase project
// 3. Go to Project Settings > General
// 4. Scroll to "Your apps" > click web icon (</>)
// 5. Register app, copy config values below
// 6. Enable Cloud Firestore in Firebase console
// 7. Set Firestore rules (see below)
//
// FIRESTORE RULES (paste in Firebase Console > Firestore > Rules):
// ---------------------------------------------------------------
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     match /bookings/{bookingId} {
//       allow read, write: if true;
//     }
//     match /packages/{packageId} {
//       allow read: if true;
//       allow write: if true;
//     }
//     match /blockedDates/{dateId} {
//       allow read: if true;
//       allow write: if true;
//     }
//     match /settings/{settingId} {
//       allow read: if true;
//       allow write: if true;
//     }
//   }
// }
// ==========================================

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
let db;
let isFirebaseConfigured = false;

try {
  if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    isFirebaseConfigured = true;
    console.log("✅ Firebase connected successfully");
  } else {
    console.warn("⚠️ Firebase not configured — using localStorage fallback. Update js/firebase-config.js with your Firebase project credentials.");
  }
} catch (e) {
  console.error("❌ Firebase initialization failed:", e);
  console.warn("⚠️ Falling back to localStorage.");
}

// ==========================================
// DATA STORE ABSTRACTION
// Automatically uses Firebase or localStorage
// ==========================================
const DataStore = {

  // --- PACKAGES ---
  async getPackages() {
    if (isFirebaseConfigured) {
      const snap = await db.collection('packages').orderBy('sortOrder').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    return JSON.parse(localStorage.getItem('pp_packages') || '[]');
  },

  async savePackage(pkg) {
    if (isFirebaseConfigured) {
      if (pkg.id) {
        await db.collection('packages').doc(pkg.id).set(pkg, { merge: true });
        return pkg.id;
      }
      const ref = await db.collection('packages').add(pkg);
      return ref.id;
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
      await db.collection('packages').doc(id).delete();
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
      const ref = await db.collection('bookings').add(booking);
      return { id: ref.id, ...booking };
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
      const snap = await db.collection('bookings').get();
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(b => b.phone.replace(/\D/g, '') === cleanPhone && b.lastName.toLowerCase() === cleanLast);
    }
    const bookings = JSON.parse(localStorage.getItem('pp_bookings') || '[]');
    return bookings.filter(b => b.phone.replace(/\D/g, '') === cleanPhone && b.lastName.toLowerCase() === cleanLast);
  },

  async getAllBookings() {
    if (isFirebaseConfigured) {
      const snap = await db.collection('bookings').orderBy('createdAt', 'desc').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    return JSON.parse(localStorage.getItem('pp_bookings') || '[]').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async updateBooking(id, data) {
    if (isFirebaseConfigured) {
      await db.collection('bookings').doc(id).update(data);
      return;
    }
    const bookings = JSON.parse(localStorage.getItem('pp_bookings') || '[]');
    const idx = bookings.findIndex(b => b.id === id);
    if (idx >= 0) Object.assign(bookings[idx], data);
    localStorage.setItem('pp_bookings', JSON.stringify(bookings));
  },

  async deleteBooking(id) {
    if (isFirebaseConfigured) {
      await db.collection('bookings').doc(id).delete();
      return;
    }
    let bookings = JSON.parse(localStorage.getItem('pp_bookings') || '[]');
    bookings = bookings.filter(b => b.id !== id);
    localStorage.setItem('pp_bookings', JSON.stringify(bookings));
  },

  // --- BLOCKED DATES ---
  async getBlockedDates() {
    if (isFirebaseConfigured) {
      const snap = await db.collection('blockedDates').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    return JSON.parse(localStorage.getItem('pp_blocked') || '[]');
  },

  async setBlockedDate(dateStr, blocked, slots, reason) {
    const data = { date: dateStr, blocked, blockedSlots: slots || [], reason: reason || '' };
    if (isFirebaseConfigured) {
      const snap = await db.collection('blockedDates').where('date', '==', dateStr).get();
      if (!snap.empty) {
        await snap.docs[0].ref.set(data, { merge: true });
      } else {
        await db.collection('blockedDates').add(data);
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
    console.log("✅ Default packages seeded");
  }
};
