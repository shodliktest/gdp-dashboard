/* ================================================================
   TestPro — firebase.js  v3  (ishonchli, composite index yo'q)
   ================================================================ */

const firebaseConfig = {
  apiKey:            "AIzaSyD41LIwGEcnVDmsFU73mj12ruoz2s3jdgw",
  authDomain:        "karoke-pro.firebaseapp.com",
  projectId:         "karoke-pro",
  storageBucket:     "karoke-pro.firebasestorage.app",
  messagingSenderId: "696087699873",
  appId:             "1:696087699873:web:81f18119449f25cbceabe0"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

/* ── BASE_PATH: GitHub Pages uchun avto aniqlash ── */
const BASE_PATH = (() => {
  const p = window.location.pathname;
  return p.substring(0, p.lastIndexOf('/') + 1);
})();
function goTo(page) {
  window.location.href = BASE_PATH + page;
}

/* ── Auth ── */
const AuthHelpers = {
  getCurrentUser() {
    return new Promise((resolve, reject) => {
      const unsub = auth.onAuthStateChanged(user => { unsub(); resolve(user); }, reject);
    });
  },
  async requireAuth(fallback = 'login.html') {
    const user = await this.getCurrentUser();
    if (!user) { goTo(fallback); return null; }
    return user;
  }
};

/* ── Fan/Guruhlar ── */
const SUBJECTS = {
  english:  { label: 'English',     emoji: '🇬🇧', cls: 'subj-english'  },
  arabic:   { label: 'Arabic',      emoji: '🕌',  cls: 'subj-arabic'   },
  russian:  { label: 'Russian',     emoji: '🇷🇺', cls: 'subj-russian'  },
  turkish:  { label: 'Turkish',     emoji: '🇹🇷', cls: 'subj-turkish'  },
  math:     { label: 'Math',        emoji: '🧮',  cls: 'subj-math'     },
  it:       { label: 'IT / CS',     emoji: '💻',  cls: 'subj-it'       },
  science:  { label: 'Science',     emoji: '🔬',  cls: 'subj-science'  },
  religion: { label: 'Din / Tarix', emoji: '📖',  cls: 'subj-religion' },
  other:    { label: 'Boshqa',      emoji: '📚',  cls: 'subj-custom'   },
};
function getSubject(k) {
  return SUBJECTS[k] || { label: k || 'Boshqa', emoji: '📝', cls: 'subj-custom' };
}

/* ── Yordamchi funksiyalar ── */
function esc(s) {
  const d = document.createElement('div');
  d.textContent = String(s || '');
  return d.innerHTML;
}
function fmtDate(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}
function fmtTime(secs) {
  secs = secs || 0;
  return String(Math.floor(secs / 60)).padStart(2, '0') + ':' + String(secs % 60).padStart(2, '0');
}
function randCode(n = 6) {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: n }, () => c[Math.floor(Math.random() * c.length)]).join('');
}

/* ── DB ── */
const DB = {

  /* USERS */
  async getUser(uid) {
    const d = await db.collection('users').doc(uid).get();
    return d.exists ? { id: d.id, ...d.data() } : null;
  },
  async createUser(uid, data) {
    await db.collection('users').doc(uid).set({
      ...data,
      role: 'user',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },
  async updateUser(uid, data) {
    await db.collection('users').doc(uid).update({
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },
  async getAllUsers(limit = 200) {
    const snap = await db.collection('users').limit(limit).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  },

  /* TESTS */
  async getTest(id) {
    const d = await db.collection('tests').doc(id).get();
    return d.exists ? { id: d.id, ...d.data() } : null;
  },

  /* Foydalanuvchi o'z testlarini oladi — faqat authorId filter, composite index yo'q */
  async getMyTests(authorId) {
    const snap = await db.collection('tests').where('authorId', '==', authorId).get();
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    return list;
  },

  /* Ommaviy testlar — faqat public */
  async getPublicTests() {
    const snap = await db.collection('tests').where('visibility', '==', 'public').get();
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    return list;
  },

  /* Barcha testlar (admin uchun) */
  async getAllTests(limit = 200) {
    const snap = await db.collection('tests').limit(limit).get();
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    return list;
  },

  /* Kod orqali test topish */
  async getTestByCode(code) {
    const snap = await db.collection('tests')
      .where('accessCode', '==', code.toUpperCase().trim())
      .get();
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
  },

  /* Test yaratish — har doim accessCode */
  async createTest(data, authorId) {
    const accessCode = data.accessCode || randCode(6);
    const ref = await db.collection('tests').add({
      ...data,
      accessCode,
      authorId,
      attempts:     0,
      averageScore: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return { id: ref.id, accessCode };
  },

  async updateTest(id, data) {
    await db.collection('tests').doc(id).update({
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  async deleteTest(id) {
    /* Avval savollar subcollection o'chiriladi */
    const qs = await db.collection('tests').doc(id).collection('questions').get();
    if (qs.size > 0) {
      const batch = db.batch();
      qs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    await db.collection('tests').doc(id).delete();
  },

  /* QUESTIONS */
  async getQuestions(testId) {
    const snap = await db.collection('tests').doc(testId).collection('questions').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  async saveQuestions(testId, questions) {
    const col = db.collection('tests').doc(testId).collection('questions');
    /* Eskilarini o'chirish */
    const existing = await col.get();
    if (existing.size > 0) {
      const b = db.batch();
      existing.forEach(d => b.delete(d.ref));
      await b.commit();
    }
    if (!questions.length) return;

    /* 499 tadan batch */
    for (let i = 0; i < questions.length; i += 499) {
      const b = db.batch();
      questions.slice(i, i + 499).forEach((q, j) => {
        const { id: _localId, ...clean } = q;
        b.set(col.doc(), {
          ...clean,
          order:       i + j,
          text:        clean.text        || '',
          type:        clean.type        || 'multiple',
          options:     clean.options     || [],
          correct:     clean.correct     ?? 0,
          explanation: clean.explanation || '',
          points:      clean.points      || 1,
        });
      });
      await b.commit();
    }
    await db.collection('tests').doc(testId).update({ questionCount: questions.length });
  },

  /* RESULTS */
  async saveResult(data) {
    const ref = await db.collection('results').add({
      ...data,
      completedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    try {
      const tRef = db.collection('tests').doc(data.testId);
      const tDoc = await tRef.get();
      if (tDoc.exists) {
        const old = tDoc.data();
        const prevAvg = old.averageScore || 0;
        const prevAtt = old.attempts    || 0;
        const newAvg  = Math.round((prevAvg * prevAtt + (data.score || 0)) / (prevAtt + 1));
        await tRef.update({
          attempts:     firebase.firestore.FieldValue.increment(1),
          averageScore: newAvg,
        });
      }
    } catch (e) { console.warn('stats update:', e.message); }
    return ref.id;
  },

  async getMyResults(userId, limit = 20) {
    const snap = await db.collection('results').where('userId', '==', userId).get();
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0));
    return limit ? list.slice(0, limit) : list;
  },

  async getResults(filters = {}) {
    let q = db.collection('results');
    if (filters.userId) q = q.where('userId', '==', filters.userId);
    else if (filters.testId) q = q.where('testId', '==', filters.testId);
    const snap = await q.get();
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0));
    if (filters.limit) list = list.slice(0, filters.limit);
    return list;
  }
};

/* ── Global eksport ── */
window.auth        = auth;
window.db          = db;
window.DB          = DB;
window.AuthHelpers = AuthHelpers;
window.SUBJECTS    = SUBJECTS;
window.getSubject  = getSubject;
window.esc         = esc;
window.fmtDate     = fmtDate;
window.fmtTime     = fmtTime;
window.randCode    = randCode;
window.goTo        = goTo;
window.BASE_PATH   = BASE_PATH;
window.FieldValue  = firebase.firestore.FieldValue;
                         
