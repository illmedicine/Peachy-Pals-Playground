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
//     "services": { ".read": true, ".write": true },
//     "blockedDates": { ".read": true, ".write": true },
//     "waivers": { ".read": true, ".write": true },
//     "notifications": { ".read": true, ".write": true },
//     "posts": { ".read": true, ".write": true }
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

  // --- SERVICES (Homepage cards) ---
  async getServices() {
    if (isFirebaseConfigured) {
      const snap = await this._ref('services').orderByChild('sortOrder').once('value');
      return this._snapToArray(snap);
    }
    return JSON.parse(localStorage.getItem('pp_services') || '[]');
  },

  async saveService(svc) {
    if (isFirebaseConfigured) {
      if (svc.id) {
        const id = svc.id;
        const data = { ...svc }; delete data.id;
        await this._ref('services/' + id).set(data);
        return id;
      }
      const data = { ...svc }; delete data.id;
      const ref = this._ref('services').push();
      await ref.set(data);
      return ref.key;
    }
    const services = JSON.parse(localStorage.getItem('pp_services') || '[]');
    if (svc.id) {
      const idx = services.findIndex(s => s.id === svc.id);
      if (idx >= 0) services[idx] = svc;
    } else {
      svc.id = 'svc_' + Date.now();
      services.push(svc);
    }
    localStorage.setItem('pp_services', JSON.stringify(services));
    return svc.id;
  },

  async seedServices() {
    const existing = await this.getServices();
    if (existing.length > 0) return;
    const defaults = [
      { title: "Open Play", price: "$12", priceNote: "/ 2 hours", description: "Flexible playtime in our indoor play space. $18 for unlimited play. Adults free. Grippy socks required.", imageUrl: "https://images.unsplash.com/photo-1566140967404-b8b3932483f5?w=600&h=300&fit=crop&auto=format", featured: false, buttonText: "", buttonAction: "", sortOrder: 1 },
      { title: "Birthday Parties", price: "From $229", priceNote: "", description: "Private party room, dedicated playtime, staff support & full cleanup.", imageUrl: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600&h=300&fit=crop&auto=format", featured: true, buttonText: "View Packages", buttonAction: "navigate('packages')", sortOrder: 2 },
      { title: "Memberships", price: "From $55", priceNote: "/mo", description: "Unlimited visits! Monthly: $65/child. Annual: $55/child. +$20/mo per additional sibling.", imageUrl: "https://images.unsplash.com/photo-1587654780291-39c9404d7dd0?w=600&h=300&fit=crop&auto=format", featured: false, buttonText: "View Memberships", buttonAction: "navigate('memberships')", sortOrder: 3 },
      { title: "Field Trips", price: "", priceNote: "", description: "Schools, daycares, camps & homeschool groups welcome for structured group play.", imageUrl: "https://images.unsplash.com/photo-1472162072942-cd5147eb3902?w=600&h=300&fit=crop&auto=format", featured: false, buttonText: "Inquire Now", buttonAction: "mailto:info@peachypalsplay.com", sortOrder: 4 },
      { title: "Balloon Bar", price: "From $3", priceNote: "", description: "Helium fill-up $3–$5. Mini bundles from $15. Custom bouquets from $35. Characters from $10.", imageUrl: "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=600&h=300&fit=crop&auto=format", featured: false, buttonText: "", buttonAction: "", sortOrder: 5 },
      { title: "Digital Waiver", price: "", priceNote: "", description: "Complete once, play all year! Fast, easy, and good for 12 months.", imageUrl: "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=600&h=300&fit=crop&auto=format", featured: false, buttonText: "Sign Waiver", buttonAction: "navigate('waiver')", sortOrder: 6 }
    ];
    for (const svc of defaults) await this.saveService(svc);
    console.log("✅ Default services seeded");
  },

  // --- NOTIFICATIONS ---
  async getNotifications() {
    if (isFirebaseConfigured) {
      const snap = await this._ref('notifications').orderByChild('createdAt').once('value');
      return this._snapToArray(snap).reverse();
    }
    return JSON.parse(localStorage.getItem('pp_notifications') || '[]').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async createNotification(notif) {
    notif.createdAt = new Date().toISOString();
    notif.read = false;
    if (isFirebaseConfigured) {
      const ref = this._ref('notifications').push();
      await ref.set(notif);
      return { id: ref.key, ...notif };
    }
    const notifs = JSON.parse(localStorage.getItem('pp_notifications') || '[]');
    notif.id = 'notif_' + Date.now();
    notifs.push(notif);
    localStorage.setItem('pp_notifications', JSON.stringify(notifs));
    return notif;
  },

  async markNotificationRead(id) {
    if (isFirebaseConfigured) {
      await this._ref('notifications/' + id).update({ read: true });
      return;
    }
    const notifs = JSON.parse(localStorage.getItem('pp_notifications') || '[]');
    const idx = notifs.findIndex(n => n.id === id);
    if (idx >= 0) notifs[idx].read = true;
    localStorage.setItem('pp_notifications', JSON.stringify(notifs));
  },

  async markAllNotificationsRead() {
    if (isFirebaseConfigured) {
      const snap = await this._ref('notifications').once('value');
      const updates = {};
      snap.forEach(child => { updates[child.key + '/read'] = true; });
      if (Object.keys(updates).length) await this._ref('notifications').update(updates);
      return;
    }
    const notifs = JSON.parse(localStorage.getItem('pp_notifications') || '[]');
    notifs.forEach(n => n.read = true);
    localStorage.setItem('pp_notifications', JSON.stringify(notifs));
  },

  async deleteNotification(id) {
    if (isFirebaseConfigured) {
      await this._ref('notifications/' + id).remove();
      return;
    }
    let notifs = JSON.parse(localStorage.getItem('pp_notifications') || '[]');
    notifs = notifs.filter(n => n.id !== id);
    localStorage.setItem('pp_notifications', JSON.stringify(notifs));
  },

  // --- WAIVERS ---
  async createWaiver(waiver) {
    waiver.createdAt = new Date().toISOString();
    waiver.waiverId = 'WVR-' + Date.now().toString(36).toUpperCase().slice(-6);
    if (isFirebaseConfigured) {
      const ref = this._ref('waivers').push();
      await ref.set(waiver);
      return { id: ref.key, ...waiver };
    }
    const waivers = JSON.parse(localStorage.getItem('pp_waivers') || '[]');
    waiver.id = 'wvr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    waivers.push(waiver);
    localStorage.setItem('pp_waivers', JSON.stringify(waivers));
    return waiver;
  },

  async getAllWaivers() {
    if (isFirebaseConfigured) {
      const snap = await this._ref('waivers').orderByChild('createdAt').once('value');
      return this._snapToArray(snap).reverse();
    }
    return JSON.parse(localStorage.getItem('pp_waivers') || '[]').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async findWaiversByPhone(phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    if (isFirebaseConfigured) {
      const snap = await this._ref('waivers').once('value');
      return this._snapToArray(snap)
        .filter(w => w.phone && w.phone.replace(/\D/g, '') === cleanPhone)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    const waivers = JSON.parse(localStorage.getItem('pp_waivers') || '[]');
    return waivers.filter(w => w.phone && w.phone.replace(/\D/g, '') === cleanPhone)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async getWaiversByBooking(bookingId) {
    if (isFirebaseConfigured) {
      const snap = await this._ref('waivers').orderByChild('bookingId').equalTo(bookingId).once('value');
      return this._snapToArray(snap);
    }
    const waivers = JSON.parse(localStorage.getItem('pp_waivers') || '[]');
    return waivers.filter(w => w.bookingId === bookingId);
  },

  async deleteWaiver(id) {
    if (isFirebaseConfigured) {
      await this._ref('waivers/' + id).remove();
      return;
    }
    let waivers = JSON.parse(localStorage.getItem('pp_waivers') || '[]');
    waivers = waivers.filter(w => w.id !== id);
    localStorage.setItem('pp_waivers', JSON.stringify(waivers));
  },

  // --- POSTS (Blog) ---
  async getAllPosts(publishedOnly = true) {
    if (isFirebaseConfigured) {
      const snap = await this._ref('posts').orderByChild('publishDate').once('value');
      const posts = this._snapToArray(snap).reverse();
      return publishedOnly ? posts.filter(p => p.published !== false) : posts;
    }
    const posts = JSON.parse(localStorage.getItem('pp_posts') || '[]');
    const sorted = posts.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));
    return publishedOnly ? sorted.filter(p => p.published !== false) : sorted;
  },

  async getPost(id) {
    if (isFirebaseConfigured) {
      const snap = await this._ref('posts/' + id).once('value');
      if (!snap.exists()) return null;
      return { id: snap.key, ...snap.val() };
    }
    const posts = JSON.parse(localStorage.getItem('pp_posts') || '[]');
    return posts.find(p => p.id === id) || null;
  },

  async createPost(post) {
    post.createdAt = new Date().toISOString();
    if (!post.publishDate) post.publishDate = new Date().toISOString();
    if (post.published === undefined) post.published = true;
    if (isFirebaseConfigured) {
      const ref = this._ref('posts').push();
      await ref.set(post);
      return { id: ref.key, ...post };
    }
    const posts = JSON.parse(localStorage.getItem('pp_posts') || '[]');
    post.id = 'post_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    posts.push(post);
    localStorage.setItem('pp_posts', JSON.stringify(posts));
    return post;
  },

  async updatePost(id, data) {
    data.updatedAt = new Date().toISOString();
    if (isFirebaseConfigured) {
      await this._ref('posts/' + id).update(data);
      return;
    }
    const posts = JSON.parse(localStorage.getItem('pp_posts') || '[]');
    const idx = posts.findIndex(p => p.id === id);
    if (idx >= 0) Object.assign(posts[idx], data);
    localStorage.setItem('pp_posts', JSON.stringify(posts));
  },

  async deletePost(id) {
    if (isFirebaseConfigured) {
      await this._ref('posts/' + id).remove();
      return;
    }
    let posts = JSON.parse(localStorage.getItem('pp_posts') || '[]');
    posts = posts.filter(p => p.id !== id);
    localStorage.setItem('pp_posts', JSON.stringify(posts));
  },

  async seedPosts() {
    const existing = await this.getAllPosts(false);
    if (existing.length > 0) return;
    const d = days => new Date(Date.now() - days * 86400000).toISOString();
    const articles = [
      {
        title: 'Why We Built the Peachy Pit',
        category: 'Sensory Play',
        featured: true,
        published: true,
        publishDate: d(0),
        imageUrl: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=1200&h=600&fit=crop&auto=format',
        excerpt: 'Our indoor sand area isn\'t just a play feature — it\'s a carefully designed sensory environment built on over 20 years of early childhood education experience.',
        body: '<p>When we designed Peachy Pals Playland, we knew we wanted something truly special — something children would talk about long after they left. That\'s how the Peachy Pit was born: our one-of-a-kind indoor sensory sand area.</p><p>As an early childhood educator with over 20 years of experience, I\'ve seen firsthand how powerfully sand play supports development. When a child fills a bucket, pats it flat, or runs their fingers through the sand, they\'re not just playing — they\'re building fine motor skills, exploring cause and effect, developing spatial reasoning, and practicing the kind of unscripted imaginative play that is essential to healthy cognitive growth in the early years.</p><p>For infants and toddlers especially, sensory sand play stimulates the nervous system in gentle, natural ways. Feeling different textures, sensing temperature changes, hearing soft sounds — these experiences fire hundreds of neural connections simultaneously and build critical neural pathways during the most important window of brain development.</p><p>We designed the Peachy Pit to welcome every child we serve — from crawling 6-month-olds to adventurous 8-year-olds. We use premium non-toxic indoor play sand, rake and refresh it daily, and monitor it throughout every session. Because our facility is shoeless, the Peachy Pit stays dramatically cleaner than any outdoor sandbox. We pair it with age-appropriate tools: scoops and molds for toddlers, construction trucks for older kids, and open-ended exploration for everyone.</p><p>The Peachy Pit is included with every open play session and every birthday party booking — it is not an add-on. We believe every child deserves access to this kind of rich, imaginative, sensory-driven play. We can\'t wait to see what your little ones build.</p><p><em>— Cherish, Founder, Peachy Pals Playland</em></p>'
      },
      {
        title: 'How We Keep Peachy Pals Clean & Safe',
        category: 'Safety & Cleanliness',
        featured: false,
        published: true,
        publishDate: d(3),
        imageUrl: 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=1200&h=600&fit=crop&auto=format',
        excerpt: 'Cleanliness isn\'t just a policy at Peachy Pals — it\'s a commitment we make to every family who walks through our doors.',
        body: '<p>When you bring your child to Peachy Pals Playland, you\'re trusting us with something precious. That responsibility is never far from our minds — and it\'s why cleanliness and safety sit at the very top of everything we do.</p><p>Before we open each morning, our team completes a comprehensive cleaning routine. Every surface is treated with hospital-grade, child-safe disinfectants. Play structures, sensory areas, the Peachy Pit, and all shared toys are sanitized thoroughly. High-touch areas like door handles, tables, and restrooms are cleaned multiple times throughout the day. At closing, we do a full deep clean — every toy washed, every surface treated, every corner checked.</p><p>Grippy socks are required for all guests because this single policy dramatically reduces what comes into contact with our floors and play surfaces. Shoes carry outdoor contaminants from parking lots, sidewalks, and everywhere in between. Going shoeless keeps the play environment significantly cleaner for every child.</p><p>Every member of our team is trained in First Aid and CPR. We maintain a current emergency preparedness plan and we carefully manage our capacity so our space never becomes overcrowded or unsafe. A comfortable, calm environment is a safer environment — and it\'s also a better one.</p><p>When you see a team member wiping down a table mid-session or refreshing the Peachy Pit, that\'s our team showing how much we care about your family\'s visit. Cleanliness is a love language at Peachy Pals.</p><p><em>— Cherish, Founder, Peachy Pals Playland</em></p>'
      },
      {
        title: 'The Science Behind Sensory Play',
        category: 'Child Development',
        featured: false,
        published: true,
        publishDate: d(6),
        imageUrl: 'https://images.unsplash.com/photo-1551966775-a4ddc8df052b?w=1200&h=600&fit=crop&auto=format',
        excerpt: 'What looks like a child simply digging in sand is actually a profound learning experience backed by decades of child development research.',
        body: '<p>One of the questions I hear most from parents is: "Is my child actually learning when they play?" As an early childhood educator with more than 20 years of experience, my answer — rooted in decades of research — is a resounding yes. Play is learning. And sensory play is some of the most powerful learning a young child can do.</p><p>Sensory play is any activity that stimulates a child\'s senses: touch, sight, sound, smell. When children engage with materials like sand, water, or play dough, they aren\'t just having fun — they\'re building critical neural pathways. Research from neuroscience shows that sensory experiences are among the most powerful stimuli for early brain development. When a toddler touches sand, their brain fires hundreds of connections simultaneously, processing texture, temperature, weight, and movement all at once.</p><p>The benefits are wide-ranging. Fine motor skills develop through scooping, pouring, and pinching. Language grows naturally through sensory vocabulary — soft, rough, heavy, empty, full. Cognitive skills emerge as children experiment and problem-solve. And for many children, sensory activities are deeply calming — the repetitive nature of pouring sand can help a dysregulated child find their way back to calm.</p><p>Every element of Peachy Pals Playland is designed with these principles in mind. The Peachy Pit provides rich tactile sand play. Our open play areas encourage large-motor exploration. We don\'t just provide a play space — we provide a developmental ecosystem. When your child is elbow-deep in the Peachy Pit, they are building their brain, one scoop at a time.</p><p><em>— Cherish, Founder, Peachy Pals Playland</em></p>'
      },
      {
        title: 'A Night at Peachy Pals: What Happens After We Close',
        category: 'Behind the Scenes',
        featured: false,
        published: true,
        publishDate: d(10),
        imageUrl: 'https://images.unsplash.com/photo-1558008258-3256797b43f3?w=1200&h=600&fit=crop&auto=format',
        excerpt: 'Ever wonder what happens at Peachy Pals after the last family waves goodbye? Here\'s an honest look at our nightly routine.',
        body: '<p>Every day at Peachy Pals Playland ends the same way: families head home with tired, happy kids, the doors close, and our team gets to work. What happens in those hours between closing time and the next morning\'s opening is something we\'re proud of — and we want you to know about it.</p><p>As our last families wave goodbye, staff begin a sweep of the entire play space. Stray items are collected, anything needing immediate attention is noted, and the team divides into zones. Every toy in the facility is gathered, washed with child-safe disinfectant, and laid out to dry. Soft items go through our sanitizing process. Play structures are wiped down from top to bottom — every slide, every rung, every surface that little hands touched.</p><p>The Peachy Pit gets special attention every night. We rake the sand thoroughly, remove any items that don\'t belong, and treat the surrounding border surfaces. The sand itself is monitored on a regular schedule and refreshed as needed to maintain freshness and hygiene. Our floors are swept and then cleaned with our hospital-grade solution, with extra care given to high-traffic transition zones.</p><p>Once cleaning is complete, we prepare for the next day: toys organized, supplies restocked, team walkthrough. Only when the space passes inspection does the workday end. By the time you arrive the next morning, Peachy Pals is fresh, clean, and ready for your family. That\'s our promise — every single day.</p><p><em>— Cherish, Founder, Peachy Pals Playland</em></p>'
      },
      {
        title: 'Birthday Party Planning Tips from Our Team',
        category: 'Birthday Parties',
        featured: false,
        published: true,
        publishDate: d(14),
        imageUrl: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1200&h=600&fit=crop&auto=format',
        excerpt: 'We\'ve helped hundreds of families celebrate their little ones\' big days. Here\'s what we\'ve learned about making them truly memorable.',
        body: '<p>Birthday parties are one of our favorite things at Peachy Pals Playland. Over the years, we\'ve helped hundreds of families celebrate their children\'s special days — and we\'ve learned a lot. Here are our best tips for a truly memorable party.</p><p><strong>Book Early.</strong> Weekend party slots fill up quickly, especially during spring and fall. We recommend booking at least 4–6 weeks in advance, and 8–10 weeks for popular Saturdays. You can book directly on our website — it takes just a few minutes.</p><p><strong>Choose the Right Package.</strong> Our Just Peachy package is perfect for smaller gatherings (up to 8 kids). Peachy Pal accommodates up to 16 kids and includes goodie bags and a birthday shirt for the guest of honor. Our VIP Play Date is ideal for intimate play dates of up to 4 children with arts & crafts and snacks included. Not sure which to choose? Call or email us — we\'re happy to help.</p><p><strong>Communicate the Shoe Rule Early.</strong> Let your guests know ahead of time that grippy socks are required at Peachy Pals. Include this in your invitation so families come prepared. We do sell socks at the front desk if anyone forgets.</p><p><strong>Trust Our Team.</strong> One of the biggest benefits of celebrating at Peachy Pals is that you don\'t have to do it all yourself. Our team handles setup, cleanup, and keeps things running smoothly so you can be fully present for your child. Let us take care of the details — your only job is to celebrate.</p><p><em>— The Peachy Pals Team</em></p>'
      },
      {
        title: 'Getting the Most Out of Your Peachy Pals Visit',
        category: 'Parent Resources',
        featured: false,
        published: true,
        publishDate: d(18),
        imageUrl: 'https://images.unsplash.com/photo-1587654780291-39c9404d7dd0?w=1200&h=600&fit=crop&auto=format',
        excerpt: 'A few simple tips to help your family arrive prepared and leave with big smiles — every single time.',
        body: '<p>Whether it\'s your first visit or you\'re a seasoned Peachy Pals regular, a little preparation goes a long way toward making sure your family has the best possible time. Here\'s what we recommend.</p><p><strong>Sign Your Waiver Before You Arrive.</strong> Our digital waiver is valid for 12 months and covers your entire family. Signing before your visit saves time at check-in and gets your kids into the play space faster. You can sign anytime at peachypalsplay.com — it takes about 3 minutes.</p><p><strong>Pack the Grippy Socks.</strong> Grippy socks are required for all guests. Toss a pair in your bag the night before. We sell socks at the front desk if you forget, but coming prepared means more time playing. Toddlers especially love picking out their pair ahead of time!</p><p><strong>Dress for Adventure.</strong> The Peachy Pit is magical and it is also sandy. Dress your children in comfortable clothes that can handle some adventure. Very young children may benefit from a spare outfit in your bag.</p><p><strong>Consider a Membership.</strong> If your family visits more than once or twice a month, our membership program is one of the best values around. Monthly memberships start at $65 per child with unlimited visits. Annual members save even more at $55/month. More details are on our website — your bank account will thank you.</p><p><em>— The Peachy Pals Team</em></p>'
      },
      {
        title: 'Why Peachy Pals Is More Than a Play Space',
        category: 'Community',
        featured: false,
        published: true,
        publishDate: d(22),
        imageUrl: 'https://images.unsplash.com/photo-1472162072942-cd5147eb3902?w=1200&h=600&fit=crop&auto=format',
        excerpt: 'From the very beginning, Peachy Pals was designed to be a gathering place — not just for children, but for the families who love them.',
        body: '<p>When I started planning Peachy Pals Playland, I had a vision that went beyond a great play space. I wanted to create a community — a place where families in Cartersville could come together, connect, and feel genuinely welcomed in every season of early childhood.</p><p>Raising young children can be isolating. Nap schedules, unpredictable weather, and the sheer logistics of getting out of the house can make it hard to find consistent, quality time with other families who truly understand this season of life. We wanted Peachy Pals to be the answer to that challenge — a place where you know you\'re welcome, and where your child will always find a friend.</p><p>We designed our space so that parents could actually breathe during their visit. Our seating areas give caregivers a comfortable place to sit, connect with other adults, and watch their children play safely. We want you to feel as welcome here as your kids do.</p><p>We\'re also proud of our relationships with local schools, daycares, homeschool co-ops, and community organizations who choose Peachy Pals for field trips and group events. Bringing children together from different backgrounds to play and learn alongside one another is exactly the kind of community impact we hoped to make. If your school or nonprofit would like to explore a fundraiser partnership, reach out — we\'d love to hear from you.</p><p><em>— Cherish, Founder, Peachy Pals Playland</em></p>'
      },
      {
        title: 'Welcome to Behind the Play: Our New Blog',
        category: 'Peachy Pals News',
        featured: false,
        published: true,
        publishDate: d(25),
        imageUrl: 'https://images.unsplash.com/photo-1516627145497-ae6968895b24?w=1200&h=600&fit=crop&auto=format',
        excerpt: 'We\'re launching a new blog to share stories, tips, and behind-the-scenes moments from Peachy Pals Playland. Welcome to Behind the Play!',
        body: '<p>Hello, Peachy Pals families! We\'re so excited to officially launch <strong>Behind the Play</strong> — the Peachy Pals Playland blog. This is our space to share stories from the facility, insights about early childhood development, practical tips for families, and an honest behind-the-scenes look at what it takes to run a play space we\'re truly proud of.</p><p>You ask us great questions all the time — Why is the Peachy Pit so good for kids? How do you keep everything so clean? What should we bring for our first visit? We decided it was time to put those answers in one place. And beyond answering questions, we wanted space to share the heart behind Peachy Pals. Every decision here — from the sand in the Peachy Pit to the grippy sock policy — was made intentionally, rooted in my 20+ years of early childhood education experience. Behind the Play is where we get to tell you why.</p><p>We\'ll be covering topics across eight categories: Sensory Play, Child Development, Behind the Scenes, Safety &amp; Cleanliness, Birthday Parties, Parent Resources, Community, and Peachy Pals News. New articles will be posted regularly, and Cherish will be the voice behind most of them. We can\'t wait to share more with you here.</p><p>Play. Imagine. Grow. 🍑</p><p><em>— Cherish, Founder, Peachy Pals Playland</em></p>'
      }
    ];
    for (const article of articles) await this.createPost(article);
    console.log('✅ Blog posts seeded');
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
