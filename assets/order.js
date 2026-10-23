/* White elephant turn-order generator (home page). */
(function () {
  const $ = id => document.getElementById(id);
  const tabs = { count: $('tab-count'), names: $('tab-names') };
  const panes = { count: $('pane-count'), names: $('pane-names') };
  let mode = 'count';
  let order = []; // [{n, name}]
  let revealAt = 0;

  function setMode(m) {
    mode = m;
    for (const k of Object.keys(tabs)) {
      tabs[k].setAttribute('aria-selected', String(k === m));
      panes[k].hidden = k !== m;
    }
    GS.store.set('order-mode', m);
  }
  tabs.count.addEventListener('click', () => setMode('count'));
  tabs.names.addEventListener('click', () => setMode('names'));

  function render() {
    const box = $('result');
    if (!order.length) { box.innerHTML = ''; $('result-actions').hidden = true; $('reveal').hidden = true; return; }
    $('reveal').hidden = false;
    $('print-link').href = 'printable-numbers/?n=' + order.length;
    if (order.hat) {
      // Head-count mode: numbers stay hidden in the "hat" until each person draws.
      box.innerHTML = '<p class="notice">' + order.length + ' numbers are in the hat. Tap <strong>Draw numbers</strong> and pass the phone around: each person taps once to see their number.</p>';
      $('reveal').textContent = 'Draw numbers';
      $('result-actions').hidden = true;
      return;
    }
    $('reveal').textContent = 'Reveal on big screen';
    box.innerHTML = '<ol class="order">' + order.map(o =>
      `<li><span class="num">${o.n}</span><span class="who">${GS.escape(o.name)}</span></li>`
    ).join('') + '</ol>';
    $('result-actions').hidden = false;
  }

  function showError(msg) {
    $('result').innerHTML = `<p class="notice error">${GS.escape(msg)}</p>`;
    $('result-actions').hidden = true;
    $('reveal').hidden = true;
  }

  $('go').addEventListener('click', () => {
    if (mode === 'count') {
      const n = parseInt($('count').value, 10);
      if (!(n >= 2 && n <= 500)) return showError('Enter a number of players between 2 and 500.');
      order = GS.shuffle(Array.from({ length: n }, (_, i) => i + 1)).map(d => ({ n: d, name: '' }));
      order.hat = true;
      GS.store.set('order-count', n);
    } else {
      const names = GS.parseNames($('names').value);
      if (names.length < 2) return showError('Add at least two names, one per line.');
      order = GS.shuffle(names).map((name, i) => ({ n: i + 1, name }));
      GS.store.set('order-names', $('names').value);
    }
    GS.store.set('order-last', { hat: !!order.hat, items: order.slice() });
    render();
  });

  function listText() {
    return 'White elephant order:\n' + order.map(o => `${o.n}. ${o.name}`).join('\n');
  }
  $('copy').addEventListener('click', () => GS.copy(listText(), 'Order copied'));
  $('share').addEventListener('click', () => GS.share(listText(), 'White elephant order'));

  // Big-screen reveal: one number at a time.
  const stage = $('stage');
  function stageShow() {
    const hat = !!order.hat;
    if (revealAt === 0) {
      $('stage-label').textContent = hat ? 'Pass the phone' : 'Turn order';
      $('stage-num').textContent = '?';
      $('stage-name').textContent = hat ? 'First person: tap to draw' : 'Tap to reveal';
      $('stage-next').textContent = hat ? 'Draw my number' : 'Reveal #1';
      return;
    }
    const o = order[revealAt - 1];
    const left = order.length - revealAt;
    if (hat) {
      $('stage-label').textContent = 'Person ' + revealAt + ', your number is';
      $('stage-num').textContent = o.n;
      $('stage-name').textContent = left ? left + ' left in the hat' : 'Hat is empty — let the swapping begin!';
      $('stage-next').textContent = left ? 'Next person: draw' : 'Start over';
    } else {
      $('stage-label').textContent = left ? 'Pick' : 'Last pick';
      $('stage-num').textContent = o.n;
      $('stage-name').textContent = o.name;
      $('stage-next').textContent = left ? 'Reveal #' + (revealAt + 1) : 'Start over';
    }
  }
  $('reveal').addEventListener('click', () => {
    revealAt = 0;
    stage.classList.add('open');
    stageShow();
    $('stage-next').focus();
  });
  $('stage-next').addEventListener('click', () => {
    revealAt = revealAt < order.length ? revealAt + 1 : 0;
    stageShow();
  });
  function closeStage() { stage.classList.remove('open'); $('reveal').focus(); }
  $('stage-close').addEventListener('click', closeStage);
  document.addEventListener('keydown', e => {
    if (!stage.classList.contains('open')) return;
    if (e.key === 'Escape') closeStage();
    if (e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); $('stage-next').click(); }
  });

  // Restore last session from this browser only.
  setMode(GS.store.get('order-mode', 'count'));
  $('count').value = GS.store.get('order-count', 12);
  $('names').value = GS.store.get('order-names', '');
  const last = GS.store.get('order-last', null);
  if (last && Array.isArray(last.items)) { order = last.items; order.hat = !!last.hat; }
  render();
})();
