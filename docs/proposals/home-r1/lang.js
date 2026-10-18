// English by default; ES switches every [lang] pair and is remembered on this device.
// SPDX-License-Identifier: GPL-3.0-or-later
(function () {
  const root = document.documentElement;
  let saved = null;
  try { saved = localStorage.getItem('flan.lang'); } catch (e) {}
  const set = (lang) => {
    root.lang = lang;
    for (const b of document.querySelectorAll('[data-set-lang]')) b.setAttribute('aria-pressed', String(b.dataset.setLang === lang));
    try { localStorage.setItem('flan.lang', lang); } catch (e) {}
  };
  set(saved === 'es' ? 'es' : 'en');
  for (const b of document.querySelectorAll('[data-set-lang]')) b.addEventListener('click', () => set(b.dataset.setLang));
})();
