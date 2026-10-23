/* Secret Santa questionnaire maker. Questions and answers travel inside the link (#q= / #a=);
   nothing is uploaded. Depends on app.js (window.GS). */
(function () {
  const $ = id => document.getElementById(id);
  const esc = GS.escape;

  const BANK = [
    { g: 'The basics', items: [
      ['size', 'Clothing size (tops)', 'family'],
      ['shoe', 'Shoe size', 'family'],
      ['colors', 'Favorite colors', 'all'],
      ['hobbies', 'Hobbies and interests', 'all'],
    ] },
    { g: 'Favorites', items: [
      ['snacks', 'Favorite snacks or treats (sweet or salty?)', 'all'],
      ['drink', 'Coffee, tea, or something else? How do you take it?', 'all'],
      ['stores', 'Favorite stores or online shops', 'all'],
      ['team', 'Favorite sports team', 'adult'],
      ['scent', 'Favorite scents (candles, lotion, etc.)', 'adult'],
      ['media', 'Favorite books, movies, shows, or music', 'all'],
    ] },
    { g: 'Wishes and no-gos', items: [
      ['small', 'Something small you would love to get', 'all'],
      ['collect', 'Anything you collect?', 'all'],
      ['allergy', 'Allergies or food restrictions', 'all'],
      ['avoid', 'Please do NOT get me…', 'all'],
      ['giftcard', 'Gift cards: yes or no?', 'adult'],
    ] },
    { g: 'Just for fun', items: [
      ['dayoff', 'Your perfect day off looks like…', 'adult'],
      ['luxury', 'A little luxury you would never buy yourself', 'adult'],
      ['desk', 'Something that would make your desk or workday better', 'work'],
      ['pets', 'Pets? What are their names?', 'all'],
      ['guilty', 'A guilty pleasure you are happy to admit', 'adult'],
    ] },
    { g: 'For kids', items: [
      ['age', 'Age or grade', 'kids'],
      ['character', 'Favorite character or superhero', 'kids'],
      ['toy', 'Favorite toy or game right now', 'kids'],
      ['activity', 'Favorite thing to do after school', 'kids'],
    ] },
  ];
  const ALL = BANK.flatMap(g => g.items);
  const PRESETS = {
    work: ['colors', 'hobbies', 'snacks', 'drink', 'stores', 'media', 'small', 'allergy', 'avoid', 'giftcard', 'desk', 'luxury'],
    family: ['size', 'shoe', 'colors', 'hobbies', 'snacks', 'drink', 'stores', 'team', 'scent', 'small', 'collect', 'allergy', 'avoid', 'dayoff', 'pets'],
    kids: ['age', 'colors', 'character', 'toy', 'activity', 'snacks', 'media', 'small', 'collect', 'allergy', 'avoid'],
  };

  // ---------- link encoding (UTF-8 safe base64url) ----------
  function enc(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function dec(s) {
    try {
      const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
      return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
    } catch (e) { return null; }
  }
  const base = () => location.href.split('#')[0];
  function parseLink(text, key) {
    const m = String(text).match(new RegExp('#' + key + '=([A-Za-z0-9_-]+)'));
    return m ? dec(m[1]) : null;
  }

  // ---------- organizer state ----------
  const saved = GS.store.get('ssq', null);
  const state = saved || { preset: 'work', picked: PRESETS.work.slice(), custom: [], event: '', budget: '', due: '' };

  function questions() {
    const qs = ALL.filter(([k]) => state.picked.includes(k)).map(([, t]) => t);
    return qs.concat(state.custom.filter(Boolean));
  }
  function meta() {
    return { e: state.event.trim(), b: state.budget.trim(), d: state.due };
  }
  function save() { GS.store.set('ssq', state); }

  function renderBank() {
    $('bank').innerHTML = BANK.map(g => `
      <fieldset class="q-group"><legend>${esc(g.g)}</legend>
      ${g.items.map(([k, t]) => `<label class="q-item"><input type="checkbox" data-k="${k}" ${state.picked.includes(k) ? 'checked' : ''}> <span>${esc(t)}</span></label>`).join('')}
      </fieldset>`).join('');
    $('custom').value = state.custom.join('\n');
    document.querySelectorAll('[data-preset]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.preset === state.preset)));
    $('count').textContent = questions().length + ' questions';
  }

  function setupOrganizer() {
    $('organizer').hidden = false;
    $('ev').value = state.event; $('bud').value = state.budget; $('due').value = state.due;
    renderBank();
    $('bank').addEventListener('change', e => {
      const k = e.target.dataset.k;
      if (!k) return;
      state.picked = e.target.checked ? state.picked.concat(k) : state.picked.filter(x => x !== k);
      state.preset = 'custom';
      save(); renderBank();
    });
    document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
      state.preset = b.dataset.preset;
      state.picked = PRESETS[b.dataset.preset].slice();
      save(); renderBank();
    }));
    $('custom').addEventListener('input', () => {
      state.custom = $('custom').value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 10);
      save(); $('count').textContent = questions().length + ' questions';
    });
    [['ev', 'event'], ['bud', 'budget'], ['due', 'due']].forEach(([id, key]) =>
      $(id).addEventListener('input', () => { state[key] = $(id).value; save(); }));

    $('do-print').addEventListener('click', () => {
      if (!guard()) return;
      const per = Number($('per-page').value);
      const one = blankSheet(questions(), meta());
      $('sheet').innerHTML = Array.from({ length: per }, () => one).join('');
      $('sheet').className = 'card qsheet-wrap' + (per === 2 ? ' two-up' : '');
      printOnly('sheet');
    });
    $('do-copy').addEventListener('click', () => {
      if (!guard()) return;
      GS.copy(plainList(questions(), meta()), 'Question list copied');
    });
    $('do-link').addEventListener('click', () => {
      if (!guard()) return;
      const url = base() + '#q=' + enc({ ...meta(), q: questions() });
      $('link-box').hidden = false;
      $('fill-link').value = url;
      $('fill-link').select();
    });
    $('copy-link').addEventListener('click', () => GS.copy($('fill-link').value, 'Link copied — send it to your group'));
    $('share-link').addEventListener('click', () => GS.share('Fill out our Secret Santa questionnaire: ' + $('fill-link').value, 'Secret Santa questionnaire'));
    $('compile').addEventListener('click', compile);
  }

  function guard() {
    if (questions().length === 0) { GS.toast('Pick at least one question'); return false; }
    return true;
  }

  function headerLine(m) {
    const bits = [m.e, m.b ? 'Budget: ' + m.b : '', m.d ? 'Due: ' + m.d : ''].filter(Boolean);
    return bits.map(esc).join(' · ');
  }
  function blankSheet(qs, m) {
    return `<article class="qsheet">
      <h2>${esc(m.e || 'Secret Santa')} Questionnaire</h2>
      ${headerLine({ b: m.b, d: m.d }) ? `<p class="qmeta">${headerLine({ b: m.b, d: m.d })}</p>` : ''}
      <div class="qline"><strong>Your name:</strong><span></span></div>
      <ol>${qs.map(q => `<li><strong>${esc(q)}</strong><span class="blank"></span></li>`).join('')}</ol>
      <p class="qfoot">Made with Gift Swap Kit · free Secret Santa questionnaire maker</p>
    </article>`;
  }
  function plainList(qs, m) {
    const head = (m.e || 'Secret Santa') + ' questionnaire' + (m.b ? ' (budget ' + m.b + ')' : '') + (m.d ? ' — please reply by ' + m.d : '');
    return head + '\n\nYour name:\n' + qs.map((q, i) => `${i + 1}. ${q}\n`).join('');
  }

  function printOnly(id) {
    document.querySelectorAll('.print-me').forEach(el => el.classList.remove('print-me'));
    $(id).hidden = false;
    $(id).classList.add('print-me');
    setTimeout(() => window.print(), 50);
  }

  // ---------- participant: fill ----------
  function setupFill(data) {
    $('fill').hidden = false;
    $('fill-title').textContent = (data.e || 'Secret Santa') + ' questionnaire';
    $('fill-meta').innerHTML = headerLine(data) || 'Answer what you like and skip the rest.';
    const qs = Array.isArray(data.q) ? data.q.slice(0, 40).map(String) : [];
    const draft = GS.store.get('ssq-draft:' + location.hash.slice(0, 80), {});
    $('fill-form').innerHTML =
      `<div class="field"><label for="f-name">Your name</label><input id="f-name" type="text" maxlength="60" value="${esc(draft.name || '')}"></div>` +
      qs.map((q, i) => `<div class="field"><label for="f-${i}">${esc(q)}</label><textarea id="f-${i}" rows="2" maxlength="300">${esc((draft.a || [])[i] || '')}</textarea></div>`).join('');
    $('fill-form').addEventListener('input', () => {
      GS.store.set('ssq-draft:' + location.hash.slice(0, 80), { name: $('f-name').value, a: qs.map((_, i) => $('f-' + i).value) });
    });
    $('finish').addEventListener('click', () => {
      const name = $('f-name').value.trim();
      if (!name) { GS.toast('Add your name first'); $('f-name').focus(); return; }
      const qa = qs.map((q, i) => [q, $('f-' + i).value.trim()]).filter(([, a]) => a);
      const card = { e: data.e || '', b: data.b || '', n: name, qa };
      const url = base() + '#a=' + enc(card);
      $('done').hidden = false;
      $('answer-link').value = url;
      $('answer-preview').innerHTML = answerCard(card);
      $('done').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('copy-answer').addEventListener('click', () => GS.copy($('answer-link').value, 'Answer link copied — send it to your organizer'));
    $('share-answer').addEventListener('click', () => GS.share('My Secret Santa answers: ' + $('answer-link').value, 'My Secret Santa answers'));
    $('copy-text').addEventListener('click', () => {
      const n = $('f-name').value.trim();
      const lines = qs.map((q, i) => [q, $('f-' + i).value.trim()]).filter(([, a]) => a).map(([q, a]) => `${q}: ${a}`);
      GS.copy(`Secret Santa answers — ${n}\n` + lines.join('\n'), 'Answers copied as text');
    });
    $('print-answer').addEventListener('click', () => { $('sheet').innerHTML = $('answer-preview').innerHTML; $('sheet').className = 'card'; printOnly('sheet'); });
  }

  // ---------- anyone: view one answer card ----------
  function answerCard(c) {
    const rows = (c.qa || []).map(([q, a]) => `<dt>${esc(q)}</dt><dd>${esc(a)}</dd>`).join('');
    return `<article class="answer-card">
      <h3>${esc(c.n || 'Someone')}</h3>
      ${c.e || c.b ? `<p class="qmeta">${headerLine({ e: c.e, b: c.b })}</p>` : ''}
      ${rows ? `<dl>${rows}</dl>` : '<p class="hint">No answers yet.</p>'}
    </article>`;
  }
  function setupView(card) {
    $('view').hidden = false;
    $('view-card').innerHTML = answerCard(card);
    $('view-print').addEventListener('click', () => { $('sheet').innerHTML = answerCard(card); $('sheet').className = 'card'; printOnly('sheet'); });
  }

  // ---------- organizer: compile answer links ----------
  function compile() {
    const lines = $('answers-in').value.split(/\s+/).filter(Boolean);
    const cards = lines.map(l => parseLink(l, 'a')).filter(Boolean);
    if (!cards.length) { GS.toast('Paste at least one answer link'); return; }
    cards.sort((x, y) => String(x.n).localeCompare(String(y.n)));
    $('sheet').innerHTML = `<h2 class="book-title">${esc(cards[0].e || 'Secret Santa')} — everyone's answers (${cards.length})</h2>` +
      cards.map(answerCard).join('');
    $('sheet').className = 'card book';
    $('sheet').hidden = false;
    $('compile-msg').textContent = `${cards.length} of ${lines.length} links read.`;
    $('print-book').hidden = false;
  }

  // ---------- route ----------
  function init() {
    const h = location.hash;
    const q = h.startsWith('#q=') ? dec(h.slice(3)) : null;
    const a = h.startsWith('#a=') ? dec(h.slice(3)) : null;
    if (q && Array.isArray(q.q)) { document.body.classList.add('mode-fill'); setupFill(q); }
    else if (a && a.n !== undefined) { document.body.classList.add('mode-view'); setupView(a); }
    else {
      if (h.startsWith('#q=') || h.startsWith('#a=')) GS.toast('That link looks broken — showing the maker instead');
      setupOrganizer();
    }
    $('print-book').addEventListener('click', () => printOnly('sheet'));
  }
  window.addEventListener('hashchange', () => location.reload());
  // Keep the on-screen page tidy after printing a single sheet; the group booklet stays as a preview.
  window.addEventListener('afterprint', () => { if (!$('sheet').classList.contains('book')) $('sheet').hidden = true; });
  init();
})();
