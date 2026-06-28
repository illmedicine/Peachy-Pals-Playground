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
//     "memberships": { ".read": true, ".write": true },
//     "blockedDates": { ".read": true, ".write": true }
//   }
// }
//
// STORAGE RULES (paste in Firebase Console > Storage > Rules):
// -------------------------------------------------------------------
// rules_version = '2';
// service firebase.storage {
//   match /b/{bucket}/o {
//     match /{allPaths=**} {
//       allow read: if true;
//       allow write: if true;
//     }
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
let storage;
let isFirebaseConfigured = false;

try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.database();
  storage = firebase.storage();
  isFirebaseConfigured = true;
  console.log("✅ Firebase connected (RTDB + Storage)");
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

  async getBookingsByDate(dateStr) {
    if (isFirebaseConfigured) {
      const snap = await this._ref('bookings').orderByChild('date').equalTo(dateStr).once('value');
      return this._snapToArray(snap).filter(b => b.status !== 'cancelled');
    }
    const bookings = JSON.parse(localStorage.getItem('pp_bookings') || '[]');
    return bookings.filter(b => b.date === dateStr && b.status !== 'cancelled');
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

  // --- MEMBERSHIPS ---
  async createMembership(membership) {
    membership.createdAt = new Date().toISOString();
    membership.membershipCode = 'PPM-' + Date.now().toString(36).toUpperCase().slice(-6);
    if (isFirebaseConfigured) {
      const ref = this._ref('memberships').push();
      await ref.set(membership);
      return { id: ref.key, ...membership };
    }
    const memberships = JSON.parse(localStorage.getItem('pp_memberships') || '[]');
    membership.id = 'mem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    memberships.push(membership);
    localStorage.setItem('pp_memberships', JSON.stringify(memberships));
    return membership;
  },

  async getAllMemberships() {
    if (isFirebaseConfigured) {
      const snap = await this._ref('memberships').orderByChild('createdAt').once('value');
      return this._snapToArray(snap).reverse();
    }
    return JSON.parse(localStorage.getItem('pp_memberships') || '[]').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async updateMembership(id, data) {
    if (isFirebaseConfigured) {
      await this._ref('memberships/' + id).update(data);
      return;
    }
    const memberships = JSON.parse(localStorage.getItem('pp_memberships') || '[]');
    const idx = memberships.findIndex(m => m.id === id);
    if (idx >= 0) Object.assign(memberships[idx], data);
    localStorage.setItem('pp_memberships', JSON.stringify(memberships));
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

  // --- IMAGE HANDLING ---
  _compressImage(file, maxWidth = 600, quality = 0.65) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.onload = function(e) {
        const img = new Image();
        img.onerror = () => reject(new Error('Could not load image — try JPG or PNG'));
        img.onload = function() {
          try {
            const canvas = document.createElement('canvas');
            let w = img.width, h = img.height;
            if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(dataUrl);
          } catch (err) {
            reject(new Error('Image compression failed'));
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  },

  async processAndUploadImage(file, onProgress) {
    onProgress('Compressing image...', 20);
    let compressed;
    try {
      compressed = await this._compressImage(file);
    } catch (err) {
      throw new Error('Compression failed: ' + err.message);
    }
    onProgress('Compressed! Uploading...', 40);

    // Try Firebase Storage first
    if (isFirebaseConfigured && storage) {
      try {
        const ext = 'jpg';
        const filename = 'packages/pkg_' + Date.now() + '.' + ext;
        const ref = storage.ref(filename);

        // Convert base64 to blob for upload
        const resp = await fetch(compressed);
        const blob = await resp.blob();

        const uploadPromise = ref.put(blob);
        const timeoutPromise = new Promise((_, rej) =>
          setTimeout(() => rej(new Error('timeout')), 15000)
        );
        const snapshot = await Promise.race([uploadPromise, timeoutPromise]);
        onProgress('Getting download URL...', 80);
        const url = await snapshot.ref.getDownloadURL();
        onProgress('Done!', 100);
        console.log('✅ Image uploaded to Firebase Storage');
        return url;
      } catch (storageErr) {
        console.warn('Firebase Storage unavailable, saving image inline:', storageErr.message);
      }
    }

    // Fallback: store base64 directly in RTDB
    onProgress('Saving image data...', 80);
    console.log('📦 Using inline base64 image (Storage not available)');
    onProgress('Done!', 100);
    return compressed;
  },

  // --- PACKAGE FIELD UPDATE ---
  async updatePackageFields(id, data) {
    if (isFirebaseConfigured) {
      await this._ref('packages/' + id).update(data);
      return;
    }
    const packages = JSON.parse(localStorage.getItem('pp_packages') || '[]');
    const idx = packages.findIndex(p => p.id === id);
    if (idx >= 0) Object.assign(packages[idx], data);
    localStorage.setItem('pp_packages', JSON.stringify(packages));
  },

  // --- MIGRATE EXISTING PACKAGES ---
  async migratePackages() {
    const pkgs = await this.getPackages();
    const allDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const weekdays = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
    for (const pkg of pkgs) {
      const updates = {};
      if (pkg.name === 'Just Peachy') {
        if (!pkg.weekendPrice) updates.weekendPrice = 299;
        if (pkg.availableDays && pkg.availableDays.length < 7) updates.availableDays = allDays;
        if (pkg.subtitle === 'Tues – Thurs') updates.subtitle = 'Any Day';
      }
      if (pkg.name === 'Peachy Pal') {
        if (!pkg.weekendPrice) updates.weekendPrice = 399;
        if (pkg.availableDays && pkg.availableDays.length < 7) updates.availableDays = allDays;
        if (pkg.subtitle === 'Tues – Thurs') updates.subtitle = 'Any Day';
      }
      // Fix range-style availableDays like ["Monday-Friday"]
      if (pkg.availableDays && pkg.availableDays.length > 0) {
        const hasRange = pkg.availableDays.some(d => d.includes('-'));
        if (hasRange) {
          const expanded = [];
          for (const entry of pkg.availableDays) {
            if (entry.includes('-')) {
              const lower = entry.toLowerCase();
              if (lower.includes('monday') && lower.includes('friday')) {
                expanded.push(...weekdays);
              } else if (lower.includes('monday') && lower.includes('sunday')) {
                expanded.push(...allDays);
              } else {
                expanded.push(...allDays);
              }
            } else {
              expanded.push(entry);
            }
          }
          const unique = [...new Set(expanded)];
          if (JSON.stringify(unique) !== JSON.stringify(pkg.availableDays)) {
            updates.availableDays = unique;
          }
        }
      }
      if (Object.keys(updates).length > 0) {
        await this.updatePackageFields(pkg.id, updates);
        console.log('✅ Migrated package:', pkg.name, updates);
      }
    }
  },

  // --- SEED DEFAULT PACKAGES ---
  async seedDefaults() {
    const existing = await this.getPackages();
    if (existing.length > 0) return;
    const defaults = [
      {
        name: "Just Peachy",
        subtitle: "Any Day",
        description: "Sweet, simple, and perfect for a playful celebration with your closest crew.",
        price: 229,
        weekendPrice: 299,
        maxGuests: 8,
        extraGuestFee: 12,
        duration: "2 hours",
        includes: ["Up to 8 kids", "2-hour party", "One drink + one snack per child", "Tue–Thu: $229 / Wknd & Mon: $299", "$12 per extra child"],
        imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=400&fit=crop&auto=format",
        availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        active: true,
        sortOrder: 1
      },
      {
        name: "Peachy Pal",
        subtitle: "Any Day",
        description: "A classic party setup with everything you need to celebrate in style!",
        price: 379,
        weekendPrice: 399,
        maxGuests: 16,
        extraGuestFee: 12,
        duration: "2 hours",
        includes: ["Up to 16 kids", "2-hour party", "Everything from Just Peachy", "Goodie bag for each child", "Shirt for birthday pal", "Tue–Thu: $379 / Wknd & Mon: $399", "$12 per extra child"],
        imageUrl: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600&h=400&fit=crop&auto=format",
        availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
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
