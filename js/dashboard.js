/* ============================================================
   TESTPRO — dashboard.js
   Dashboard data loading, rendering, interactions
   ============================================================ */

(async () => {
  // Auth guard
  const user = await AuthHelpers.requireAuth('login.html');
  if (!user) return;

  // Get Firestore profile
  const profile = await DB.getUser(user.uid);

  /* ── Render user info in sidebar ── */
  const initial = (profile?.name || user.displayName || 'U')[0].toUpperCase();
  document.getElementById('user-avatar').textContent = initial;
  document.getElementById('user-name').textContent   = profile?.name || user.displayName || 'Foydalanuvchi';
  document.getElementById('user-role').textContent   = profile?.role === 'admin' ? '👑 Admin' : 'Foydalanuvchi';

  // Admin badge
  if (profile?.role === 'admin') {
    const navLink = document.createElement('a');
    navLink.href = 'admin.html';
    navLink.className = 'sidebar-nav-item';
    navLink.innerHTML = '<span class="nav-icon">👑</span> Admin panel';
    navLink.style.color = 'var(--accent-2)';
    document.querySelector('.sidebar-nav').insertBefore(navLink, document.querySelector('.sidebar-footer'));
  }

  /* ── Load my tests ── */
  const myTests = await DB.getTests({ authorId: user.uid });
  renderMyTests(myTests);

  /* ── Load public tests ── */
  const publicTests = await DB.getTests({ visibility: 'public' });
  renderPublicTests(publicTests);

  /* ── Load my results ── */
  const myResults = await DB.getResults({ userId: user.uid, limit: 10 });
  renderResults(myResults);

  /* ── Stats ── */
  document.getElementById('stat-tests').textContent    = myTests.length;
  document.getElementById('stat-attempts').textContent = myResults.length;

  if (myResults.length > 0) {
    const avg = myResults.reduce((sum, r) => sum + (r.score || 0), 0) / myResults.length;
    document.getElementById('stat-avg').textContent = Math.round(avg) + '%';
  }

  /* ── Render Functions ── */

  function renderMyTests(tests) {
    const container = document.getElementById('my-tests-list');
    if (!tests.length) return;

    container.innerHTML = tests.map(test => `
      <div class="test-item fade-in">
        <div class="test-item-info">
          <h3>${escapeHtml(test.title)}</h3>
          <div class="test-item-meta">
            <span>📝 ${test.questionCount || 0} ta savol</span>
            <span>👁️ ${test.attempts || 0} urinish</span>
            <span>${test.visibility === 'public'
              ? '<span class="badge badge-success">Public</span>'
              : '<span class="badge badge-warning">Private</span>'}</span>
            <span>🕐 ${formatDate(test.createdAt)}</span>
          </div>
        </div>
        <div class="test-actions">
          <a href="test.html?id=${test.id}" class="btn btn-secondary btn-sm" data-tooltip="O'tkazish">▶️</a>
          <a href="create.html?id=${test.id}" class="btn btn-ghost btn-sm" data-tooltip="Tahrirlash">✏️</a>
          <button class="btn btn-danger btn-sm" onclick="deleteTest('${test.id}')" data-tooltip="O'chirish">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  function renderPublicTests(tests) {
    const container = document.getElementById('public-tests-list');
    document.getElementById('public-count').textContent = tests.length + ' ta';

    if (!tests.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🌐</div><h3>Ommaviy test yo'q</h3></div>`;
      return;
    }

    container.innerHTML = tests.map(test => `
      <div class="test-item fade-in">
        <div class="test-item-info">
          <h3>${escapeHtml(test.title)}</h3>
          <div class="test-item-meta">
            <span>📝 ${test.questionCount || 0} ta savol</span>
            <span>👁️ ${test.attempts || 0} urinish</span>
            ${test.timeLimit ? `<span>⏱️ ${test.timeLimit} daqiqa</span>` : ''}
          </div>
        </div>
        <div class="test-actions">
          <a href="test.html?id=${test.id}" class="btn btn-primary btn-sm">Boshlash →</a>
        </div>
      </div>
    `).join('');
  }

  function renderResults(results) {
    const container = document.getElementById('results-list');
    if (!results.length) return;

    container.innerHTML = results.map(r => {
      const scoreClass = r.score >= 80 ? 'score-high' : r.score >= 50 ? 'score-mid' : 'score-low';
      return `
        <div class="result-item">
          <div>
            <div style="font-weight:600;font-size:0.88rem;margin-bottom:0.2rem">${escapeHtml(r.testTitle || 'Test')}</div>
            <div style="font-size:0.75rem;color:var(--text-3)">${formatDate(r.completedAt)}</div>
          </div>
          <div class="result-score ${scoreClass}">${r.score || 0}%</div>
        </div>
      `;
    }).join('');
  }

  // Section scroll helper
  window.showSection = function(id) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Delete test
  window.deleteTest = async function(testId) {
    if (!confirm('Bu testni o\'chirishni xohlaysizmi? Bu amalni bekor qilib bo\'lmaydi.')) return;
    try {
      await DB.deleteTest(testId);
      Toast.success('Test muvaffaqiyatli o\'chirildi.');
      setTimeout(() => location.reload(), 1000);
    } catch (err) {
      Toast.error('Xato: ' + err.message);
    }
  };

  // Copy test link
  window.copyJoinLink = function() {
    const url = window.location.origin + '/test.html';
    navigator.clipboard.writeText(url).then(() => {
      Toast.info('Havola nusxalandi!');
    });
  };

  // Theme label update
  window.addEventListener('themeChanged', ({ detail }) => {
    const label = document.getElementById('theme-label');
    if (label) label.textContent = detail.theme === 'dark' ? 'Yorug\' rejim' : 'Qorong\'i rejim';
  });

})();

/* ── Helpers ── */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function formatDate(ts) {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' });
}
