/* Shared helpers for the printable sheets. Needs app.js (GS) first. */
(function () {
  const FACES = [[4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];

  // A die face drawn with spans so it prints without images.
  GS.face = function (n) {
    return '<span class="face" role="img" aria-label="Die showing ' + n + '">' +
      Array.from({ length: 9 }, (_, i) => '<i class="' + (FACES[n - 1].includes(i) ? 'on' : '') + '"></i>').join('') + '</span>';
  };

  // The last visible sheet must not force a page break, or printers add a blank page.
  GS.markLastSheet = function () {
    const shown = [...document.querySelectorAll('.sheet')].filter(s => !s.hidden);
    document.querySelectorAll('.sheet').forEach(s => { s.style.breakAfter = ''; });
    if (shown.length) shown[shown.length - 1].style.breakAfter = 'auto';
  };

  // Copy form fields into the sheet: <input data-to="id"> fills the element with that id.
  GS.bindFields = function (key, ids) {
    const saved = GS.store.get(key, {});
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (saved[id] != null) el.value = saved[id];
      el.addEventListener('input', () => GS.syncFields(key, ids));
    });
    GS.syncFields(key, ids);
  };
  GS.syncFields = function (key, ids) {
    const out = {};
    ids.forEach(id => {
      const el = document.getElementById(id);
      out[id] = el.value;
      document.querySelectorAll('[data-from="' + id + '"]').forEach(t => {
        let v = el.value.trim();
        if (el.type === 'date' && v) {
          const d = new Date(v + 'T12:00:00');
          if (!isNaN(d)) v = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        }
        t.textContent = v;
      });
    });
    GS.store.set(key, out);
  };
})();
