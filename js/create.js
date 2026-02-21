/* ============================================================
   TESTPRO — create.js  (FIXED)
   - Test yaratish + tahrirlash
   - Dinamik savol builder
   - Matn formatidan import
   ============================================================ */

let questions     = [];
let currentUser   = null;
let editingTestId = null;

const urlParams = new URLSearchParams(window.location.search);

(async () => {
  currentUser = await AuthHelpers.requireAuth('login.html');
  if (!currentUser) return;

  const profile = await DB.getUser(currentUser.uid);
  document.getElementById('user-avatar').textContent = (profile?.name || 'U')[0].toUpperCase();
  document.getElementById('user-name').textContent   = profile?.name || currentUser.displayName || 'Foydalanuvchi';

  editingTestId = urlParams.get('id');
  if (editingTestId) {
    document.getElementById('page-title').textContent = 'Testni tahrirlash';
    await loadExistingTest(editingTestId);
  } else {
    addQuestion('multiple');
  }
})();

async function loadExistingTest(testId) {
  try {
    const test = await DB.getTest(testId);
    const qs   = await DB.getQuestions(testId);
    if (!test) { Toast.error('Test topilmadi'); return; }

    document.getElementById('test-title').value         = test.title || '';
    document.getElementById('test-desc').value          = test.description || '';
    document.getElementById('test-visibility').value    = test.visibility || 'public';
    document.getElementById('test-time').value          = test.timeLimit || 0;
    document.getElementById('test-pass').value          = test.passScore || 60;
    document.getElementById('test-shuffle').checked     = !!test.shuffleQuestions;
    document.getElementById('test-show-result').checked = test.showResult !== false;

    questions = qs.map((q, i) => ({ ...q, id: q.id || Date.now() + i }));
    renderAllQuestions();
  } catch (err) {
    Toast.error('Xato: ' + err.message);
    console.error(err);
  }
}

window.addQuestion = function(type = 'multiple') {
  const q = {
    id:      Date.now() + Math.random(),
    type,
    text:    '',
    options: type === 'multiple'  ? ['', '', '', ''] :
             type === 'truefalse' ? ["Ha", "Yo'q"]   : [],
    correct: [0],
    points:  1,
  };
  questions.push(q);
  renderAllQuestions();
  updateQCount();
  setTimeout(() => {
    const cards = document.querySelectorAll('.question-card');
    if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 80);
};

function renderAllQuestions() {
  const container = document.getElementById('questions-container');
  container.innerHTML = '';
  questions.forEach((q, i) => renderQuestionCard(q, i));
  updateQCount();
}

function renderQuestionCard(q, index) {
  const container  = document.getElementById('questions-container');
  const typeLabels = { multiple: 'Ko\'p tanlov', truefalse: 'Ha/Yo\'q', text: 'Matn' };
  const typeEmoji  = { multiple: '⭕', truefalse: '✅', text: '📝' };

  const card = document.createElement('div');
  card.className   = 'question-card fade-in';
  card.dataset.qid = q.id;

  card.innerHTML = `
    <div class="q-header">
      <div class="q-number">${index + 1}</div>
      <span class="badge badge-primary q-type-badge">${typeEmoji[q.type]} ${typeLabels[q.type]}</span>
      <div class="q-type-selector" style="margin-bottom:0;flex-wrap:wrap">
        ${['multiple','truefalse','text'].map(t => `
          <button class="q-type-btn ${q.type === t ? 'active' : ''}"
            onclick="changeQuestionType('${q.id}', '${t}')">
            ${typeEmoji[t]} ${typeLabels[t]}
          </button>
        `).join('')}
      </div>
      <button class="btn btn-danger btn-sm q-delete-btn" onclick="deleteQuestion('${q.id}')">🗑️</button>
    </div>

    <div class="form-group">
      <label class="form-label">Savol matni *</label>
      <textarea class="form-input q-text-input" placeholder="Savolingizni yozing..." rows="2"
        data-qid="${q.id}">${escQ(q.text)}</textarea>
    </div>

    <div id="opts-${q.id}">${renderOptionsHTML(q)}</div>

    <div style="display:flex;align-items:center;gap:0.75rem;margin-top:1rem">
      <label class="form-label" style="margin:0">Ball:</label>
      <input type="number" class="form-input" style="width:72px" value="${q.points||1}" min="1" max="10"
        data-qid="${q.id}" data-field="points" onchange="updateQField(this)" />
    </div>
  `;

  container.appendChild(card);

  // Safe event binding
  card.querySelector('.q-text-input').addEventListener('input', function() {
    const idx = questions.findIndex(x => String(x.id) === String(q.id));
    if (idx !== -1) questions[idx].text = this.value;
  });
}

function renderOptionsHTML(q) {
  if (q.type === 'text') {
    return `<p style="font-size:0.82rem;color:var(--text-3);font-style:italic;padding:0.5rem 0">
      📝 Foydalanuvchi erkin matn yozadi.
    </p>`;
  }

  if (q.type === 'truefalse') {
    return q.options.map((opt, i) => `
      <div class="option-row">
        <input type="radio" name="c-${q.id}" class="option-correct"
          ${q.correct.includes(i) ? 'checked' : ''}
          onchange="setCorrect('${q.id}', ${i})" />
        <input type="text" class="form-input" value="${escQ(opt)}" readonly
          style="${q.correct.includes(i) ? 'border-color:rgba(67,233,123,0.5);background:rgba(67,233,123,0.06)' : ''}" />
      </div>
    `).join('');
  }

  return q.options.map((opt, i) => `
    <div class="option-row">
      <input type="radio" name="c-${q.id}" class="option-correct"
        ${q.correct.includes(i) ? 'checked' : ''}
        onchange="setCorrect('${q.id}', ${i})" />
      <input type="text" class="form-input opt-input"
        value="${escQ(opt)}"
        placeholder="Variant ${String.fromCharCode(65+i)}"
        data-qid="${q.id}" data-idx="${i}"
        oninput="updateOption(this)"
        style="${q.correct.includes(i) ? 'border-color:rgba(67,233,123,0.5);background:rgba(67,233,123,0.06)' : ''}" />
      ${q.options.length > 2 ? `
        <button class="btn btn-ghost btn-sm" onclick="removeOption('${q.id}', ${i})" style="flex-shrink:0">✕</button>
      ` : ''}
    </div>
  `).join('') + (q.options.length < 6 ? `
    <button class="add-option-btn" onclick="addOption('${q.id}')">+ Variant qo'shish</button>
  ` : '');
}

window.updateQField = function(el) {
  const q = questions.find(q => String(q.id) === el.dataset.qid);
  if (q) q[el.dataset.field] = isNaN(+el.value) ? el.value : +el.value;
};

window.updateOption = function(el) {
  const q = questions.find(q => String(q.id) === el.dataset.qid);
  if (q) q.options[+el.dataset.idx] = el.value;
};

window.setCorrect = function(qid, idx) {
  const q = questions.find(q => String(q.id) === String(qid));
  if (!q) return;
  q.correct = [idx];
  document.getElementById(`opts-${qid}`).innerHTML = renderOptionsHTML(q);
};

window.addOption = function(qid) {
  const q = questions.find(q => String(q.id) === String(qid));
  if (!q) return;
  q.options.push('');
  document.getElementById(`opts-${qid}`).innerHTML = renderOptionsHTML(q);
};

window.removeOption = function(qid, idx) {
  const q = questions.find(q => String(q.id) === String(qid));
  if (!q || q.options.length <= 2) return;
  q.options.splice(idx, 1);
  q.correct = q.correct.filter(c => c !== idx).map(c => c > idx ? c-1 : c);
  if (q.correct.length === 0) q.correct = [0];
  document.getElementById(`opts-${qid}`).innerHTML = renderOptionsHTML(q);
};

window.deleteQuestion = function(qid) {
  questions = questions.filter(q => String(q.id) !== String(qid));
  renderAllQuestions();
  Toast.info('Savol o\'chirildi');
};

window.changeQuestionType = function(qid, type) {
  const q = questions.find(q => String(q.id) === String(qid));
  if (!q || q.type === type) return;
  q.type    = type;
  q.options = type === 'truefalse' ? ['Ha', "Yo'q"] : type === 'text' ? [] : ['', '', '', ''];
  q.correct = [0];
  renderAllQuestions();
};

function updateQCount() {
  const el = document.getElementById('q-count');
  if (el) el.textContent = questions.length;
}

/* ============================================================
   📄 TEXT FORMAT IMPORT
   Format namunasi:
   1. Qaysi tag HTML da rasm qo'shadi?
   a) <div>
   b) <img> *
   c) <span>
   d) <p>

   (* = to'g'ri javob)
   ============================================================ */
window.openImportModal = function() {
  document.getElementById('import-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
};

window.closeImportModal = function() {
  document.getElementById('import-modal').style.display = 'none';
  document.body.style.overflow = '';
};

window.importFromText = function() {
  const text = document.getElementById('import-textarea').value.trim();
  if (!text) { Toast.warning('Matn kiriting!'); return; }

  const imported = parseTextFormat(text);
  if (imported.length === 0) {
    Toast.error('Savol topilmadi. Format to\'g\'ri emasmi?'); return;
  }

  questions.push(...imported);
  renderAllQuestions();
  closeImportModal();
  Toast.success(`✅ ${imported.length} ta savol import qilindi!`);
  document.getElementById('import-textarea').value = '';
};

function parseTextFormat(rawText) {
  const results = [];
  // Split by double newline OR numbered question start
  const blocks = rawText.split(/\n(?=\s*\d+[\.\)])/g);

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    let questionText = '';
    const options    = [];
    let correctIdx   = 0;
    let qStarted     = false;

    for (const line of lines) {
      // Detect option: a) b) c) d) or A. B. etc
      const optRx = line.match(/^([a-dA-D])\s*[\)\.]\s*(.+)/);
      if (optRx) {
        qStarted = true;
        let content   = optRx[2].trim();
        let isCorrect = false;

        if (content.endsWith('*') || content.endsWith('[+]') || content.includes('(to\'g\'ri)')) {
          isCorrect = true;
          content = content.replace(/\*$/, '').replace('[+]', '').replace("(to'g'ri)", '').trim();
        }

        if (isCorrect) correctIdx = options.length;
        options.push(content);
      } else if (!qStarted) {
        // Question text — strip leading numbers
        questionText += (questionText ? ' ' : '') + line.replace(/^\d+[\.\)]\s*/, '');
      }
    }

    if (!questionText && lines.length) {
      questionText = lines[0].replace(/^\d+[\.\)]\s*/, '');
    }
    if (!questionText) continue;

    const q = {
      id:      Date.now() + Math.random(),
      type:    options.length >= 2 ? 'multiple' : 'text',
      text:    questionText.trim(),
      options: options,
      correct: [correctIdx],
      points:  1,
    };

    if (options.length === 2) {
      const l0 = options[0].toLowerCase();
      const l1 = options[1].toLowerCase();
      if ((l0.includes('ha') || l0.includes('true') || l0.includes("to'g'ri")) &&
          (l1.includes("yo'q") || l1.includes('false') || l1.includes("noto'g'ri"))) {
        q.type = 'truefalse';
      }
    }

    results.push(q);
  }

  return results;
}

/* ── SAQLASH ── */
document.getElementById('save-btn').addEventListener('click', async () => {
  const title = document.getElementById('test-title').value.trim();

  if (!title) { Toast.error('Test nomini kiriting!'); document.getElementById('test-title').focus(); return; }
  if (questions.length === 0) { Toast.error('Kamida 1 ta savol qo\'shing!'); return; }

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.text.trim()) { Toast.error(`${i+1}-savol matni bo'sh!`); return; }
    if (q.type !== 'text' && q.options.some(o => !o.trim())) {
      Toast.error(`${i+1}-savoldagi variant bo'sh!`); return;
    }
  }

  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  btn.innerHTML = '⏳ Saqlanmoqda...';

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
      Toast.success('✅ Test yangilandi!');
    } else {
      const testId = await DB.createTest(testData, currentUser.uid);
      await DB.saveQuestions(testId, questions);
      Toast.success('✅ Test yaratildi!');
    }
    setTimeout(() => window.location.href = 'dashboard.html', 1500);
  } catch (err) {
    console.error('Save error:', err);
    Toast.error('❌ Xato: ' + err.message);
    btn.disabled = false;
    btn.innerHTML = '💾 Saqlash';
  }
});

function escQ(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
