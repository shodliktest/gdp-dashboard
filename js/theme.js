/* ============================================================
   TESTPRO — theme.js
   Dark/Light Mode with system detect + localStorage
   ============================================================ */

const ThemeManager = (() => {
  const STORAGE_KEY = 'testpro_theme';

  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function getSavedTheme() {
    return localStorage.getItem(STORAGE_KEY);
  }

  function applyTheme(theme, animate = true) {
    if (animate) {
      document.documentElement.style.transition = 'none';
    }

    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);

    // Update all toggle buttons
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
      btn.setAttribute('title', theme === 'dark' ? 'Switch to Light' : 'Switch to Dark');
    });

    // Dispatch event for other scripts
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
  }

  function toggle() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';

    // Add transition class
    document.documentElement.classList.add('theme-transitioning');

    applyTheme(next);

    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }, 400);
  }

  function init() {
    const saved = getSavedTheme();
    const theme = saved || getSystemTheme();
    applyTheme(theme, false);

    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!getSavedTheme()) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });

    // Bind all toggle buttons
    document.addEventListener('click', (e) => {
      if (e.target.closest('.theme-toggle')) {
        toggle();
      }
    });
  }

  return { init, toggle, applyTheme, getSystemTheme };
})();

// Ripple effect for buttons
function initRipple() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn) return;

    const ripple = document.createElement('span');
    ripple.classList.add('ripple');

    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`;

    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
}

// Navbar scroll shadow
function initNavbarScroll() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });
}

// Mobile hamburger
function initMobileNav() {
  const hamburger = document.querySelector('.hamburger');
  const mobileNav = document.querySelector('.mobile-nav');

  if (!hamburger || !mobileNav) return;

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    mobileNav.classList.toggle('open');
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!hamburger.contains(e.target) && !mobileNav.contains(e.target)) {
      hamburger.classList.remove('open');
      mobileNav.classList.remove('open');
    }
  });
}

// Sidebar toggle (for dashboard/admin pages)
function initSidebar() {
  const sidebarToggle = document.querySelector('.sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');

  if (!sidebarToggle || !sidebar) return;

  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('show');
  });

  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
    });
  }
}

// Fade-in on scroll (Intersection Observer)
function initScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          entry.target.style.animationDelay = `${index * 0.08}s`;
          entry.target.classList.add('fade-in-up');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
}

// Modal helpers
const Modal = {
  show(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  },
  hide(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  },
  init() {
    document.addEventListener('click', (e) => {
      // Close button
      if (e.target.matches('.modal-close') || e.target.matches('.modal-close *')) {
        const modal = e.target.closest('.modal-overlay');
        if (modal) {
          modal.style.display = 'none';
          document.body.style.overflow = '';
        }
      }
      // Click outside modal box
      if (e.target.matches('.modal-overlay')) {
        e.target.style.display = 'none';
        document.body.style.overflow = '';
      }
    });
  }
};

// Toast notifications
const Toast = {
  container: null,

  init() {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      pointer-events: none;
    `;
    document.body.appendChild(this.container);
  },

  show(message, type = 'info', duration = 3500) {
    if (!this.container) this.init();

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const colors = {
      success: 'rgba(46,204,113,0.12)',
      error: 'rgba(231,76,60,0.12)',
      warning: 'rgba(241,196,15,0.12)',
      info: 'rgba(108,99,255,0.12)',
    };
    const borderColors = {
      success: 'rgba(46,204,113,0.35)',
      error: 'rgba(231,76,60,0.35)',
      warning: 'rgba(241,196,15,0.35)',
      info: 'rgba(108,99,255,0.35)',
    };

    const toast = document.createElement('div');
    toast.style.cssText = `
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.9rem 1.25rem;
      background: ${colors[type]};
      border: 1px solid ${borderColors[type]};
      backdrop-filter: blur(20px);
      border-radius: 12px;
      font-family: 'DM Sans', sans-serif;
      font-size: 0.88rem;
      font-weight: 500;
      color: var(--text);
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      pointer-events: all;
      cursor: pointer;
      animation: fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
      max-width: 360px;
      min-width: 240px;
    `;

    toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
    toast.addEventListener('click', () => removeToast(toast));

    this.container.appendChild(toast);

    function removeToast(el) {
      el.style.animation = 'fadeIn 0.3s reverse both';
      setTimeout(() => el.remove(), 300);
    }

    setTimeout(() => removeToast(toast), duration);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg)   { this.show(msg, 'error'); },
  warning(msg) { this.show(msg, 'warning'); },
  info(msg)    { this.show(msg, 'info'); },
};

// Format date utility
function formatDate(timestamp) {
  if (!timestamp) return '—';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('uz-UZ', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Format time duration
function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Truncate text
function truncate(str, len = 80) {
  return str.length > len ? str.slice(0, len) + '...' : str;
}

// Init all on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
  initRipple();
  initNavbarScroll();
  initMobileNav();
  initSidebar();
  initScrollAnimations();
  Modal.init();
  Toast.init();
});
