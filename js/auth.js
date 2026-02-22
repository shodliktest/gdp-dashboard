/* ============================================================
   TESTPRO — auth.js
   Registration · Login · Logout · Auth state management
   ============================================================ */

const Auth = (() => {
  /* ── Register ── */
  async function register(name, email, password) {
    // Create Firebase Auth user
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const user = cred.user;

    // Update display name
    await user.updateProfile({ displayName: name });

    // Save to Firestore
    await DB.createUser(user.uid, {
      name,
      email,
      role: 'user',
      totalAttempts: 0,
    });

    return user;
  }

  /* ── Login ── */
  async function login(email, password) {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    return cred.user;
  }

  /* ── Google Login ── */
  async function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    const cred = await auth.signInWithPopup(provider);
    const user = cred.user;

    // Create Firestore doc if new user
    const existing = await DB.getUser(user.uid);
    if (!existing) {
      await DB.createUser(user.uid, {
        name:  user.displayName || 'User',
        email: user.email,
        role:  'user',
        totalAttempts: 0,
      });
    }

    return user;
  }

  /* ── Logout ── */
  async function logout() {
    await auth.signOut();
    window.location.href = '/login.html';
  }

  /* ── Reset Password ── */
  async function resetPassword(email) {
    await auth.sendPasswordResetEmail(email);
  }

  /* ── Get current user data (with Firestore profile) ── */
  async function getCurrentUserData() {
    const user = auth.currentUser;
    if (!user) return null;

    const profile = await DB.getUser(user.uid);
    return { ...user, ...profile };
  }

  /* ── Check admin role ── */
  async function isAdmin() {
    const user = auth.currentUser;
    if (!user) return false;
    const profile = await DB.getUser(user.uid);
    return profile?.role === 'admin';
  }

  return { register, login, loginWithGoogle, logout, resetPassword, getCurrentUserData, isAdmin };
})();

/* ============================================================
   LOGIN PAGE — login.html logic
   ============================================================ */
if (document.getElementById('auth-page')) {
  (async () => {
    // Redirect if already logged in
    await AuthHelpers.requireGuest('/dashboard.html');

    const loginTab    = document.getElementById('tab-login');
    const registerTab = document.getElementById('tab-register');
    const loginForm   = document.getElementById('login-form');
    const regForm     = document.getElementById('register-form');
    const alertBox    = document.getElementById('auth-alert');

    function showAlert(msg, type = 'error') {
      alertBox.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
    }

    function clearAlert() { alertBox.innerHTML = ''; }

    function setLoading(btn, loading) {
      btn.disabled = loading;
      btn.innerHTML = loading
        ? '<span class="spinner" style="width:18px;height:18px;border-width:2px"></span> Yuklanmoqda...'
        : btn.dataset.label;
    }

    // Tab switching
    loginTab?.addEventListener('click', () => {
      loginTab.classList.add('active');
      registerTab.classList.remove('active');
      loginForm.classList.remove('hidden');
      regForm.classList.add('hidden');
      clearAlert();
    });

    registerTab?.addEventListener('click', () => {
      registerTab.classList.add('active');
      loginTab.classList.remove('active');
      regForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
      clearAlert();
    });

    // Login submit
    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAlert();
      const btn = loginForm.querySelector('[type="submit"]');
      setLoading(btn, true);

      const email    = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      try {
        await Auth.login(email, password);
        window.location.href = 'dashboard.html';
      } catch (err) {
        const msgs = {
          'auth/user-not-found':      'Bu email ro\'yxatdan o\'tmagan.',
          'auth/wrong-password':      'Parol noto\'g\'ri.',
          'auth/invalid-email':       'Email format noto\'g\'ri.',
          'auth/too-many-requests':   'Juda ko\'p urinish. Keyinroq sinab ko\'ring.',
          'auth/network-request-failed': 'Internet aloqasi yo\'q.',
        };
        showAlert(msgs[err.code] || err.message);
        setLoading(btn, false);
      }
    });

    // Register submit
    regForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAlert();
      const btn = regForm.querySelector('[type="submit"]');
      setLoading(btn, true);

      const name     = document.getElementById('reg-name').value.trim();
      const email    = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const confirm  = document.getElementById('reg-confirm').value;

      if (password !== confirm) {
        showAlert('Parollar mos kelmadi.');
        setLoading(btn, false);
        return;
      }

      if (password.length < 6) {
        showAlert('Parol kamida 6 ta belgi bo\'lishi kerak.');
        setLoading(btn, false);
        return;
      }

      try {
        await Auth.register(name, email, password);
        window.location.href = 'dashboard.html';
      } catch (err) {
        const msgs = {
          'auth/email-already-in-use': 'Bu email allaqachon ro\'yxatdan o\'tgan.',
          'auth/invalid-email':        'Email format noto\'g\'ri.',
          'auth/weak-password':        'Parol juda zaif.',
        };
        showAlert(msgs[err.code] || err.message);
        setLoading(btn, false);
      }
    });

    // Google login
    document.getElementById('google-login')?.addEventListener('click', async () => {
      try {
        await Auth.loginWithGoogle();
        window.location.href = '/dashboard.html';
      } catch (err) {
        showAlert('Google bilan kirish muvaffaqiyatsiz: ' + err.message);
      }
    });

  })();
}

/* ── Global logout button ── */
document.addEventListener('click', async (e) => {
  if (e.target.closest('#logout-btn')) {
    await Auth.logout();
  }
});

window.Auth = Auth;

