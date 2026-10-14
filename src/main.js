import './style.css';
import confetti from 'canvas-confetti';

// ==========================================================================
// SYSTEM BREAKDOWN DETAILS FOR MODALS
// ==========================================================================
const BREAKDOWN_DATA = {
  outbox: {
    badge: "EVENT-DRIVEN INFRASTRUCTURE",
    title: "Transactional Outbox Pattern & CDC",
    code: `// Atomic Database Commit with Outbox Record
await db.transaction(async (trx) => {
  // 1. Core entity write
  const order = await trx('orders').insert({
    id: orderId,
    amount: 1499,
    status: 'PAID'
  }).returning('*');

  // 2. Outbox event written to same ACID transaction
  await trx('outbox_events').insert({
    id: crypto.randomUUID(),
    aggregate_type: 'Order',
    aggregate_id: orderId,
    event_type: 'OrderPaid',
    payload: JSON.stringify(order),
    created_at: new Date()
  });
});

// Debezium or Worker polls outbox_events and publishes to Kafka with 100% guarantee`,
    steps: [
      {
        title: "Eliminates Dual-Write Hazards",
        desc: "Writing to a SQL database and publishing to Kafka in two separate calls creates a failure window where one can fail while the other succeeds. The Outbox pattern guarantees atomicity via local ACID transactions."
      },
      {
        title: "Log-Tailed CDC (Change Data Capture)",
        desc: "Debezium reads the PostgreSQL WAL (Write-Ahead Log) to stream events from the outbox table directly into Kafka topics without polling overhead."
      },
      {
        title: "Consumer Idempotency",
        desc: "Downstream consumers use Redis SETNX with a 24-hour TTL on the event UUID to ensure duplicate messages are acknowledged but never double-processed."
      }
    ]
  },
  caching: {
    badge: "HIGH-CONCURRENCY CACHING",
    title: "Ultra-Scale Redis Layer & Stampede Shield",
    code: `// XFetch Probabilistic Early Expiration Algorithm
async function getWithXFetch(key, computeFn, ttlSeconds, beta = 1.0) {
  const cached = await redis.hgetall(key);
  
  if (cached && cached.val) {
    const timeRemaining = Number(cached.expireAt) - Date.now();
    const delta = Number(cached.delta); // compute duration in ms
    
    // Probabilistic early refresh trigger
    if (-delta * beta * Math.log(Math.random()) > timeRemaining) {
      // Refresh asynchronously in background with distributed mutex
      refreshInBackground(key, computeFn, ttlSeconds);
    }
    return JSON.parse(cached.val);
  }
  
  return await refreshInBackground(key, computeFn, ttlSeconds);
}`,
    steps: [
      {
        title: "Probabilistic Early Expiration (XFetch)",
        desc: "When hot keys expire simultaneously under 100,000 RPS, thousands of concurrent requests slam the primary database. XFetch recalculates the value probabilistically right before expiration."
      },
      {
        title: "Scalable Bloom Filter",
        desc: "Protects against cache penetration attacks where clients request non-existent keys. Queries that fail the Bloom filter return immediate 404s without querying Postgres."
      },
      {
        title: "Distributed Mutex via Redis Redlock",
        desc: "Only one worker is granted the lock to compute the expensive database query, while remaining client requests serve the previous stale cache."
      }
    ]
  }
};

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
      const email = copyBtn.getAttribute('data-email') || 'vaibhavcodes@gmail.com';
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

  // Interactive System Breakdown Modal
  const modal = document.getElementById('breakdown-modal');
  const modalEyebrow = document.getElementById('modal-eyebrow');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body-content');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  function openBreakdown(type) {
    const data = BREAKDOWN_DATA[type];
    if (!data || !modal) return;

    modalEyebrow.textContent = data.badge;
    modalTitle.textContent = data.title;

    const stepsHtml = data.steps.map((s, idx) => `
      <div class="modal-step-item">
        <div class="step-num-badge">${idx + 1}</div>
        <div class="step-content">
          <strong>${s.title}</strong>
          <p>${s.desc}</p>
        </div>
      </div>
    `).join('');

    modalBody.innerHTML = `
      <div class="modal-code-block">
        <pre><code>${data.code}</code></pre>
      </div>
      <div class="modal-step-list">
        ${stepsHtml}
      </div>
    `;

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('[data-demo]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const type = btn.getAttribute('data-demo');
      openBreakdown(type);
    });
  });

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeModal);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('open')) {
      closeModal();
    }
  });

  // Confetti on Instagram Hero Button Click
  const igBtn = document.querySelector('.btn-pill-primary');
  if (igBtn) {
    igBtn.addEventListener('click', () => {
      triggerConfetti();
    });
  }
});
