/* ============================================================
   TESTPRO — firebase.js
   Firebase SDK initialization (Modular v9 compat)
   ⚠️ REPLACE firebaseConfig with your own project config!
   ============================================================ */

// Import Firebase SDKs (via CDN in HTML)
// These globals are available after loading Firebase compat scripts

const firebaseConfig = {
  apiKey:            "AIzaSyD41LIwGEcnVDmsFU73mj12ruoz2s3jdgw",
  authDomain:        "karoke-pro.firebaseapp.com",
  projectId:         "karoke-pro",
  storageBucket:     "karoke-pro.firebasestorage.app",
  messagingSenderId: "696087699873",
  appId:             "1:696087699873:web:81f18119449f25cbceabe0",
  measurementId:     "G-6NSZ882D7K"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Instances
const auth = firebase.auth();
const db   = firebase.firestore();

// Enable offline persistence
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('Offline persistence: multiple tabs open');
  } else if (err.code === 'unimplemented') {
    console.warn('Offline persistence: not supported');
  }
});

/* ── Auth Helpers ── */
const AuthHelpers = {
  // Get current user (with wait)
  getCurrentUser() {
    return new Promise((resolve, reject) => {
      const unsubscribe = auth.onAuthStateChanged(user => {
        unsubscribe();
        resolve(user);
      }, reject);
    });
  },

  // Require auth — redirect if not logged in
  async requireAuth(redirectTo = 'login.html') {
    const user = await this.getCurrentUser();
    if (!user) {
      window.location.href = redirectTo;
      return null;
    }
    return user;
  },

  // Require guest — redirect if logged in
  async requireGuest(redirectTo = 'dashboard.html') {
    const user = await this.getCurrentUser();
    if (user) {
      window.location.href = redirectTo;
      return null;
    }
    return true;
  }
};

/* ── Firestore Helpers ── */
const DB = {
  // Users
  async getUser(uid) {
    const doc = await db.collection('users').doc(uid).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  async createUser(uid, data) {
    await db.collection('users').doc(uid).set({
      ...data,
      role: 'user',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  },

  async updateUser(uid, data) {
    await db.collection('users').doc(uid).update({
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  },

  // Tests
  async getTest(testId) {
    const doc = await db.collection('tests').doc(testId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  async getTests(filters = {}) {
    // NOTE: Composite index muammosini oldini olish uchun — oddiy query + client-side filter
    let query = db.collection('tests');

    // Faqat bitta where ishlatamiz (composite index kerak emas)
    if (filters.authorId) {
      query = query.where('authorId', '==', filters.authorId);
    } else if (filters.visibility) {
      query = query.where('visibility', '==', filters.visibility);
    }

    const snap = await query.get();
    let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Client-side qo'shimcha filter
    if (filters.authorId && filters.visibility) {
      results = results.filter(t => t.visibility === filters.visibility);
    }

    // Client-side sort by createdAt desc
    results.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || a.createdAt?.seconds || 0;
      const tb = b.createdAt?.toMillis?.() || b.createdAt?.seconds || 0;
      return tb - ta;
    });

    return results;
  },

  async createTest(data, authorId) {
    const ref = await db.collection('tests').add({
      ...data,
      authorId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      attempts: 0,
    });
    return ref.id;
  },

  async updateTest(testId, data) {
    await db.collection('tests').doc(testId).update({
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  },

  async deleteTest(testId) {
    // Delete subcollections first
    const questions = await db.collection('tests').doc(testId).collection('questions').get();
    const batch = db.batch();
    questions.forEach(doc => batch.delete(doc.ref));
    batch.delete(db.collection('tests').doc(testId));
    await batch.commit();
  },

  // Questions
  async getQuestions(testId) {
    const snap = await db.collection('tests').doc(testId)
      .collection('questions')
      .orderBy('order')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async saveQuestions(testId, questions) {
    // Batch delete + add (max 500 ops per batch)
    const colRef = db.collection('tests').doc(testId).collection('questions');

    // Delete existing
    const existing = await colRef.get();
    if (existing.size > 0) {
      const delBatch = db.batch();
      existing.forEach(doc => delBatch.delete(doc.ref));
      await delBatch.commit();
    }

    if (questions.length === 0) return;

    // Add new — clean object (remove local 'id' field, use Firestore auto-id)
    const addBatch = db.batch();
    questions.forEach((q, i) => {
      const { id: _localId, ...cleanQ } = q; // strip local id
      const ref = colRef.doc();
      addBatch.set(ref, {
        ...cleanQ,
        order: i,
        text:    cleanQ.text    || '',
        options: cleanQ.options || [],
        correct: cleanQ.correct || [0],
        type:    cleanQ.type    || 'multiple',
        points:  cleanQ.points  || 1,
      });
    });
    await addBatch.commit();
  },

  // Results
  async saveResult(data) {
    const ref = await db.collection('results').add({
      ...data,
      completedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    // Increment test attempts counter
    await db.collection('tests').doc(data.testId).update({
      attempts: firebase.firestore.FieldValue.increment(1)
    });

    return ref.id;
  },

  async getResults(filters = {}) {
    // Composite index muammosi oldini olish
    let query = db.collection('results');

    if (filters.userId) {
      query = query.where('userId', '==', filters.userId);
    } else if (filters.testId) {
      query = query.where('testId', '==', filters.testId);
    }

    const snap = await query.get();
    let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Client-side sort
    results.sort((a, b) => {
      const ta = a.completedAt?.toMillis?.() || a.completedAt?.seconds || 0;
      const tb = b.completedAt?.toMillis?.() || b.completedAt?.seconds || 0;
      return tb - ta;
    });

    if (filters.limit) results = results.slice(0, filters.limit);

    return results;
  },

  // Admin: get all users
  async getAllUsers(limitN = 100) {
    const snap = await db.collection('users').limit(limitN).get();
    const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    results.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || a.createdAt?.seconds || 0;
      const tb = b.createdAt?.toMillis?.() || b.createdAt?.seconds || 0;
      return tb - ta;
    });
    return results;
  },

  // Admin: get platform stats
  async getPlatformStats() {
    const [users, tests, results] = await Promise.all([
      db.collection('users').get(),
      db.collection('tests').get(),
      db.collection('results').get(),
    ]);

    return {
      totalUsers:   users.size,
      totalTests:   tests.size,
      totalResults: results.size,
    };
  }
};

// Export for use across pages
window.auth       = auth;
window.db         = db;
window.DB         = DB;
window.AuthHelpers = AuthHelpers;
window.FieldValue  = firebase.firestore.FieldValue;
