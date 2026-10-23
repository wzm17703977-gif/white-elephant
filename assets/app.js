/* Shared helpers. Everything runs in the browser; nothing is sent anywhere. */
(function () {
  const GS = {};

  // Unbiased random integer in [0, n) using the Web Crypto API when available.
  GS.randInt = function (n) {
    if (window.crypto && crypto.getRandomValues) {
      const max = Math.floor(0x100000000 / n) * n;
      const buf = new Uint32Array(1);
      do { crypto.getRandomValues(buf); } while (buf[0] >= max);
      return buf[0] % n;
    }
    return Math.floor(Math.random() * n);
  };

  GS.shuffle = function (arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = GS.randInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // One name per line (commas also accepted); trims, drops blanks and exact duplicates.
  GS.parseNames = function (text) {
    const seen = new Set();
    return text.split(/[\n,]+/).map(s => s.trim()).filter(s => {
      if (!s) return false;
      const k = s.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  GS.store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('gsk:' + key); return v === null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('gsk:' + key, JSON.stringify(value)); } catch (e) { /* private mode */ }
    }
  };

  GS.toast = function (msg) {
    let t = document.querySelector('.toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'toast';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), 1800);
  };

  GS.copy = async function (text, okMsg) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e2) { /* ignore */ }
      ta.remove();
    }
    GS.toast(okMsg || 'Copied');
  };

  GS.share = async function (text, title) {
    if (navigator.share) {
      try { await navigator.share({ title: title || document.title, text }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    GS.copy(text, 'Copied — paste it anywhere');
  };

  GS.escape = function (s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };

  window.GS = GS;

  // On phones the nav is one scrollable row: bring the current page's link into view.
  document.addEventListener('DOMContentLoaded', () => {
    const nav = document.querySelector('.nav'), cur = nav && nav.querySelector('[aria-current]');
    if (cur && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = cur.offsetLeft - (nav.clientWidth - cur.offsetWidth) / 2;
  });
})();
