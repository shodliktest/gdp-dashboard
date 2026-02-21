/* ============================================================
   TESTPRO — test.js
   Test taking, timer, navigation, scoring, result saving
   ============================================================ */

let test        = null;
let questions   = [];
let answers     = {};   // { questionId: selectedIndex or text }
let currentIdx  = 0;
let startTime   = null;
let timerInterval = null;
let timeLeft    = 0;
let currentUser = null;
let finished    = false;

const urlParams = new URLSearchParams(window.location.search);
const testId    = urlParams.get('id');

(async () => {
  currentUser = await AuthHelpers.getCurrentUser();

  if (!testId) {
    showError('Test ID topilmadi. URL to\'g\'ri emasmi?');
    return;
  }

  try {
    test      = await DB.getTest(testId);
    questions = await DB.getQuestions(testId);

    if (!test) {
      showError('Bu test mavjud emas yoki o\'chirilgan.');
      return;
    }

    // Check visibility
    if (test.visibility === 'private' && !currentUser) {
      window.location.href = 'login.html?redirect=test.html?id=' + testId;
      return;
    }

    // Shuffle questions if enabled
    if (test.shuffleQuestions) {
      questions = questions.sort(() => Math.random() - 0.5);
    }

    // Limit questions
    if (test.questionLimit && test.questionLimit > 0) {
      questions = questions.slice(0, test.questionLimit);
    }

    initTest();
  } catch (err) {
    showError('Xato: ' + err.message);
  }
})();

function initTest() {
  document.getElementById('loading-screen').style.display  = 'none';
  document.getElementById('test-content').style.display    = 'block';
  document.getElementById('test-title-header').textContent = test.title;
  document.title = `TestPro — ${test.title}`;

  startTime = Date.now();

  // Start timer
  if (test.timeLimit && test.timeLimit > 0) {
    timeLeft = test.timeLimit * 60;
    document.getElementById('timer-display').style.display = 'flex';
    document.getElementById('finish-btn').style.display = 'inline-flex';
    startTimer();
  }

  renderNavDots();
  renderCurrentQuestion();
}

/* ── Timer ── */
function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      finishTest(true);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  const display = document.getElementById('timer-display');
  display.innerHTML = `⏱️ ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  display.classList.toggle('warning', timeLeft < 60);
}

/* ── Navigation ── */
window.navigate = function(dir) {
  currentIdx = Math.min(Math.max(0, currentIdx + dir), questions.length - 1);
  renderCurrentQuestion();
  renderNavDots();
  updateProgress();
};

window.goToQuestion = function(idx) {
  currentIdx = idx;
  renderCurrentQuestion();
  renderNavDots();
  updateProgress();
};

function updateProgress() {
  const answered = Object.keys(answers).length;
  const pct = (answered / questions.length) * 100;
  document.getElementById('progress-fill').style.width = pct + '%';
}

/* ── Render Nav Dots ── */
function renderNavDots() {
  const nav = document.getElementById('q-nav');
  nav.innerHTML = questions.map((q, i) => `
    <div class="q-dot ${answers[q.id] !== undefined ? 'answered' : ''} ${i === currentIdx ? 'current' : ''}"
      onclick="goToQuestion(${i})">${i + 1}</div>
  `).join('');
}

/* ── Render Current Question ── */
function renderCurrentQuestion() {
  const q   = questions[currentIdx];
  const area = document.getElementById('questions-area');

  area.innerHTML = `
    <div class="q-card">
      <div class="q-meta">
        <span class="q-index">Savol ${currentIdx + 1} / ${questions.length}</span>
        <span class="q-points">${q.points || 1} ball</span>
      </div>
      <div class="q-text">${escapeHtml(q.text)}</div>
      <div class="options-list" id="options-area">
        ${renderOptions(q)}
      </div>
    </div>
  `;

  // Update nav buttons
  const prevBtn   = document.getElementById('prev-btn');
  const nextBtn   = document.getElementById('next-btn');
  const submitBtn = document.getElementById('submit-btn');

  prevBtn.style.display   = currentIdx > 0 ? 'inline-flex' : 'none';
  nextBtn.style.display   = currentIdx < questions.length - 1 ? 'inline-flex' : 'none';
  submitBtn.style.display = currentIdx === questions.length - 1 ? 'inline-flex' : 'none';
}

/* ── Render Options ── */
function renderOptions(q) {
  if (q.type === 'text') {
    return `<textarea class="form-input text-answer"
      placeholder="Javobingizni yozing..."
      onchange="saveAnswer('${q.id}', this.value)"
    >${escapeHtml(answers[q.id] || '')}</textarea>`;
  }

  const selected = answers[q.id];

  return q.options.map((opt, i) => {
    const isSelected = selected === i;
    const letter = String.fromCharCode(65 + i);
    return `
      <button class="option-btn ${isSelected ? 'selected' : ''}"
        onclick="selectOption('${q.id}', ${i})">
        <span class="option-letter">${letter}</span>
        ${escapeHtml(opt)}
      </button>
    `;
  }).join('');
}

/* ── Select Option ── */
window.selectOption = function(qid, idx) {
  answers[qid] = idx;

  // Update UI
  const q = questions.find(q => q.id == qid);
  document.getElementById('options-area').innerHTML = renderOptions(q);

  renderNavDots();
  updateProgress();

  // Auto advance (optional)
  if (q.type !== 'text' && currentIdx < questions.length - 1) {
    setTimeout(() => navigate(1), 400);
  }
};

window.saveAnswer = function(qid, value) {
  answers[qid] = value;
  renderNavDots();
  updateProgress();
};

/* ── FINISH TEST ── */
window.finishTest = async function(timeUp = false) {
  if (finished) return;

  const answered = Object.keys(answers).length;
  const total    = questions.length;

  if (!timeUp && answered < total) {
    const unanswered = total - answered;
    const confirm_msg = `Hali ${unanswered} ta savolga javob berilmagan. Testni yakunlaysizmi?`;
    if (!confirm(confirm_msg)) return;
  }

  finished = true;
  clearInterval(timerInterval);

  // Calculate score
  let correct   = 0;
  let totalPts  = 0;
  let earnedPts = 0;

  questions.forEach(q => {
    totalPts += (q.points || 1);
    if (q.type === 'text') return; // Manual grading for text

    const answer   = answers[q.id];
    const isCorrect = answer !== undefined && q.correct.includes(answer);
    if (isCorrect) {
      correct++;
      earnedPts += (q.points || 1);
    }
  });

  const score    = Math.round((earnedPts / totalPts) * 100) || 0;
  const duration = Math.round((Date.now() - startTime) / 1000);
  const passed   = score >= (test.passScore || 60);

  // Save result to Firestore
  if (currentUser) {
    try {
      await DB.saveResult({
        testId,
        testTitle: test.title,
        userId:    currentUser.uid,
        score,
        correct,
        total:     questions.length,
        earnedPts,
        totalPts,
        duration,
        answers,
        passed,
      });
    } catch (err) {
      console.warn('Result saqlashda xato:', err);
    }
  }

  // Show result
  if (test.showResult !== false) {
    showResult(score, correct, passed, duration);
  } else {
    window.location.href = 'dashboard.html';
  }
};

/* ── Show Result ── */
function showResult(score, correct, passed, duration) {
  document.getElementById('test-content').style.display = 'none';
  document.getElementById('result-screen').style.display = 'block';

  const circle = document.getElementById('result-circle');
  circle.textContent = score + '%';
  circle.className   = `result-circle ${passed ? 'pass' : 'fail'}`;

  document.getElementById('result-title').textContent = passed ? '🎉 A\'lo natija!' : '😔 Muvaffaqiyatsiz';
  document.getElementById('result-msg').textContent   = passed
    ? `Siz ${test.passScore || 60}% dan yuqori ball oldingiz!`
    : `O'tish bali: ${test.passScore || 60}%. Yana bir bor urinib ko'ring.`;

  const mins = Math.floor(duration / 60);
  const secs = duration % 60;

  document.getElementById('result-breakdown').innerHTML = `
    <div class="result-stat">
      <div class="result-stat-val" style="color:${passed ? '#2ecc71' : '#e74c3c'}">${score}%</div>
      <div class="result-stat-label">Umumiy ball</div>
    </div>
    <div class="result-stat">
      <div class="result-stat-val">${correct}/${questions.length}</div>
      <div class="result-stat-label">To'g'ri javoblar</div>
    </div>
    <div class="result-stat">
      <div class="result-stat-val">${mins}:${String(secs).padStart(2,'0')}</div>
      <div class="result-stat-label">Sarflangan vaqt</div>
    </div>
  `;
}

/* ── Review answers ── */
window.reviewAnswers = function() {
  document.getElementById('result-screen').style.display = 'none';

  const area = document.getElementById('questions-area');
  document.getElementById('test-content').style.display = 'block';

  area.innerHTML = questions.map((q, i) => {
    const userAns  = answers[q.id];
    const isCorrect = q.type !== 'text' && q.correct.includes(userAns);

    return `
      <div class="q-card" style="animation-delay:${i*0.06}s">
        <div class="q-meta">
          <span class="q-index">Savol ${i + 1}</span>
          <span class="badge ${q.type === 'text' ? 'badge-info' : isCorrect ? 'badge-success' : 'badge-danger'}">
            ${q.type === 'text' ? 'Matn' : isCorrect ? '✓ To\'g\'ri' : '✗ Noto\'g\'ri'}
          </span>
        </div>
        <div class="q-text">${escapeHtml(q.text)}</div>
        <div class="options-list">
          ${q.type === 'text' ? `
            <div class="form-input" style="min-height:60px">${escapeHtml(userAns || '(Javob berilmagan)')}</div>
          ` : q.options.map((opt, j) => {
            const isSel   = userAns === j;
            const isCorr  = q.correct.includes(j);
            const cls     = isCorr ? 'correct' : (isSel && !isCorr ? 'wrong' : '');
            return `
              <div class="option-btn ${cls} disabled">
                <span class="option-letter">${String.fromCharCode(65+j)}</span>
                ${escapeHtml(opt)}
                ${isCorr ? ' ✓' : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');

  // Hide nav
  document.querySelector('[onclick="navigate(-1)"]').style.display   = 'none';
  document.querySelector('[onclick="navigate(1)"]').style.display    = 'none';
  document.getElementById('submit-btn').style.display = 'none';
  document.getElementById('q-nav').innerHTML = '';

  // Add back to result btn
  document.querySelector('.page-wrapper').insertAdjacentHTML('afterbegin', `
    <div style="text-align:center;padding:1.5rem">
      <a href="dashboard.html" class="btn btn-primary">🏠 Dashboard →</a>
    </div>
  `);
};

function showError(msg) {
  document.getElementById('loading-screen').innerHTML = `
    <div class="empty-state" style="padding:5rem 2rem">
      <div class="empty-state-icon">❌</div>
      <h3>${msg}</h3>
      <a href="dashboard.html" class="btn btn-primary" style="margin-top:1rem">Dashboard →</a>
    </div>
  `;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
