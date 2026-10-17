"""Review page template for the naming study (used by prepare_naming_r1.py --page)."""
from html import escape
from shapely import affinity

_path_d = None

def inline(g, cls="", label=""):
    x0, y0, x1, y1 = g.bounds
    g = affinity.translate(g, -x0, -y0)
    path_d = _path_d
    return (f'<svg class="{cls}" viewBox="0 0 {x1 - x0:.3f} {y1 - y0:.3f}" xmlns="http://www.w3.org/2000/svg" '
            f'role="img" aria-label="{escape(label)}"><path d="{path_d(g, 3)}" fill="currentColor" fill-rule="evenodd"/></svg>')

CSS = """
/* Layout: a type specimen sheet — names as large wordmarks, then marks on paper and on a navy board, then the family. */
:root {
  --paper: #f3f2ec; --bg: #f3f2ec; --card: #fbfaf6; --ink: #1d2a24; --muted: #5f6a63; --rule: #d9d8cf;
  --navy: #1c2f57; --silk: #eef0ea; --accent: #c2410c;
  --display: "Archivo", "Helvetica Neue", Arial, sans-serif;
  --body: "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg: #141816; --card: #1b201d; --ink: #e7ebe6; --muted: #9aa69e; --rule: #2a312d; --accent: #f08a4b; color-scheme: dark; }
}
:root[data-theme="dark"] { --bg: #141816; --card: #1b201d; --ink: #e7ebe6; --muted: #9aa69e; --rule: #2a312d; --accent: #f08a4b; color-scheme: dark; }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--ink); font: 400 16px/1.55 var(--body);
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 0 64px; }
.wrap { max-width: 1180px; margin: 0 auto; display: grid; gap: 56px; }
h1, h2, h3 { font-family: var(--display); margin: 0; text-wrap: balance; }
p { margin: 0; }
.eyebrow { font: 500 12px/1.3 var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
header.top { padding-top: 36px; display: grid; gap: 14px; }
header.top h1 { font-size: clamp(30px, 5vw, 52px); font-weight: 800; line-height: 1.05; max-width: 18ch; }
.lede { color: var(--muted); max-width: 68ch; }
section { display: grid; gap: 20px; }
section > h2 { font-size: clamp(22px, 2.8vw, 30px); font-weight: 800; }
section > .lede { margin-top: -8px; }
.names { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
.name { background: var(--card); border: 1px solid var(--rule); border-radius: 8px; padding: 20px; display: grid; gap: 12px; align-content: start; min-width: 0; }
.name.rec { border-color: var(--accent); }
.name .wm { height: 46px; width: auto; max-width: 100%; color: var(--ink); justify-self: start; }
.name .say { font: 500 13px/1 var(--mono); color: var(--muted); }
.name dl { margin: 0; display: grid; gap: 8px; font-size: 15px; }
.name dt { font: 500 11px/1.3 var(--mono); letter-spacing: .07em; text-transform: uppercase; color: var(--muted); }
.name dd { margin: 0; }
.chip { font: 500 11px/1 var(--mono); letter-spacing: .06em; text-transform: uppercase; padding: 6px 8px; border-radius: 3px; justify-self: start; }
.chip.rec { background: var(--accent); color: var(--bg); }
.chip.free { border: 1px solid var(--rule); color: var(--muted); }
.logos { display: grid; gap: 18px; }
.logo { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, .9fr); gap: 12px; align-items: stretch; }
.tile { border-radius: 8px; display: grid; place-items: center; padding: 26px 22px; min-height: 150px; }
.tile.paper { background: #f3f2ec; color: #1d2a24; border: 1px solid var(--rule); }
.tile.board { background: var(--navy); color: var(--silk); }
.tile.small { gap: 10px; }
.tile svg.lock { width: 100%; max-width: 380px; height: auto; }
.tile svg.markbig { height: 96px; width: auto; }
.tile svg.marksmall { height: 22px; width: auto; }
.tile .cap { font: 400 11px/1.3 var(--mono); opacity: .75; }
.logo h3 { font-size: 15px; font-weight: 700; grid-column: 1 / -1; display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
.logo h3 span { font: 400 13px/1.4 var(--body); color: var(--muted); }
.fam { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
.fam figure { margin: 0; background: var(--card); border: 1px solid var(--rule); border-radius: 8px; padding: 16px; display: grid; gap: 10px; color: var(--ink); }
.fam svg { width: 100%; height: auto; }
.fam figcaption { display: grid; gap: 2px; }
.fam figcaption b { font-family: var(--display); font-size: 18px; }
.fam figcaption span { font-size: 14px; color: var(--muted); }
.legend { font-size: 14px; color: var(--muted); display: flex; gap: 8px; align-items: center; }
.legend i { width: 12px; height: 12px; border-radius: 3px; background: var(--accent); display: inline-block; }
.editions { display: flex; flex-wrap: wrap; gap: 8px; }
.editions span { font: 500 13px/1 var(--mono); border: 1px solid var(--rule); border-radius: 999px; padding: 8px 12px; background: var(--card); }
.bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.seg { display: inline-flex; flex-wrap: wrap; border: 1px solid var(--rule); border-radius: 999px; padding: 2px; background: var(--card); }
.seg button { font: 500 13px/1 var(--body); color: var(--ink); background: none; border: 0; border-radius: 999px; padding: 8px 12px; cursor: pointer; }
.seg button[aria-pressed="true"] { background: var(--ink); color: var(--bg); }
.seg button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.drop { display: grid; gap: 6px; font-size: 15px; color: var(--muted); }
.drop b { color: var(--ink); }
.next { border-top: 1px solid var(--rule); padding-top: 20px; max-width: 75ch; display: grid; gap: 8px; }
@media (max-width: 860px) { .logo { grid-template-columns: minmax(0, 1fr); } }
"""

def page(data, MARKS, word, lockup, flip, path_d, family_svg):
    global _path_d
    _path_d = path_d
    cands = data["candidates"]
    rec = next(c for c in cands if c.get("recommended"))
    names_html = []
    for c in cands:
        wm = inline(flip(word(c["slug"]), 1.0), "wm", c["name"])
        chips = '<span class="chip rec">Recomendado</span>' if c.get("recommended") else ""
        names_html.append(f'''<article class="name{' rec' if c.get('recommended') else ''}">
  {chips}{wm}<span class="say">{escape(c['say'])}</span>
  <dl><div><dt>Qué significa</dt><dd>{escape(c['meaning'])}</dd></div>
  <div><dt>A favor</dt><dd>{escape(c['pros'])}</dd></div>
  <div><dt>En contra</dt><dd>{escape(c['cons'])}</dd></div></dl>
  <span class="chip free">Libre en GitHub, QMK y la web</span>
</article>''')
    logos_html = []
    labels = {"kumi-asanoha": ("Asanoha", "El hexágono kumiko completo, igual que la serigrafía."),
              "kumi-split": ("Dos mitades", "El mismo asanoha partido en dos: las dos mitades del teclado."),
              "telar-weave": ("Tejido", "Urdimbre y trama cruzadas: filas y columnas de la matriz."),
              "nopal-pair": ("Dos pencas", "Una penca por mitad; las espinas son teclas."),
              "seda-raimon": ("Raimon", "Un solo hilo doblado en greca, primo del meandro.")}
    for c in cands:
        for m in c["marks"]:
            t, d = labels[m]
            lock = inline(lockup(m, c["slug"] + " 36"), "lock", f"{c['name']} 36")
            big = inline(flip(MARKS[m](), 1.0), "markbig", t)
            small = inline(lockup(m, c["slug"]), "marksmall", c["name"])
            logos_html.append(f'''<article class="logo">
  <h3>{escape(c['name'])} · {escape(t)} <span>{escape(d)}</span></h3>
  <div class="tile paper">{lock}</div>
  <div class="tile board">{big}</div>
  <div class="tile board small">{small}<span class="cap">Escala de la firma en el PCB (≈6 mm)</span></div>
</article>''')
    fam = []
    capt = {36: "base actual, revI", 42: "+1 columna de meñique por mitad", 46: "+1 fila numérica por mitad", 54: "meñique y fila numérica"}
    for v in (36, 42, 46, 54):
        s, _, _ = family_svg(v, "currentColor", "ACCENT")
        s = s.replace('fill="ACCENT"', 'style="fill:var(--accent)"')
        fam.append(f'<figure>{s}<figcaption><b><span class="nm">{escape(rec["name"])}</span> {v}</b><span>{capt[v]}</span></figcaption></figure>')
    buttons = "".join(f'<button type="button" id="n-{c["slug"]}" data-name="{escape(c["name"])}" aria-pressed="{str(c is rec).lower()}">{escape(c["name"])}</button>' for c in cands)
    editions = "".join(f'<span><span class="nm">{escape(rec["name"])}</span> 36 · {e}</span>' for e in ("Asanoha", "Kikkō", "Sayagata", "Seigaiha", "Meandro", "Vías"))
    drops = "".join(f'<p><b>{escape(d["name"])}</b>: {escape(d["why"])}</p>' for d in data["discarded"])
    return f'''<title>Nombre y logo</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,500..800&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>{CSS}</style>
<div class="wrap">
  <header class="top">
    <span class="eyebrow">Teclado split · antes Flan36</span>
    <h1>Un nombre que crezca con el teclado</h1>
    <p class="lede">Cuatro nombres con sus logos. Todos están dibujados a mano en trazo monolínea con terminales redondos, como pistas de PCB, sin fuentes, listos para serigrafía y relieve. El número indica las teclas: así el mismo nombre cubre la versión con fila numérica y la de columna extra de meñique.</p>
  </header>

  <section>
    <h2>Nombres</h2>
    <p class="lede">Recomiendo <b>{escape(rec['name'])}</b>: dice lo que el teclado ya es, piezas que se ensamblan, y la serigrafía kumiko que elegiste.</p>
    <div class="names">{''.join(names_html)}</div>
  </section>

  <section>
    <h2>Logos</h2>
    <p class="lede">Cada opción en papel, en el azul del PCB y al tamaño de la firma del reverso.</p>
    <div class="logos">{''.join(logos_html)}</div>
  </section>

  <section>
    <h2>La familia</h2>
    <p class="lede">Con las posiciones reales de revI. En naranja, las teclas que agrega cada variante. Solo es el esquema de nombres: las placas 42, 46 y 54 aún no están diseñadas.</p>
    <div class="bar"><span class="eyebrow">Ver con</span><div class="seg" id="names">{buttons}</div></div>
    <div class="fam">{''.join(fam)}</div>
    <p class="legend"><i></i>Teclas nuevas de la variante</p>
  </section>

  <section>
    <h2>Ediciones de serigrafía</h2>
    <p class="lede">Los seis patrones que te gustaron quedan como ediciones con su propio paquete de fabricación.</p>
    <div class="editions">{editions}</div>
  </section>

  <section class="drop">
    <h2>Descartados</h2>
    {drops}
    <p class="eyebrow">Revisión de colisiones: búsqueda web, GitHub y QMK, 17 oct 2026. No es una búsqueda de marca registrada.</p>
  </section>

  <section class="next">
    <h2>Siguiente paso</h2>
    <p>Elige nombre y logo. Después renombro el proyecto, pongo el logo en la firma del reverso y genero un paquete de Gerber por cada edición de serigrafía.</p>
  </section>
</div>
<script>
(function () {{
  var seg = document.getElementById("names");
  function set(name) {{
    seg.querySelectorAll("button").forEach(function (b) {{ b.setAttribute("aria-pressed", String(b.dataset.name === name)); }});
    document.querySelectorAll(".nm").forEach(function (el) {{ el.textContent = name; }});
    try {{ localStorage.setItem("naming-r1-view", name); }} catch (e) {{}}
  }}
  seg.addEventListener("click", function (ev) {{ var b = ev.target.closest("button"); if (b) set(b.dataset.name); }});
  try {{ var s = localStorage.getItem("naming-r1-view"); if (s && seg.querySelector('[data-name="' + s + '"]')) set(s); }} catch (e) {{}}
}})();
</script>
'''
