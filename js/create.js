/* ============================================================
   TESTPRO — create.js
   Test creation + editing with dynamic question builder
   ============================================================ */

let questions    = [];
let currentUser  = null;
let editingTestId = null;
const urlParams  = new URLSearchParams(window.location.search);

(async () => {
  currentUser = await AuthHelpers.requireAuth('login.html');
  if (!currentUser) return;

  // Load profile
  const profile = await DB.getUser(currentUser.uid);
  document.getElementById('user-avatar').textContent = (profile?.name || 'U')[0].toUpperCase();
  document.getElementById('user-name').textContent   = profile?.name || currentUser.displayName || 'Foydalanuvchi';

  // Check if editing existing test
  editingTestId = urlParams.get('id');
  if (editingTestId) {
    document.getElementById('page-title').textContent = 'Testni tahrirlash';
    await loadExistingTest(editingTestId);
  } else {
    addQuestion('multiple'); // Add first question by default
  }
})();

/* ── Load existing test for editing ── */
async function loadExistingTest(testId) {
  try {
    const test      = await DB.getTest(testId);
    const qs        = await DB.getQuestions(testId);

    if (!test) {
      Toast.error('Test topilmadi');
      return;
    }

    document.getElementById('test-title').value      = test.title || '';
    document.getElementById('test-desc').value       = test.description || '';
    document.getElementById('test-visibility').value = test.visibility || 'public';
    document.getElementById('test-time').value       = test.timeLimit || 0;
    document.getElementById('test-pass').value       = test.passScore || 60;
    document.getElementById('test-shuffle').checked  = test.shuffleQuestions || false;
    document.getElementById('test-show-result').checked = test.showResult !== false;

    questions = qs;
    renderAllQuestions();
  } catch (err) {
    Toast.error('Xato: ' + err.message);
  }
}

/* ── Add question ── */
window.addQuestion = function(type = 'multiple') {
  const q = {
    id:       Date.now(),
    type,
    text:     '',
    options:  type === 'multiple'  ? ['', '', '', ''] :
              type === 'truefalse' ? ['Ha', 'Yo\'q']  : [],
    correct:  type === 'truefalse' ? [0] : [0],
    points:   1,
  };

  questions.push(q);
  renderQuestion(q, questions.length - 1);
  updateQCount();

  // Scroll to new question
  setTimeout(() => {
    const cards = document.querySelectorAll('.question-card');
    if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 100);
};

/* ── Render all questions ── */
function renderAllQuestions() {
  const container = document.getElementById('questions-container');
  container.innerHTML = '';
  questions.forEach((q, i) => renderQuestion(q, i, false));
  updateQCount();
}

/* ── Render single question card ── */
function renderQuestion(q, index, animate = true) {
  const container = document.getElementById('questions-container');

  const typeLabels = {
    multiple:  '⭕ Ko\'p tanlov',
    truefalse: '✅ Ha/Yo\'q',
    text:      '📝 Matn',
  };

  const card = document.createElement('div');
  card.className = 'question-card' + (animate ? ' fade-in' : '');
  card.dataset.qid = q.id;

  card.innerHTML = `
    <div class="q-header">
      <div class="q-number">${index + 1}</div>
      <span class="badge badge-primary q-type-badge">${typeLabels[q.type]}</span>
      <div class="q-type-selector" style="margin-bottom:0">
        ${['multiple','truefalse','text'].map(t => `
          <button class="q-type-btn ${q.type === t ? 'active' : ''}"
            onclick="changeQuestionType('${q.id}', '${t}')">
            ${typeLabels[t]}
          </button>
        `).join('')}
      </div>
      <button class="btn btn-danger btn-sm q-delete-btn" onclick="deleteQuestion('${q.id}')">🗑️</button>
    </div>

    <div class="form-group">
      <label class="form-label">Savol matni *</label>
      <textarea class="form-input" placeholder="Savolingizni yozing..." rows="2"
        onchange="updateQuestion('${q.id}', 'text', this.value)"
        oninput="updateQuestion('${q.id}', 'text', this.value)"
      >${escapeHtml(q.text)}</textarea>
    </div>

    <div id="options-${q.id}">
      ${renderOptions(q)}
    </div>

    <div class="form-row" style="margin-top:1rem">
      <div class="form-group" style="margin:0">
        <label class="form-label">Ball</label>
        <input type="number" class="form-input" value="${q.points}" min="1" max="10"
          onchange="updateQuestion('${q.id}', 'points', +this.value)" />
      </div>
    </div>
  `;

  container.appendChild(card);
}

/* ── Render options based on type ── */
function renderOptions(q) {
  if (q.type === 'text') {
    return `<p style="font-size:0.82rem;color:var(--text-3);font-style:italic">
      Foydalanuvchi erkin matn yozadi. To'g'ri javobni keyinroq ko'rishingiz mumkin.
    </p>`;
  }

  if (q.type === 'truefalse') {
    return q.options.map((opt, i) => `
      <div class="option-row">
        <input type="radio" name="correct-${q.id}" class="option-correct"
          ${q.correct.includes(i) ? 'checked' : ''}
          onchange="setCorrect('${q.id}', ${i}, false)" />
        <input type="text" class="form-input" value="${escapeHtml(opt)}" readonly
          style="background:${q.correct.includes(i) ? 'rgba(67,233,123,0.1)' : ''};
                 border-color:${q.correct.includes(i) ? 'rgba(67,233,123,0.4)' : ''}" />
      </div>
    `).join('');
  }

  return q.options.map((opt, i) => `
    <div class="option-row">
      <input type="radio" name="correct-${q.id}" class="option-correct"
        ${q.correct.includes(i) ? 'checked' : ''}
        onchange="setCorrect('${q.id}', ${i}, false)" />
      <input type="text" class="form-input" value="${escapeHtml(opt)}"
        placeholder="Variant ${String.fromCharCode(65 + i)}"
        onchange="updateOption('${q.id}', ${i}, this.value)"
        style="border-color:${q.correct.includes(i) ? 'rgba(67,233,123,0.5)' : ''};
               background:${q.correct.includes(i) ? 'rgba(67,233,123,0.06)' : ''}" />
      ${q.options.length > 2 ? `
        <button class="btn btn-ghost btn-sm" onclick="removeOption('${q.id}', ${i})" style="flex-shrink:0">✕</button>
      ` : ''}
    </div>
  `).join('') + `
    ${q.options.length < 6 ? `
      <button class="add-option-btn" onclick="addOption('${q.id}')">+ Variant qo'shish</button>
    ` : ''}
  `;
}

/* ── Update helpers ── */
window.updateQuestion = function(qid, field, value) {
  const q = questions.find(q => q.id == qid);
  if (q) q[field] = value;
};

window.setCorrect = function(qid, idx, multi) {
  const q = questions.find(q => q.id == qid);
  if (!q) return;
  if (multi) {
    if (q.correct.includes(idx)) q.correct = q.correct.filter(c => c !== idx);
    else q.correct.push(idx);
  } else {
    q.correct = [idx];
  }
  // Re-render options to update highlight
  document.getElementById(`options-${qid}`).innerHTML = renderOptions(q);
};

window.updateOption = function(qid, idx, value) {
  const q = questions.find(q => q.id == qid);
  if (q) q.options[idx] = value;
};

window.addOption = function(qid) {
  const q = questions.find(q => q.id == qid);
  if (!q) return;
  q.options.push('');
  document.getElementById(`options-${qid}`).innerHTML = renderOptions(q);
};

window.removeOption = function(qid, idx) {
  const q = questions.find(q => q.id == qid);
  if (!q || q.options.length <= 2) return;
  q.options.splice(idx, 1);
  q.correct = q.correct.filter(c => c !== idx).map(c => c > idx ? c - 1 : c);
  document.getElementById(`options-${qid}`).innerHTML = renderOptions(q);
};

window.deleteQuestion = function(qid) {
  questions = questions.filter(q => q.id != qid);
  renderAllQuestions();
  Toast.info('Savol o\'chirildi');
};

window.changeQuestionType = function(qid, type) {
  const q = questions.find(q => q.id == qid);
  if (!q || q.type === type) return;

  q.type    = type;
  q.options = type === 'truefalse' ? ['Ha', 'Yo\'q'] :
              type === 'text'      ? []               : ['', '', '', ''];
  q.correct = [0];

  renderAllQuestions();
};

function updateQCount() {
  document.getElementById('q-count').textContent = questions.length;
}

/* ── SAVE ── */
document.getElementById('save-btn').addEventListener('click', async () => {
  const title = document.getElementById('test-title').value.trim();

  if (!title) {
    Toast.error('Test nomini kiriting!');
    document.getElementById('test-title').focus();
    return;
  }

  if (questions.length === 0) {
    Toast.error('Kamida 1 ta savol qo\'shing!');
    return;
  }

  // Validate questions
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.text.trim()) {
      Toast.error(`${i + 1}-savol matni bo'sh!`);
      return;
    }
    if (q.type !== 'text') {
      const hasEmpty = q.options.some(o => !o.trim());
      if (hasEmpty) {
        Toast.error(`${i + 1}-savoldagi variant bo'sh!`);
        return;
      }
    }
  }

  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  btn.textContent = 'Saqlanmoqda...';

  const testData = {
    title,
    description:      document.getElementById('test-desc').value.trim(),
    visibility:       document.getElementById('test-visibility').value,
    timeLimit:        parseInt(document.getElementById('test-time').value) || 0,
    passScore:        parseInt(document.getElementById('test-pass').value) || 60,
    shuffleQuestions: document.getElementById('test-shuffle').checked,
    showResult:       document.getElementById('test-show-result').checked,
    questionCount:    questions.length,
  };

  try {
    if (editingTestId) {
      await DB.updateTest(editingTestId, testData);
      await DB.saveQuestions(editingTestId, questions);
      Toast.success('Test yangilandi! ✅');
    } else {
      const testId = await DB.createTest(testData, currentUser.uid);
      await DB.saveQuestions(testId, questions);
      Toast.success('Test muvaffaqiyatli yaratildi! ✅');
      setTimeout(() => window.location.href = 'dashboard.html', 1500);
    }
  } catch (err) {
    Toast.error('Xato: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Saqlash';
  }
});

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
