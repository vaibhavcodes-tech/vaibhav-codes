/**
 * Instagram Reels & Breakdowns Module
 * - Connects to local FastAPI backend (http://localhost:8000)
 * - Dynamic username parameter support
 * - Dynamic sorting (Recent, Most Viral, Oldest)
 * - 5 reels preview with "Show More / Show All" toggle
 * - Hover card effects with like count and direct Instagram link arrow
 * - Rich Reel Breakdown Modal with full caption, stats & cover
 * - Resilient offline fallback to /data/reels-fallback.json
 */

export function initInstagramReels({ showToast, triggerConfetti }) {
  const API_BASE_URL = 
    (import.meta.env && import.meta.env.VITE_API_URL) || 
    window.INSTA_API_URL || 
    'https://vaibhav-codes-instagram-api.onrender.com';
  const urlParams = new URLSearchParams(window.location.search);
  const targetUser = urlParams.get('user') || 'vaibhav.codes';

  // State
  let allReels = [];
  let currentSort = 'recent';
  let isLiveBackend = false;
  let activeReelItem = null;
  let currentProfileData = null;

  // DOM Elements
  const gridEl = document.getElementById('reels-grid');
  const handleEl = document.getElementById('reels-creator-handle');
  const syncPill = document.getElementById('reels-sync-indicator');
  const sortButtons = document.querySelectorAll('.btn-sort-pill');

  // Modal Elements
  const modal = document.getElementById('reel-modal');
  const modalBadge = document.getElementById('reel-modal-badge');
  const modalTitle = document.getElementById('reel-modal-title');
  const modalBody = document.getElementById('reel-modal-body-content');
  const modalCloseBtn = document.getElementById('reel-modal-close-btn');

  if (!gridEl) return;

  // Update handle display
  if (handleEl) {
    handleEl.textContent = `@${targetUser}`;
    const handleLink = handleEl.closest('a');
    if (handleLink) {
      handleLink.href = `https://www.instagram.com/${targetUser}`;
    }
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------
  function formatNumber(num) {
    if (num === null || num === undefined || num === 0) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return Number(num).toLocaleString();
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Recent';
    try {
      const d = new Date(dateStr.replace(' ', 'T'));
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatCaptionHtml(caption) {
    if (!caption) return '<p class="caption-empty">No caption available.</p>';
    const escaped = escapeHtml(caption);
    // Highlight hashtags in accent blue
    const withTags = escaped.replace(/(#[a-zA-Z0-9_]+)/g, '<span class="caption-tag">$1</span>');
    // Highlight mentions in accent blue
    const withMentions = withTags.replace(/(@[a-zA-Z0-9._]+)/g, '<span class="caption-mention">$1</span>');
    // Convert line breaks
    return `<div class="caption-formatted">${withMentions.replace(/\n/g, '<br />')}</div>`;
  }

  function sortReelItems(list, sortKey) {
    const arr = [...list];
    if (sortKey === 'most_viral' || sortKey === 'viral') {
      arr.sort((a, b) => {
        const aViews = Number(a.views || 0);
        const bViews = Number(b.views || 0);
        if (bViews !== aViews) return bViews - aViews;
        const aLikes = Number(a.likes || 0);
        const bLikes = Number(b.likes || 0);
        if (bLikes !== aLikes) return bLikes - aLikes;
        return Number(b.comments || 0) - Number(a.comments || 0);
      });
      arr.forEach((item, idx) => {
        item.viralRank = idx + 1;
      });
    } else if (sortKey === 'oldest') {
      arr.forEach((item) => {
        delete item.viralRank;
      });
      arr.sort((a, b) => {
        const aDate = a.timestamp_utc || a.date || '';
        const bDate = b.timestamp_utc || b.date || '';
        return aDate.localeCompare(bDate);
      });
    } else {
      // recent (default)
      arr.forEach((item) => {
        delete item.viralRank;
      });
      arr.sort((a, b) => {
        const aDate = a.timestamp_utc || a.date || '';
        const bDate = b.timestamp_utc || b.date || '';
        return bDate.localeCompare(aDate);
      });
    }
    return arr;
  }

  // --------------------------------------------------------------------------
  // DYNAMIC HERO METRICS UPDATE
  // --------------------------------------------------------------------------
  function formatMetricNumber(val) {
    if (val === null || val === undefined) return null;
    const num = Number(val);
    if (isNaN(num)) return val;
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M+';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K+';
    return num + '+';
  }

  function animateMetricNumber(element, finalNum, formattedText, duration = 1000) {
    if (!element) return;
    const target = Number(finalNum);
    if (isNaN(target) || target <= 0) {
      element.textContent = formattedText || `${finalNum}+`;
      return;
    }

    const startTime = performance.now();
    const startNum = 0;

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(startNum + (target - startNum) * easeOut);

      if (progress < 1) {
        element.textContent = `${current}+`;
        requestAnimationFrame(step);
      } else {
        element.textContent = formattedText;
      }
    }

    requestAnimationFrame(step);
  }

  function updateDynamicMetrics(profile, totalPosts) {
    const followersEl = document.getElementById('metric-followers-num');
    const guidesEl = document.getElementById('metric-guides-num');

    const followers = profile?.followers_count;
    if (followersEl && followers !== null && followers !== undefined) {
      const formattedFollowers = formatMetricNumber(followers);
      animateMetricNumber(followersEl, followers, formattedFollowers);
    }

    const guides = totalPosts || profile?.total_posts_count;
    if (guidesEl && guides) {
      const formattedGuides = `${guides}+`;
      animateMetricNumber(guidesEl, guides, formattedGuides);
    }
  }

  function updatePageAvatar(profile) {
    if (!profile) return;
    const avatar =
      profile.local_profile_pic_full ||
      profile.local_profile_pic ||
      profile.profile_pic_url ||
      '/data/profile_pic.jpg';

    if (avatar) {
      const pageAvatar = document.querySelector('.creator-avatar-img');
      if (pageAvatar) {
        pageAvatar.src = avatar;
      }
    }
  }

  // --------------------------------------------------------------------------
  // 1-HOUR CACHING LAYER
  // --------------------------------------------------------------------------
  const CACHE_KEY_PREFIX = 'vaibhav_reels_cache_';
  const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour in milliseconds

  function getLocalCache() {
    try {
      const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${targetUser}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.timestamp || !Array.isArray(parsed.data)) {
        return null;
      }
      const age = Date.now() - parsed.timestamp;
      const isFresh = age < CACHE_TTL_MS;
      const minutesAgo = Math.max(0, Math.floor(age / 60000));
      return {
        ...parsed,
        isFresh,
        age,
        minutesAgo
      };
    } catch (err) {
      console.warn('[Reels] Cache read error:', err);
      return null;
    }
  }

  function setLocalCache(data, profile, totalCount, lastSynced, isLive) {
    try {
      const payload = {
        timestamp: Date.now(),
        data,
        profile: profile || {},
        totalCount: totalCount || data.length,
        lastSynced: lastSynced || new Date().toISOString(),
        isLive: !!isLive
      };
      localStorage.setItem(`${CACHE_KEY_PREFIX}${targetUser}`, JSON.stringify(payload));
    } catch (err) {
      console.warn('[Reels] Cache write error:', err);
    }
  }

  function clearLocalCache() {
    try {
      localStorage.removeItem(`${CACHE_KEY_PREFIX}${targetUser}`);
    } catch (err) {}
  }

  // --------------------------------------------------------------------------
  // DATA FETCHING (1-Hour Cache + Live Sync + Fallback)
  // --------------------------------------------------------------------------
  async function fetchReels(options = {}) {
    const { forceRefresh = false } = options;

    // 1. Serve from 1-Hour Cache if valid and not force-refreshing
    if (!forceRefresh) {
      const cached = getLocalCache();
      if (cached && cached.isFresh && cached.data.length > 0) {
        console.log(`[Reels] Loaded instantly from 1-hour cache (${cached.minutesAgo}m old)`);
        isLiveBackend = !!cached.isLive;
        allReels = sortReelItems(cached.data, currentSort);
        currentProfileData = cached.profile || {};
        updateSyncIndicator(isLiveBackend, cached.lastSynced);
        updateDynamicMetrics(cached.profile, cached.totalCount || allReels.length);
        updatePageAvatar(currentProfileData);
        renderReels();
        return;
      }
    }

    // Only render skeleton if no reels are currently visible
    if (allReels.length === 0) {
      renderSkeleton();
    }

    // 2. Fetch from Live API server (Render / Local)
    try {
      const controller = new AbortController();
      // On manual refresh allow up to 8s; on initial load 4s
      const timeoutId = setTimeout(() => controller.abort(), forceRefresh ? 8000 : 4000);

      const cacheBuster = `_t=${Date.now()}`;
      const res = await fetch(
        `${API_BASE_URL}/api/reels?username=${encodeURIComponent(targetUser)}&sort=${currentSort}&limit=0&${cacheBuster}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.data) && json.data.length > 0) {
          isLiveBackend = true;
          allReels = json.data;
          currentProfileData = json.profile || {};
          // Store fresh data in 1-hour local cache
          setLocalCache(json.data, json.profile, json.total_count || allReels.length, json.last_synced, true);
          updateSyncIndicator(true, json.last_synced);
          updateDynamicMetrics(json.profile, json.total_count || allReels.length);
          updatePageAvatar(currentProfileData);
          renderReels();

          if (forceRefresh) {
            if (showToast) showToast(`Updated! Synced ${json.data.length} latest reels`);
            if (triggerConfetti) triggerConfetti();
          }
          return;
        }
      }
    } catch (e) {
      // Backend not running, sleeping cold-start, or network issue -> proceed to fallback
    }

    // 3. Seamless Static Fallback
    try {
      const fallbackRes = await fetch(`/data/reels-fallback.json?_t=${Date.now()}`);
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        const posts = fallbackData.posts || [];
        isLiveBackend = false;
        allReels = sortReelItems(posts, currentSort);
        currentProfileData = fallbackData.profile || {};
        // Cache fallback data for 1 hour so repeat visits are instant
        setLocalCache(allReels, fallbackData.profile, fallbackData.posts_count || allReels.length, fallbackData.profile?.scraped_at, false);
        updateSyncIndicator(false, fallbackData.profile?.scraped_at);
        updateDynamicMetrics(fallbackData.profile, fallbackData.posts_count || allReels.length);
        updatePageAvatar(currentProfileData);
        renderReels();

        if (forceRefresh) {
          if (showToast) showToast('Latest reels refreshed from backup cache');
        }
        return;
      }
    } catch (err) {
      console.warn('[Reels] Fallback load failed:', err);
    }

    // 4. Stale cache recovery
    const staleCache = getLocalCache();
    if (staleCache && staleCache.data.length > 0) {
      allReels = sortReelItems(staleCache.data, currentSort);
      currentProfileData = staleCache.profile || {};
      renderReels();
      return;
    }

    // Error state
    renderError();
  }

  function updateSyncIndicator(isLive, lastSynced) {
    if (!syncPill) return;
    if (isLive) {
      syncPill.innerHTML = `
        <span class="sync-dot live"></span>
        <span>API Live &bull; Daily 7:30 AM</span>
      `;
      syncPill.classList.add('live-active');
      syncPill.title = `Connected to local API server. Last synced: ${lastSynced ? formatDate(lastSynced) : 'Recent'}`;
    } else {
      syncPill.innerHTML = `
        <span class="sync-dot"></span>
        <span>Daily 7:30 AM Sync</span>
      `;
      syncPill.classList.remove('live-active');
      syncPill.title = 'Serving cached portfolio dataset (API server ready at http://localhost:8000)';
    }
  }

  function renderSkeleton() {
    gridEl.innerHTML = Array(5)
      .fill(0)
      .map(
        () => `
        <div class="reel-card-skeleton">
          <div class="skeleton-thumb"></div>
          <div class="skeleton-meta">
            <div class="skeleton-line line-title"></div>
            <div class="skeleton-line line-sub"></div>
          </div>
        </div>
      `
      )
      .join('');
  }

  function renderError() {
    gridEl.innerHTML = `
      <div class="reels-empty-state">
        <svg class="svg-icon empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
        </svg>
        <h3>No Reels Available Right Now</h3>
        <p>Start the API server with <code>python run_server.py</code> in <code>insta data/</code> to sync fresh reels from @${targetUser}.</p>
        <button id="retry-reels-btn" class="btn-pill-primary mt-3">
          <span>Retry Connection</span>
        </button>
      </div>
    `;
    const retryBtn = document.getElementById('retry-reels-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', fetchReels);
    }
  }

  // --------------------------------------------------------------------------
  // REELS RENDERING
  // --------------------------------------------------------------------------
  function renderReels() {
    if (!allReels || allReels.length === 0) {
      renderError();
      return;
    }

    // Always show top 5 reels for all sort buttons
    const visibleReels = allReels.slice(0, 5);
    const isViralMode = currentSort === 'most_viral' || currentSort === 'viral';

    const cardsHtml = visibleReels
      .map((item, index) => {
        const coverSrc =
          item.effective_cover_url ||
          item.local_cover_url ||
          item.cover_image_url ||
          '/vaibhav-profile.jpg';

        const hook =
          item.opening_hook ||
          (item.caption ? item.caption.split('\n')[0].slice(0, 75) : 'System Design Breakdown');

        const postUrl = item.post_url || `https://www.instagram.com/p/${item.shortcode}/`;
        const likes = Number(item.likes || 0);
        const comments = Number(item.comments || 0);
        const views = Number(item.views || 0);

        // Only show rank badge when in viral mode
        const rankBadge = isViralMode
          ? `<span class="reel-rank-pill">#${index + 1} Viral</span>`
          : '';

        const viewsHtml =
          views > 0
            ? `
          <div class="hover-stat-item" title="${formatNumber(views)} Views">
            <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <span>${formatNumber(views)}</span>
          </div>`
            : '';

        return `
        <article class="reel-card" data-index="${index}" data-shortcode="${item.shortcode}">
          <!-- Cover & Hover Effects -->
          <div class="reel-cover-box">
            <img 
              src="${coverSrc}" 
              alt="${escapeHtml(hook)}" 
              class="reel-thumb-img" 
              loading="lazy" 
              onerror="this.onerror=null; this.src='/vaibhav-profile.jpg';"
            />
            
            <div class="reel-top-badges">
              <span class="reel-badge-pill">
                <svg class="reel-film-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
                </svg>
                REEL
              </span>
              ${rankBadge}
            </div>

            <!-- Sleek Hover Overlay with Direct Arrow & Like Count Effect -->
            <div class="reel-hover-overlay">
              <a 
                href="${postUrl}" 
                target="_blank" 
                rel="noopener noreferrer" 
                class="reel-direct-arrow-btn" 
                title="Watch on Instagram ↗"
                aria-label="Direct Instagram link"
              >
                <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="7" y1="17" x2="17" y2="7"></line>
                  <polyline points="7 7 17 7 17 17"></polyline>
                </svg>
              </a>

              <div class="reel-hover-center-prompt">
                <span class="tap-label">Click for Breakdown &amp; Notes</span>
              </div>

              <div class="reel-hover-stats-strip">
                <div class="hover-stat-item like-item" title="${formatNumber(likes)} Likes">
                  <svg class="svg-icon heart-svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                  <span class="stat-count">${formatNumber(likes)}</span>
                </div>
                <div class="hover-stat-item" title="${formatNumber(comments)} Comments">
                  <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                  </svg>
                  <span class="stat-count">${formatNumber(comments)}</span>
                </div>
                ${viewsHtml}
              </div>
            </div>
          </div>

          <!-- Bottom Text Container -->
          <div class="reel-caption-meta">
            <h4 class="reel-hook-title">${escapeHtml(hook)}</h4>
            <div class="reel-date-row">
              <span class="reel-pub-date">${formatDate(item.timestamp_utc || item.date)}</span>
              <span class="reel-view-link">
                <span>Inspect</span>
                <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </span>
            </div>
          </div>
        </article>
        `;
      })
      .join('');

    gridEl.innerHTML = cardsHtml;

    // Attach Click Handler to each card
    gridEl.querySelectorAll('.reel-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        // If clicked on direct arrow link, allow native navigation
        if (e.target.closest('.reel-direct-arrow-btn')) return;
        const idx = Number(card.getAttribute('data-index'));
        const reelItem = visibleReels[idx];
        if (reelItem) {
          openReelModal(reelItem);
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // REEL MODAL LOGIC
  // --------------------------------------------------------------------------
  function openReelModal(item) {
    activeReelItem = item;
    if (!modal) return;

    const hook =
      item.opening_hook ||
      (item.caption ? item.caption.split('\n')[0].slice(0, 80) : 'System Design Breakdown');

    const coverSrc =
      item.effective_cover_url ||
      item.local_cover_url ||
      item.cover_image_url ||
      '/vaibhav-profile.jpg';

    const postUrl = item.post_url || `https://www.instagram.com/p/${item.shortcode}/`;
    const likes = Number(item.likes || 0);
    const comments = Number(item.comments || 0);
    const views = Number(item.views || 0);
    const engagement = likes + comments;

    // Only display viral badge when in viral mode
    const isViralMode = currentSort === 'most_viral' || currentSort === 'viral';
    if (modalBadge) {
      modalBadge.textContent = isViralMode && item.viralRank
        ? `TOP #${item.viralRank} VIRAL REEL • @${targetUser}`
        : `INSTAGRAM REEL • @${targetUser}`;
    }

    if (modalTitle) {
      // Clean emojis from title for a clean display
      modalTitle.textContent = hook.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
    }

    const avatarSrc =
      currentProfileData?.local_profile_pic_full ||
      currentProfileData?.local_profile_pic ||
      currentProfileData?.profile_pic_url ||
      '/data/profile_pic.jpg' ||
      '/vaibhav-profile.jpg';

    const creatorName = currentProfileData?.full_name
      ? currentProfileData.full_name.split('|')[0].trim()
      : 'Vaibhav';

    if (modalBody) {
      modalBody.innerHTML = `
        <div class="reel-modal-container">
          <!-- Left Media Column: Clean Full Poster -->
          <div class="reel-modal-media-wrap">
            <a 
              href="${postUrl}" 
              target="_blank" 
              rel="noopener noreferrer" 
              class="reel-modal-poster-box" 
              title="Watch on Instagram"
            >
              <img 
                src="${coverSrc}" 
                alt="Reel Cover" 
                class="reel-modal-cover-preview" 
                onerror="this.onerror=null; this.src='/vaibhav-profile.jpg';"
              />
              <!-- Modern Instagram Reel icon at bottom corner -->
              <div class="reel-play-btn-bottom" aria-hidden="true" title="Instagram Reel">
                <svg class="reel-corner-svg" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4zm-6.5 12V9.5l5 3.25-5 3.25z"/>
                </svg>
              </div>
            </a>
          </div>

          <!-- Right Details Column -->
          <div class="reel-modal-details-col">
            <!-- Author Strip -->
            <div class="reel-author-strip">
              <img 
                src="${avatarSrc}" 
                alt="${escapeHtml(creatorName)}" 
                class="reel-author-img" 
                onerror="this.onerror=null; this.src='/data/profile_pic.jpg';"
              />
              <div class="reel-author-text">
                <div class="author-name-row">
                  <span class="author-name">${escapeHtml(creatorName)}</span>
                  <span class="author-handle">@${targetUser}</span>
                  <span class="verified-dot">✓</span>
                </div>
                <div class="author-date-row">
                  <span>Published ${formatDate(item.timestamp_utc || item.date)}</span>
                </div>
              </div>
            </div>

            <!-- Clean Simple Caption Panel -->
            <div class="reel-caption-simple-box">
              ${formatCaptionHtml(item.caption)}
            </div>

            <!-- Bottom Action & Stats Row (Clean Placement) -->
            <div class="reel-modal-footer-row">
              <div class="poster-stats-overlay">
                <span class="poster-stat-item">
                  <svg class="svg-icon-heart" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                  <span>${formatNumber(likes)} likes</span>
                </span>
                <span class="stat-sep">&bull;</span>
                <span class="poster-stat-item">
                  <svg class="svg-icon-comment" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  <span>${formatNumber(comments)} comments</span>
                </span>
              </div>

              <a href="${postUrl}" target="_blank" rel="noopener noreferrer" class="btn-modal-ig">
                <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
                <span>Watch on Instagram</span>
                <svg class="svg-icon ig-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="7" y1="17" x2="17" y2="7"></line>
                  <polyline points="7 7 17 7 17 17"></polyline>
                </svg>
              </a>
            </div>
          </div>
        </div>
      `;
    }

    modal.style.display = 'flex';
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeReelModal() {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setTimeout(() => {
      if (!modal.classList.contains('open')) {
        modal.style.display = 'none';
      }
    }, 250);
  }

  // --------------------------------------------------------------------------
  // EVENT LISTENERS
  // --------------------------------------------------------------------------
  // Sorting Buttons
  sortButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const sortValue = btn.getAttribute('data-sort');
      if (sortValue === currentSort) return;

      sortButtons.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });

      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      currentSort = sortValue;

      // If backend is live, we can re-fetch with &sort= or re-sort locally
      if (allReels.length > 0) {
        allReels = sortReelItems(allReels, currentSort);
        renderReels();
      } else {
        fetchReels();
      }
    });
  });

  // Modal Close Events
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeReelModal);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeReelModal();
      }
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('open')) {
      closeReelModal();
    }
  });

  // Kick off initial load (served from 1-hour cache or fetched fresh)
  fetchReels();
}

