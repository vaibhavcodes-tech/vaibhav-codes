import './style.css';
import confetti from 'canvas-confetti';
import { initInstagramReels } from './instagram-reels.js';

// ==========================================================================
// TOAST NOTIFICATION HELPER
// ==========================================================================
function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.innerHTML = `
    <svg class="toast-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    <span>${message}</span>
  `;
  toast.classList.add('visible');

  clearTimeout(toast.timeoutId);
  toast.timeoutId = setTimeout(() => {
    toast.classList.remove('visible');
  }, duration);
}

// ==========================================================================
// CONFETTI CELEBRATION
// ==========================================================================
function triggerConfetti() {
  confetti({
    particleCount: 40,
    spread: 60,
    origin: { y: 0.7 },
    colors: ['#0071E3', '#34C759', '#1D1D1F', '#AF52DE']
  });
}

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Mobile Header Toggle
  const header = document.querySelector('.site-header');
  const mobileToggle = document.getElementById('mobile-toggle');
  const mobileMenu = document.getElementById('mobile-menu');

  if (mobileToggle && mobileMenu && header) {
    mobileToggle.addEventListener('click', () => {
      header.classList.toggle('menu-open');
      mobileMenu.classList.toggle('open');
    });

    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        header.classList.remove('menu-open');
        mobileMenu.classList.remove('open');
      });
    });
  }

  // Copy Email Functionality
  const copyBtn = document.getElementById('copy-email-btn');
  const copyText = document.getElementById('copy-email-text');

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const email = copyBtn.getAttribute('data-email') || 'vaibhav.codes.tech@gmail.com';
      try {
        await navigator.clipboard.writeText(email);
        triggerConfetti();
        showToast('Email copied to clipboard: ' + email);
        if (copyText) {
          const original = copyText.textContent;
          copyText.textContent = 'Copied!';
          setTimeout(() => {
            copyText.textContent = original;
          }, 2000);
        }
      } catch (err) {
        showToast('Contact: ' + email);
      }
    });
  }

  // Confetti on Instagram Hero Button Click
  const igBtn = document.querySelector('.btn-pill-primary');
  if (igBtn) {
    igBtn.addEventListener('click', () => {
      triggerConfetti();
    });
  }
  // Dynamic Current Year in Footer
  const yearEl = document.getElementById('current-year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // Initialize Instagram Reels Dynamic Section & Modal
  initInstagramReels({ showToast, triggerConfetti });
});
