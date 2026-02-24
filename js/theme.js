/* ================================================================
   TESTPRO 2.0 — theme.js  (Global Utils)
   ================================================================ */

/* ── Theme ── */
const Theme = {
  get() { return localStorage.getItem('tp_theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'); },
  set(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('tp_theme', t);
    document.querySelectorAll('.theme-toggle').forEach(b => b.textContent = t === 'dark' ? '☀️' : '🌙');
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: t } }));
  },
  toggle() { this.set(this.get() === 'dark' ? 'light' : 'dark'); },
  init() {
    this.set(this.get());
    document.addEventListener('click', e => { if (e.target.closest('.theme-toggle')) this.toggle(); });
    matchMedia('(prefers-color-scheme:dark)').addEventListener('change', e => {
      if (!localStorage.getItem('tp_theme')) this.set(e.matches ? 'dark' : 'light');
    });
  }
};

/* ── Toast ── */
const Toast = {
  wrap: null,
  init() {
    this.wrap = document.createElement('div');
    Object.assign(this.wrap.style, { position:'fixed', bottom:'1.5rem', right:'1.5rem', zIndex:'99999', display:'flex', flexDirection:'column', gap:'0.6rem', pointerEvents:'none', maxWidth:'360px' });
    document.body.appendChild(this.wrap);
  },
  show(msg, type = 'info', dur = 3500) {
    if (!this.wrap) this.init();
    const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
    const colors = { success:'rgba(16,185,129,0.1)', error:'rgba(244,63,94,0.1)', warning:'rgba(245,158,11,0.1)', info:'rgba(79,70,229,0.1)' };
    const borders = { success:'rgba(16,185,129,0.3)', error:'rgba(244,63,94,0.3)', warning:'rgba(245,158,11,0.3)', info:'rgba(79,70,229,0.3)' };
    const el = document.createElement('div');
    el.style.cssText = `display:flex;align-items:center;gap:0.65rem;padding:0.85rem 1.1rem;background:${colors[type]};border:1px solid ${borders[type]};backdrop-filter:blur(20px);border-radius:12px;font-family:'Plus Jakarta Sans',sans-serif;font-size:0.85rem;font-weight:500;color:var(--text);box-shadow:0 8px 32px rgba(0,0,0,0.15);pointer-events:all;cursor:pointer;animation:fadeInUp 0.3s cubic-bezier(0.16,1,0.3,1) both;min-width:200px;`;
    el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
    el.addEventListener('click', () => rm(el));
    this.wrap.appendChild(el);
    const t = setTimeout(() => rm(el), dur);
    function rm(e) { clearTimeout(t); e.style.animation = 'fadeIn 0.25s reverse both'; setTimeout(() => e.remove(), 250); }
  },
  success(m) { this.show(m, 'success'); },
  error(m)   { this.show(m, 'error'); },
  warning(m) { this.show(m, 'warning'); },
  info(m)    { this.show(m, 'info'); },
};

/* ── Ripple ── */
function initRipple() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    const r = document.createElement('span');
    r.className = 'ripple';
    const rect = btn.getBoundingClientRect();
    const sz = Math.max(rect.width, rect.height);
    r.style.cssText = `width:${sz}px;height:${sz}px;left:${e.clientX-rect.left-sz/2}px;top:${e.clientY-rect.top-sz/2}px`;
    btn.appendChild(r);
    setTimeout(() => r.remove(), 600);
  });
}

/* ── Navbar scroll ── */
function initNavScroll() {
  const nb = document.querySelector('.navbar');
  if (!nb) return;
  window.addEventListener('scroll', () => nb.classList.toggle('scrolled', scrollY > 10), { passive: true });
}

/* ── Sidebar (mobile) ── */
function initSidebar() {
  const toggle  = document.querySelector('.sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (!toggle || !sidebar) return;
  const close = () => { sidebar.classList.remove('open'); overlay?.classList.remove('show'); toggle.classList.remove('open'); };
  toggle.addEventListener('click', () => {
    const open = sidebar.classList.toggle('open');
    overlay?.classList.toggle('show', open);
    toggle.classList.toggle('open', open);
  });
  overlay?.addEventListener('click', close);
  document.querySelectorAll('.sidebar-nav-item').forEach(a => a.addEventListener('click', close));
}

/* ── Modal ── */
const Modal = {
  open(id)  { const m = document.getElementById(id); if (m) { m.classList.add('show'); document.body.style.overflow = 'hidden'; } },
  close(id) { const m = document.getElementById(id); if (m) { m.classList.remove('show'); document.body.style.overflow = ''; } },
  init() {
    document.addEventListener('click', e => {
      if (e.target.matches('.modal-close') || e.target.matches('[data-close-modal]')) {
        const m = e.target.closest('.modal-overlay');
        if (m) { m.classList.remove('show'); document.body.style.overflow = ''; }
      }
      if (e.target.matches('.modal-overlay')) { e.target.classList.remove('show'); document.body.style.overflow = ''; }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.show').forEach(m => { m.classList.remove('show'); document.body.style.overflow = ''; });
      }
    });
  }
};

/* ── Carousel ── */
function initCarousel(wrap) {
  const rail = wrap.querySelector('.carousel');
  if (!rail) return;
  const prev = wrap.querySelector('.carousel-btn.prev');
  const next = wrap.querySelector('.carousel-btn.next');
  const scroll = d => rail.scrollBy({ left: d * 276, behavior: 'smooth' });
  prev?.addEventListener('click', () => scroll(-1));
  next?.addEventListener('click', () => scroll(1));

  // Drag scroll for desktop
  let startX, scrollLeft, dragging = false;
  rail.addEventListener('mousedown', e => { dragging = true; startX = e.pageX - rail.offsetLeft; scrollLeft = rail.scrollLeft; rail.style.cursor = 'grabbing'; });
  document.addEventListener('mouseup', () => { dragging = false; rail.style.cursor = ''; });
  rail.addEventListener('mousemove', e => { if (!dragging) return; e.preventDefault(); const x = e.pageX - rail.offsetLeft; rail.scrollLeft = scrollLeft - (x - startX); });
}

/* ── Code input auto-focus ── */
function initCodeInput() {
  document.querySelectorAll('.code-input').forEach(wrap => {
    const inputs = wrap.querySelectorAll('input');
    inputs.forEach((inp, i) => {
      inp.addEventListener('input', e => {
        if (inp.value.length >= 1 && inputs[i + 1]) {
          inputs[i + 1].focus();
          inp.value = inp.value.slice(0, 1).toUpperCase();
        }
        inp.value = inp.value.toUpperCase();
      });
      inp.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !inp.value && inputs[i - 1]) inputs[i - 1].focus();
      });
    });
  });
}

/* ── Logout ── */
document.addEventListener('click', async e => {
  if (e.target.closest('#logout-btn')) {
    await auth.signOut().catch(() => {});
    window.location.href = 'login.html';
  }
});

/* ── Init all ── */
document.addEventListener('DOMContentLoaded', () => {
  Theme.init();
  initRipple();
  initNavScroll();
  initSidebar();
  Modal.init();
  Toast.init();
  initCodeInput();
  document.querySelectorAll('.carousel-wrap').forEach(initCarousel);
});

window.Theme = Theme;
window.Toast = Toast;
window.Modal = Modal;
window.initCarousel = initCarousel;
