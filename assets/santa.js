/* Secret Santa generator: draw with exclusions, one private link per person. */
(function () {
  const $ = id => document.getElementById(id);
  const KEY = 'gift-swap-kit';

  // Scramble (not encrypt) the payload so a match isn't readable at a glance in the link.
  function encode(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    const out = bytes.map((b, i) => b ^ KEY.charCodeAt(i % KEY.length));
    let bin = '';
    out.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  window.GSDecode = function (str) {
    const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(bin, (c, i) => c.charCodeAt(0) ^ KEY.charCodeAt(i % KEY.length));
    return JSON.parse(new TextDecoder().decode(bytes));
  };
  if (!$('draw')) return; // reveal page only needs the decoder

  // Exclusion rows.
  function namesNow() { return GS.parseNames($('names').value); }
  function optionList(selected) {
    return '<option value="">Choose…</option>' + namesNow().map(n =>
      `<option${n === selected ? ' selected' : ''}>${GS.escape(n)}</option>`).join('');
  }
  function addExcl(a, b) {
    const row = document.createElement('div');
    row.className = 'excl-row';
    row.innerHTML = `<select aria-label="Person">${optionList(a)}</select><span>can’t draw</span>
      <select aria-label="Excluded person">${optionList(b)}</select>
      <button class="btn ghost" type="button" aria-label="Remove exclusion">✕</button>`;
    row.querySelector('button').addEventListener('click', () => { row.remove(); save(); });
    row.querySelectorAll('select').forEach(s => s.addEventListener('change', save));
    $('excl').appendChild(row);
  }
  function exclusions() {
    return [...$('excl').querySelectorAll('.excl-row')].map(r => {
      const [a, b] = r.querySelectorAll('select');
      return [a.value, b.value];
    }).filter(([a, b]) => a && b && a !== b);
  }
  function refreshOptions() {
    $('excl').querySelectorAll('.excl-row').forEach(r => {
      r.querySelectorAll('select').forEach(s => { const v = s.value; s.innerHTML = optionList(v); });
    });
  }
  $('add-excl').addEventListener('click', () => {
    if (namesNow().length < 2) { GS.toast('Add names first'); return; }
    addExcl('', '');
  });
  $('names').addEventListener('change', () => { refreshOptions(); save(); });

  // Draw: random shuffles until a valid assignment is found (fast for real party sizes).
  function solve(names, excl) {
    const blocked = new Set();
    excl.forEach(([a, b]) => { blocked.add(a + '\u0000' + b); blocked.add(b + '\u0000' + a); });
    const ok = (g, r) => g !== r && !blocked.has(g + '\u0000' + r);
    for (let attempt = 0; attempt < 20000; attempt++) {
      const r = GS.shuffle(names);
      if (names.every((g, i) => ok(g, r[i]))) return names.map((g, i) => [g, r[i]]);
    }
    return null;
  }

  // When no draw exists, say who is stuck instead of a generic error.
  function diagnose(names, excl) {
    const blocked = new Set();
    excl.forEach(([a, b]) => { blocked.add(a + '\u0000' + b); blocked.add(b + '\u0000' + a); });
    const ok = (g, r) => g !== r && !blocked.has(g + '\u0000' + r);
    const canDraw = g => names.filter(r => ok(g, r));
    for (const g of names) {
      if (!canDraw(g).length) return GS.escape(g) + ' is excluded from everyone, so there is nobody left for them to draw.';
    }
    for (const r of names) {
      if (!names.some(g => ok(g, r))) return 'Nobody is allowed to draw ' + GS.escape(r) + '.';
    }
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = canDraw(names[i]), b = canDraw(names[j]);
        if (a.length === 1 && b.length === 1 && a[0] === b[0]) {
          return GS.escape(names[i]) + ' and ' + GS.escape(names[j]) + ' can both only draw ' + GS.escape(a[0]) + '.';
        }
      }
    }
    return 'These exclusions leave no way to pair everyone.';
  }

  // One-tap budget and date chips.
  (function quickPicks() {
    const now = new Date();
    const year = now.getMonth() === 11 && now.getDate() > 25 ? now.getFullYear() + 1 : now.getFullYear();
    const iso = d => year + '-12-' + String(d).padStart(2, '0');
    $('date-quick').innerHTML = [12, 19, 24, 25].map(d => {
      const label = new Date(iso(d) + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      return '<button type="button" data-v="' + iso(d) + '">' + label + '</button>';
    }).join('');
    document.querySelectorAll('.quick').forEach(box => {
      const input = $(box.dataset.for);
      const mark = () => box.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.v || b.textContent) === input.value)));
      box.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        input.value = b.dataset.v || b.textContent;
        input.dispatchEvent(new Event('change'));
        mark();
      });
      input.addEventListener('input', mark);
      input.addEventListener('change', mark);
      setTimeout(mark, 0);
    });
  })();

  function details() {
    return { e: $('event').value.trim(), b: $('budget').value.trim(), d: $('date').value, m: $('note').value.trim() };
  }
  function linkFor(pair, det) {
    const base = location.href.replace(/[#?].*$/, '').replace(/index\.html$/, '');
    return base + 'reveal/#' + encode(Object.assign({ g: pair[0], r: pair[1] }, det));
  }

  let current = null; // {pairs, det}

  function renderLinks() {
    const ul = $('links');
    ul.innerHTML = '';
    current.pairs.forEach(pair => {
      const url = linkFor(pair, current.det);
      const msg = `Hi ${pair[0]}! Here's your Secret Santa match${current.det.e ? ' for ' + current.det.e : ''}: ${url}`;
      const li = document.createElement('li');
      li.innerHTML = `<span class="giver">${GS.escape(pair[0])}</span><span class="btns">
        <a class="btn secondary" href="sms:?&body=${encodeURIComponent(msg)}">Text</a>
        <button class="btn secondary" type="button" data-act="share">Share</button>
        <button class="btn secondary" type="button" data-act="copy">Copy link</button></span>`;
      li.querySelector('[data-act=share]').addEventListener('click', () => GS.share(msg, 'Your Secret Santa match'));
      li.querySelector('[data-act=copy]').addEventListener('click', () => GS.copy(msg, 'Link for ' + pair[0] + ' copied'));
      ul.appendChild(li);
    });
    $('out').hidden = false;
  }

  function draw() {
    const names = namesNow();
    const msg = $('msg');
    msg.innerHTML = '';
    if (names.length < 3) {
      msg.innerHTML = '<p class="notice error">Add at least 3 names, one per line.</p>';
      return;
    }
    const unknown = exclusions().flat().filter(n => !names.includes(n));
    if (unknown.length) {
      msg.innerHTML = '<p class="notice error">An exclusion uses a name that is no longer in the list. Please fix or remove it.</p>';
      return;
    }
    const pairs = solve(names, exclusions());
    if (!pairs) {
      msg.innerHTML = '<p class="notice error">No valid draw is possible: ' + diagnose(names, exclusions()) + ' Remove an exclusion and try again.</p>';
      return;
    }
    current = { pairs, det: details() };
    save();
    renderLinks();
    $('out').scrollIntoView({ behavior: 'smooth', block: 'start' });
    GS.toast('Names drawn for ' + names.length + ' people');
  }

  function save() {
    GS.store.set('santa', {
      names: $('names').value, excl: exclusions(), det: details(), current
    });
  }

  $('draw').addEventListener('click', draw);
  $('redraw').addEventListener('click', () => {
    if (confirm('Redraw? Links you already sent will no longer match the new draw.')) draw();
  });
  $('clear').addEventListener('click', () => {
    if (!confirm('Clear all names and the draw?')) return;
    current = null;
    $('names').value = ''; $('excl').innerHTML = '';
    ['event', 'budget', 'date', 'note'].forEach(id => { $(id).value = ''; });
    $('out').hidden = true;
    save();
  });
  $('copy-all').addEventListener('click', () => {
    const text = current.pairs.map(p => `${p[0]}: ${linkFor(p, current.det)}`).join('\n');
    GS.copy(text, 'All links copied');
  });
  ['event', 'budget', 'date', 'note'].forEach(id => $(id).addEventListener('change', save));

  // Restore.
  const s = GS.store.get('santa', null);
  if (s) {
    $('names').value = s.names || '';
    const det = s.det || {};
    $('event').value = det.e || ''; $('budget').value = det.b || ''; $('date').value = det.d || ''; $('note').value = det.m || '';
    (s.excl || []).forEach(([a, b]) => addExcl(a, b));
    if (s.current && Array.isArray(s.current.pairs)) { current = s.current; renderLinks(); }
  }
})();
