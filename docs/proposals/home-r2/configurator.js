// Home configurator: swaps pre-rendered views of every size × theme × keycaps × case.
// Renders and their manifest come from viewer/capture-showcase.cjs. English by default; ES is remembered.
// SPDX-License-Identifier: GPL-3.0-or-later
(async function () {
  const root = document.documentElement;
  // language
  let lang = 'en';
  try { lang = localStorage.getItem('flan.lang') === 'es' ? 'es' : 'en'; } catch (e) {}
  const setLang = (l) => {
    lang = l; root.lang = l;
    for (const b of document.querySelectorAll('[data-set-lang]')) b.setAttribute('aria-pressed', String(b.dataset.setLang === l));
    try { localStorage.setItem('flan.lang', l); } catch (e) {}
    paint();
  };
  for (const b of document.querySelectorAll('[data-set-lang]')) b.addEventListener('click', () => setLang(b.dataset.setLang));

  const base = '../../images/showcase/';
  const m = await (await fetch(base + 'manifest.json')).json();
  const words = {
    size: { flan36: ['36 keys', '36 teclas'], flan42: ['42 keys', '42 teclas'], flan46: ['46 keys', '46 teclas'], flan54: ['54 keys', '54 teclas'] },
    sizeNote: { flan36: ['3 × 5 + 3', '3 × 5 + 3'], flan42: ['+ outer column', '+ columna exterior'], flan46: ['+ number row', '+ fila de números'], flan54: ['+ both', '+ ambas'] },
    // product names, as in the viewer
    keycaps: { original: ['Original', 'Original'], normal: ['Sculpted', 'Sculpted'], saddle: ['Saddle', 'Saddle'] },
    case: { rim: ['Color rim', 'Color rim'], solid: ['Solid', 'Solid'], terrace: ['Terrace', 'Terrace'], level: ['Level', 'Level'] },
  };
  const t = (pair) => pair[lang === 'es' ? 1 : 0];
  let state = { ...m.default };
  try { const saved = JSON.parse(sessionStorage.getItem('flan.look') || 'null'); if (saved && m.images[key(saved)]) state = saved; } catch (e) {}
  function key(s) { return `${s.size}/${s.theme}/${s.keycaps}/${s.case}`; }
  const url = (s) => base + m.images[key(s)];

  // stage: two stacked images cross-fade, so a swap never flashes empty
  const stage = document.querySelector('[data-stage]');
  const imgs = [new Image(), new Image()].map((img, i) => { img.alt = ''; img.className = 'frame' + (i ? '' : ' on'); stage.append(img); return img; });
  let front = 0, seq = 0;
  function show() {
    // only the latest request swaps, and only once: a cached image may report complete and still fire load
    const token = ++seq, next = imgs[1 - front], src = url(state);
    const done = () => { if (token !== seq) return; seq++; next.classList.add('on'); imgs[front].classList.remove('on'); front = 1 - front; };
    next.onload = done;
    next.src = src;
    if (next.complete && next.naturalWidth) done();
    try { sessionStorage.setItem('flan.look', JSON.stringify(state)); } catch (e) {}
    prefetch();
  }
  // warm the neighbours of the current look: one change away on any control
  function prefetch() {
    const options = { size: m.sizes, theme: m.themes.map((x) => x.id), keycaps: m.keycaps, case: m.cases };
    for (const [k, list] of Object.entries(options)) for (const v of list) if (v !== state[k]) { const img = new Image(); img.src = url({ ...state, [k]: v }); }
  }

  // controls
  function group(name, list, label) {
    const box = document.querySelector(`[data-control="${name}"]`);
    box.replaceChildren(...list.map((v) => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.value = v.id || v;
      b.addEventListener('click', () => { state = { ...state, [name]: b.dataset.value }; paint(); show(); });
      label(b, v); return b;
    }));
  }
  function paint() {
    group('size', m.sizes, (b, v) => { b.innerHTML = `<strong>${v.replace('flan', 'Flan')}</strong><span>${t(words.sizeNote[v])}</span>`; });
    group('theme', m.themes, (b, v) => { b.title = v.name; b.setAttribute('aria-label', v.name); b.innerHTML = `<i style="--a:${v.swatch[0]};--b:${v.swatch[1]};--c:${v.swatch[2]}"></i><span>${v.name}</span>`; });
    group('keycaps', m.keycaps, (b, v) => { b.textContent = t(words.keycaps[v]); });
    group('case', m.cases, (b, v) => { b.textContent = t(words.case[v]); });
    for (const box of document.querySelectorAll('[data-control]'))
      for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.value === state[box.dataset.control]));
    const theme = m.themes.find((x) => x.id === state.theme).name;
    for (const el of document.querySelectorAll('[data-caption]'))
      el.textContent = `${state.size.replace('flan', 'Flan')} · ${theme} · ${t(words.case[state.case])} · ${t(words.keycaps[state.keycaps])}`;
    // the viewer opens on this exact look
    for (const a of document.querySelectorAll('[data-explore]'))
      a.href = `../../index.html#${state.size}`;
  }
  setLang(lang);
  show();
})();
