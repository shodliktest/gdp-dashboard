/* ============================================================
   TESTPRO — dashboard.js (FIXED)
   ============================================================ */

(async () => {
  const user = await AuthHelpers.requireAuth('login.html');
  if (!user) return;

  let profile = null;
  try {
    profile = await DB.getUser(user.uid);
  } catch (e) {
    console.warn('Profile load error:', e);
  }

  // User info
  const name    = profile?.name || user.displayName || 'Foydalanuvchi';
  const initial = name[0].toUpperCase();
  document.getElementById('user-avatar').textContent = initial;
  document.getElementById('user-name').textContent   = name;
  document.getElementById('user-role').textContent   = profile?.role === 'admin' ? '👑 Admin' : 'Foydalanuvchi';

  // Admin link
  if (profile?.role === 'admin') {
    const navItem = document.createElement('a');
    navItem.href      = 'admin.html';
    navItem.className = 'sidebar-nav-item';
    navItem.innerHTML = '<span class="nav-icon">👑</span> Admin panel';
    navItem.style.color = 'var(--accent-2)';
    const nav = document.querySelector('.sidebar-nav');
    if (nav) nav.appendChild(navItem);
  }

  // Load data
  try {
    const [myTests, results] = await Promise.all([
      DB.getTests({ authorId: user.uid }),
      DB.getResults({ userId: user.uid, limit: 10 }),
    ]);

    // Stats
    document.getElementById('stat-tests').textContent    = myTests.length;
    document.getElementById('stat-attempts').textContent = results.length;
    if (results.length > 0) {
      const avg = results.reduce((s, r) => s + (r.score || 0), 0) / results.length;
      document.getElementById('stat-avg').textContent = Math.round(avg) + '%';
    }

    renderMyTests(myTests);
    renderResults(results);
  } catch (err) {
    console.error('Data load error:', err);
    Toast.error('Ma\'lumotlar yuklanmadi: ' + err.message);
  }

  // Public tests separately
  try {
    const pubTests = await DB.getTests({ visibility: 'public' });
    renderPublicTests(pubTests);
    const el = document.getElementById('public-count');
    if (el) el.textContent = pubTests.length + ' ta';
  } catch (err) {
    console.warn('Public tests error:', err);
  }

})();

function renderMyTests(tests) {
  const container = document.getElementById('my-tests-list');
  if (!container) return;
  if (!tests.length) return; // keep empty state

  container.innerHTML = tests.map(t => `
    <div class="test-item fade-in">
      <div class="test-item-info">
        <h3>${esc(t.title)}</h3>
        <div class="test-item-meta">
          <span>📝 ${t.questionCount || 0} savol</span>
          <span>👁️ ${t.attempts || 0} urinish</span>
          <span>${t.visibility === 'public'
            ? '<span class="badge badge-success">Public</span>'
            : '<span class="badge badge-warning">Private</span>'}</span>
        </div>
      </div>
      <div class="test-actions">
        <a href="test.html?id=${t.id}" class="btn btn-secondary btn-sm" data-tooltip="O'tkazish">▶️</a>
        <a href="create.html?id=${t.id}" class="btn btn-ghost btn-sm" data-tooltip="Tahrirlash">✏️</a>
        <button class="btn btn-danger btn-sm" onclick="deleteTest('${t.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

function renderPublicTests(tests) {
  const container = document.getElementById('public-tests-list');
  if (!container) return;
  if (!tests.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🌐</div><h3>Ommaviy test yo'q</h3></div>`;
    return;
  }
  container.innerHTML = tests.map(t => `
    <div class="test-item fade-in">
      <div class="test-item-info">
        <h3>${esc(t.title)}</h3>
        <div class="test-item-meta">
          <span>📝 ${t.questionCount || 0} savol</span>
          <span>👁️ ${t.attempts || 0} urinish</span>
          ${t.timeLimit ? `<span>⏱️ ${t.timeLimit} daq</span>` : ''}
        </div>
      </div>
      <div class="test-actions">
        <a href="test.html?id=${t.id}" class="btn btn-primary btn-sm">Boshlash →</a>
      </div>
    </div>
  `).join('');
}

function renderResults(results) {
  const container = document.getElementById('results-list');
  if (!container || !results.length) return;

  container.innerHTML = results.map(r => {
    const cls = r.score >= 80 ? 'score-high' : r.score >= 50 ? 'score-mid' : 'score-low';
    return `
      <div class="result-item">
        <div>
          <div style="font-weight:600;font-size:0.88rem;margin-bottom:0.2rem">${esc(r.testTitle || 'Test')}</div>
          <div style="font-size:0.75rem;color:var(--text-3)">${fmtDate(r.completedAt)}</div>
        </div>
        <div class="result-score ${cls}">${r.score || 0}%</div>
      </div>
    `;
  }).join('');
}

window.deleteTest = async function(testId) {
  if (!confirm('Bu testni o\'chirishni xohlaysizmi?')) return;
  try {
    await DB.deleteTest(testId);
    Toast.success('Test o\'chirildi.');
    setTimeout(() => location.reload(), 1000);
  } catch (err) {
    Toast.error('Xato: ' + err.message);
  }
};

window.showSection = function(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.copyJoinLink = function() {
  const url = window.location.origin + window.location.pathname.replace('dashboard.html', '') + 'test.html';
  navigator.clipboard.writeText(url).catch(() => {}).then(() => Toast.info('Havola nusxalandi!'));
};

function esc(s) {
  const d = document.createElement('div'); d.textContent = s||''; return d.innerHTML;
}
function fmtDate(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('uz-UZ', { day:'numeric', month:'short', year:'numeric' });
  } catch { return '—'; }
}
