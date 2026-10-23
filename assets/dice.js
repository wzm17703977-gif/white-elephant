/* White elephant dice game: fair die, editable moves, round timer. */
(function () {
  const $ = id => document.getElementById(id);
  const DEFAULT_MOVES = [
    'Open your gift (or take one from the pile)',
    'Swap gifts with the person on your left',
    'Swap gifts with the person on your right',
    'Steal any gift you like',
    'Swap with someone across the room',
    'Pass — keep what you have'
  ];
  // Pip positions on a 3x3 grid (0..8) for faces 1..6.
  const FACES = [[4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];

  let moves = GS.store.get('dice-moves', DEFAULT_MOVES);
  if (!Array.isArray(moves) || moves.length !== 6) moves = DEFAULT_MOVES.slice();
  let editing = false;
  let last = 0;
  let mode = GS.store.get('dice-mode', 'one') === 'two' ? 'two' : 'one';
  let rolling = false;

  function drawFace(n, id) {
    const die = $(id || 'die');
    die.querySelectorAll('.pip').forEach((p, i) => p.classList.toggle('on', FACES[n - 1].includes(i)));
    die.setAttribute('aria-label', 'Die showing ' + n + '. Tap to roll again.');
  }

  function setMode(m) {
    mode = m;
    const two = m === 'two';
    $('mode-one').setAttribute('aria-selected', String(!two));
    $('mode-two').setAttribute('aria-selected', String(two));
    $('die2').hidden = !two;
    $('die').closest('.dice-pair').classList.toggle('two', two);
    $('one-rules').hidden = two;
    $('two-rules').hidden = !two;
    $('outcome').classList.remove('doubles');
    $('outcome').textContent = two ? 'Roll doubles to take or steal a gift' : 'Tap the die to roll';
    $('roll').textContent = two ? 'Roll both dice' : 'Roll';
    GS.store.set('dice-mode', m);
  }

  // Two dice: act only on doubles. Each die is rolled on its own, so doubles come up 1 time in 6.
  function rollTwo() {
    if (rolling) return;
    rolling = true;
    ['die', 'die2'].forEach(id => { const d = $(id); d.classList.remove('rolling'); void d.offsetWidth; d.classList.add('rolling'); });
    let ticks = 0;
    const spin = setInterval(() => {
      drawFace(GS.randInt(6) + 1, 'die');
      drawFace(GS.randInt(6) + 1, 'die2');
      if (++ticks >= 6) {
        clearInterval(spin);
        const a = GS.randInt(6) + 1, b = GS.randInt(6) + 1;
        drawFace(a, 'die');
        drawFace(b, 'die2');
        const out = $('outcome');
        out.classList.toggle('doubles', a === b);
        out.textContent = a === b
          ? 'Doubles! Take a gift from the pile, or steal one if the pile is empty.'
          : a + ' and ' + b + ': no doubles. Pass the dice.';
        if (navigator.vibrate) navigator.vibrate(a === b ? [60, 60, 60] : 30);
        rolling = false;
      }
    }, 80);
  }

  function renderRules() {
    $('rules').innerHTML = moves.map((m, i) => {
      const cell = editing
        ? `<input type="text" data-i="${i}" value="${GS.escape(m)}" aria-label="Move for ${i + 1}">`
        : GS.escape(m);
      return `<tr class="${last === i + 1 ? 'hit' : ''}"><td>${i + 1}</td><td>${cell}</td></tr>`;
    }).join('');
    $('edit').textContent = editing ? 'Save moves' : 'Edit moves';
  }

  function roll() {
    if (mode === 'two') { rollTwo(); return; }
    if (editing) toggleEdit();
    const die = $('die');
    die.classList.remove('rolling');
    void die.offsetWidth; // restart the animation
    die.classList.add('rolling');
    let ticks = 0;
    const spin = setInterval(() => {
      drawFace(GS.randInt(6) + 1);
      if (++ticks >= 6) {
        clearInterval(spin);
        last = GS.randInt(6) + 1;
        drawFace(last);
        $('outcome').textContent = last + ' — ' + moves[last - 1];
        renderRules();
        if (navigator.vibrate) navigator.vibrate(30);
      }
    }, 80);
  }

  function toggleEdit() {
    if (editing) {
      $('rules').querySelectorAll('input').forEach(inp => {
        const v = inp.value.trim();
        moves[+inp.dataset.i] = v || DEFAULT_MOVES[+inp.dataset.i];
      });
      GS.store.set('dice-moves', moves);
      GS.toast('Moves saved');
    }
    editing = !editing;
    renderRules();
  }

  ['die', 'die2'].forEach(id => {
    $(id).addEventListener('click', roll);
    $(id).addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); roll(); } });
  });
  $('roll').addEventListener('click', roll);
  $('mode-one').addEventListener('click', () => setMode('one'));
  $('mode-two').addEventListener('click', () => setMode('two'));
  $('edit').addEventListener('click', toggleEdit);
  $('reset').addEventListener('click', () => {
    moves = DEFAULT_MOVES.slice();
    editing = false;
    GS.store.set('dice-moves', moves);
    renderRules();
    GS.toast('Default moves restored');
  });

  // Round timer.
  let remaining = 0, running = false, endAt = 0, handle = null;
  const fmt = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  function minutes() {
    const m = parseInt($('minutes').value, 10);
    return m >= 1 && m <= 120 ? m : 10;
  }
  function paint() {
    $('timer').textContent = fmt(remaining);
    $('timer').classList.toggle('low', remaining <= 30 && remaining > 0);
  }
  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, .35, .7].forEach(t => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(.2, ctx.currentTime + t);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + .2);
      });
    } catch (e) { /* no audio */ }
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
  }
  function tick() {
    remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    paint();
    if (remaining === 0) {
      clearInterval(handle); running = false;
      $('t-start').textContent = 'Start';
      $('outcome').textContent = 'Time’s up! Unwrap what you’re holding.';
      beep();
    }
  }
  $('t-start').addEventListener('click', () => {
    if (running) {
      clearInterval(handle); running = false;
      $('t-start').textContent = 'Resume';
    } else {
      if (remaining === 0) remaining = minutes() * 60;
      endAt = Date.now() + remaining * 1000;
      handle = setInterval(tick, 250); running = true;
      $('t-start').textContent = 'Pause';
    }
  });
  $('t-reset').addEventListener('click', () => {
    clearInterval(handle); running = false;
    remaining = minutes() * 60; paint();
    $('t-start').textContent = 'Start';
  });
  $('minutes').addEventListener('change', () => {
    if (!running) { remaining = minutes() * 60; paint(); }
    GS.store.set('dice-minutes', minutes());
  });

  $('minutes').value = GS.store.get('dice-minutes', 10);
  remaining = minutes() * 60;
  paint();
  drawFace(5);
  drawFace(2, 'die2');
  renderRules();
  setMode(mode);
})();
