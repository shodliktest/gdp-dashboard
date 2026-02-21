/* ============================================================
   TESTPRO — admin.js
   Admin panel: users, tests, results management + charts
   ============================================================ */

let allUsers   = [];
let allTests   = [];
let allResults = [];

(async () => {
  const user = await AuthHelpers.requireAuth('login.html');
  if (!user) return;

  // Verify admin role
  const profile = await DB.getUser(user.uid);
  if (profile?.role !== 'admin') {
    Toast.error('Bu sahifaga kirish huquqingiz yo\'q!');
    setTimeout(() => window.location.href = 'dashboard.html', 2000);
    return;
  }

  // Set user info
  document.getElementById('user-avatar').textContent = (profile.name || 'A')[0].toUpperCase();
  document.getElementById('user-name').textContent   = profile.name || 'Admin';

  // Load all data
  await Promise.all([
    loadUsers(),
    loadTests(),
    loadResults(),
    loadStats(),
  ]);

  initCharts();
})();

/* ── Load Data ── */
async function loadUsers() {
  allUsers = await DB.getAllUsers(100);
  renderUsers(allUsers);
}

async function loadTests() {
  allTests = await DB.getTests();
  renderTests(allTests);
}

async function loadResults() {
  allResults = await DB.getResults({ limit: 50 });
  renderResults(allResults);
}

async function loadStats() {
  try {
    const stats = await DB.getPlatformStats();
    document.getElementById('stat-users').textContent   = stats.totalUsers;
    document.getElementById('stat-tests').textContent   = stats.totalTests;
    document.getElementById('stat-results').textContent = stats.totalResults;

    // Calculate average score from loaded results
    if (allResults.length > 0) {
      const avg = allResults.reduce((s, r) => s + (r.score || 0), 0) / allResults.length;
      document.getElementById('stat-avg').textContent = Math.round(avg) + '%';
    } else {
      document.getElementById('stat-avg').textContent = '—';
    }
  } catch (err) {
    console.warn('Stats load error:', err);
  }
}

/* ── Render Tables ── */
function renderUsers(users) {
  const tbody = document.getElementById('users-tbody');

  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-3)">Foydalanuvchi yo\'q</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(u => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:0.75rem">
          <div class="user-avatar" style="width:32px;height:32px;font-size:0.78rem">
            ${(u.name || u.email || '?')[0].toUpperCase()}
          </div>
          <span>${escapeHtml(u.name || '—')}</span>
        </div>
      </td>
      <td style="color:var(--text-2)">${escapeHtml(u.email || '—')}</td>
      <td>
        <span class="badge ${u.role === 'admin' ? 'badge-warning' : 'badge-primary'}">
          ${u.role === 'admin' ? '👑 Admin' : '👤 User'}
        </span>
      </td>
      <td style="color:var(--text-3)">${formatDate(u.createdAt)}</td>
      <td>
        <div style="display:flex;gap:0.5rem">
          ${u.role !== 'admin'
            ? `<button class="btn btn-warning btn-sm" onclick="setAdmin('${u.id}', true)">👑 Admin qil</button>`
            : `<button class="btn btn-ghost btn-sm" onclick="setAdmin('${u.id}', false)">User qil</button>`
          }
          <button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderTests(tests) {
  const tbody = document.getElementById('tests-tbody');

  if (!tests.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-3)">Test yo\'q</td></tr>';
    return;
  }

  tbody.innerHTML = tests.map(t => `
    <tr>
      <td>
        <span style="font-weight:600">${escapeHtml(t.title)}</span>
      </td>
      <td style="color:var(--text-3);font-size:0.8rem">${t.authorId?.slice(0, 8)}...</td>
      <td>
        <span class="badge ${t.visibility === 'public' ? 'badge-success' : 'badge-warning'}">
          ${t.visibility === 'public' ? '🌐 Public' : '🔒 Private'}
        </span>
      </td>
      <td>${t.questionCount || 0}</td>
      <td>${t.attempts || 0}</td>
      <td style="color:var(--text-3)">${formatDate(t.createdAt)}</td>
      <td>
        <div style="display:flex;gap:0.5rem">
          <a href="test.html?id=${t.id}" class="btn btn-secondary btn-sm">▶️</a>
          <a href="create.html?id=${t.id}" class="btn btn-ghost btn-sm">✏️</a>
          <button class="btn btn-danger btn-sm" onclick="adminDeleteTest('${t.id}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderResults(results) {
  const tbody = document.getElementById('results-tbody');

  if (!results.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-3)">Natija yo\'q</td></tr>';
    return;
  }

  tbody.innerHTML = results.map(r => {
    const scoreColor = r.score >= 80 ? '#2ecc71' : r.score >= 50 ? '#f39c12' : '#e74c3c';
    const mins = Math.floor((r.duration || 0) / 60);
    const secs = (r.duration || 0) % 60;

    return `
      <tr>
        <td>${escapeHtml(r.testTitle || '—')}</td>
        <td style="color:var(--text-3);font-size:0.8rem">${r.userId?.slice(0, 8)}...</td>
        <td style="font-family:'Syne',sans-serif;font-weight:800;color:${scoreColor}">${r.score}%</td>
        <td>${r.correct || 0}/${r.total || 0}</td>
        <td>${mins}:${String(secs).padStart(2,'0')}</td>
        <td>
          <span class="badge ${r.passed ? 'badge-success' : 'badge-danger'}">
            ${r.passed ? '✓ O\'tdi' : '✗ O\'tmadi'}
          </span>
        </td>
        <td style="color:var(--text-3)">${formatDate(r.completedAt)}</td>
      </tr>
    `;
  }).join('');
}

/* ── Charts ── */
function initCharts() {
  initActivityChart();
  initScoreChart();

  // Re-draw on theme change
  window.addEventListener('themeChanged', () => {
    Chart.instances && Object.values(Chart.instances).forEach(c => c.destroy());
    setTimeout(() => { initActivityChart(); initScoreChart(); }, 100);
  });
}

function getChartColors() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    text:   isDark ? '#A0A8CC' : '#4A4A6A',
    grid:   isDark ? 'rgba(108,99,255,0.12)' : 'rgba(108,99,255,0.08)',
    bg:     isDark ? '#0D0E1A' : '#F0F2FF',
  };
}

function initActivityChart() {
  const ctx = document.getElementById('activity-chart');
  if (!ctx) return;

  const colors = getChartColors();

  // Generate last 7 days data from results
  const days = [];
  const counts = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toLocaleDateString('uz-UZ', { weekday: 'short' }));

    const dayStart = new Date(d.setHours(0,0,0,0)).getTime();
    const dayEnd   = new Date(d.setHours(23,59,59,999)).getTime();

    const c = allResults.filter(r => {
      const ts = r.completedAt?.toDate?.().getTime() || 0;
      return ts >= dayStart && ts <= dayEnd;
    }).length;
    counts.push(c);
  }

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [{
        label: 'Test o\'tkazishlar',
        data: counts,
        backgroundColor: 'rgba(108,99,255,0.6)',
        borderColor: '#6C63FF',
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          ticks: { color: colors.text, font: { family: 'DM Sans', size: 11 } },
          grid:  { color: colors.grid },
        },
        y: {
          ticks: { color: colors.text, font: { family: 'DM Sans', size: 11 }, stepSize: 1 },
          grid:  { color: colors.grid },
        }
      }
    }
  });
}

function initScoreChart() {
  const ctx = document.getElementById('score-chart');
  if (!ctx) return;

  const colors = getChartColors();

  // Score distribution: 0-49, 50-69, 70-84, 85-100
  const bins = [0, 0, 0, 0];
  allResults.forEach(r => {
    const s = r.score || 0;
    if (s < 50) bins[0]++;
    else if (s < 70) bins[1]++;
    else if (s < 85) bins[2]++;
    else bins[3]++;
  });

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['0–49%', '50–69%', '70–84%', '85–100%'],
      datasets: [{
        data: bins,
        backgroundColor: ['rgba(231,76,60,0.8)', 'rgba(241,196,15,0.8)', 'rgba(52,152,219,0.8)', 'rgba(46,204,113,0.8)'],
        borderColor: colors.bg,
        borderWidth: 3,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: colors.text,
            font:  { family: 'DM Sans', size: 11 },
            padding: 16,
            usePointStyle: true,
          }
        },
      },
      cutout: '65%',
    }
  });
}

/* ── Actions ── */
window.switchTab = function(tab) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-pill').forEach(t => t.classList.remove('active'));

  document.getElementById(`tab-${tab}`)?.classList.add('active');
  document.querySelectorAll('.tab-pill').forEach(btn => {
    if (btn.textContent.toLowerCase().includes(tab === 'users' ? 'foyda' : tab === 'tests' ? 'testlar' : 'natija')) {
      btn.classList.add('active');
    }
  });
};

window.filterUsers = function(query) {
  const q = query.toLowerCase();
  const filtered = allUsers.filter(u =>
    (u.name || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q)
  );
  renderUsers(filtered);
};

window.setAdmin = async function(uid, makeAdmin) {
  const role = makeAdmin ? 'admin' : 'user';
  try {
    await DB.updateUser(uid, { role });
    Toast.success(`Rol ${makeAdmin ? 'admin' : 'user'} ga o'zgartirildi.`);
    await loadUsers();
  } catch (err) {
    Toast.error(err.message);
  }
};

window.deleteUser = async function(uid) {
  if (!confirm('Bu foydalanuvchini o\'chirmoqchimisiz? Uning testlari saqlanib qoladi.')) return;
  try {
    await db.collection('users').doc(uid).delete();
    Toast.success('Foydalanuvchi o\'chirildi.');
    await loadUsers();
  } catch (err) {
    Toast.error(err.message);
  }
};

window.adminDeleteTest = async function(testId) {
  if (!confirm('Bu testni o\'chirmoqchimisiz?')) return;
  try {
    await DB.deleteTest(testId);
    Toast.success('Test o\'chirildi.');
    await loadTests();
  } catch (err) {
    Toast.error(err.message);
  }
};

/* ── Helpers ── */
function formatDate(ts) {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
