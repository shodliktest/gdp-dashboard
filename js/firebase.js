/* ============================================================
   TESTPRO — firebase.js
   Firebase SDK initialization (Modular v9 compat)
   ⚠️ REPLACE firebaseConfig with your own project config!
   ============================================================ */

// Import Firebase SDKs (via CDN in HTML)
// These globals are available after loading Firebase compat scripts

const firebaseConfig = {
  apiKey:            "AIzaSyAN0MyvVColeo5YTGQLAiC-3ullbBGvq24",
  authDomain:        "testpro-121a6.firebaseapp.com",
  projectId:         "testpro-121a6",
  storageBucket:     "testpro-121a6.firebasestorage.app",
  messagingSenderId: "497431811359",
  appId:             "1:497431811359:web:4e5e6275090129ab35cc2a"
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
  async requireAuth(redirectTo = '/login.html') {
    const user = await this.getCurrentUser();
    if (!user) {
      window.location.href = redirectTo;
      return null;
    }
    return user;
  },

  // Require guest — redirect if logged in
  async requireGuest(redirectTo = '/dashboard.html') {
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
    let query = db.collection('tests').orderBy('createdAt', 'desc');
    if (filters.authorId) query = query.where('authorId', '==', filters.authorId);
    if (filters.visibility) query = query.where('visibility', '==', filters.visibility);

    const snap = await query.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
    const batch = db.batch();
    const colRef = db.collection('tests').doc(testId).collection('questions');

    // Delete existing questions
    const existing = await colRef.get();
    existing.forEach(doc => batch.delete(doc.ref));

    // Add new questions
    questions.forEach((q, i) => {
      const ref = colRef.doc();
      batch.set(ref, { ...q, order: i });
    });

    await batch.commit();
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
    let query = db.collection('results').orderBy('completedAt', 'desc');
    if (filters.userId) query = query.where('userId', '==', filters.userId);
    if (filters.testId) query = query.where('testId', '==', filters.testId);
    if (filters.limit)  query = query.limit(filters.limit);

    const snap = await query.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  // Admin: get all users
  async getAllUsers(limitN = 50) {
    const snap = await db.collection('users')
      .orderBy('createdAt', 'desc')
      .limit(limitN)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
