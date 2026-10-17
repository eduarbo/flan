#!/usr/bin/env python3
"""Naming study R2: fine-line marks, typeset lockups and the review page.

Marks are exact geometry (tools/branding/fine.py) in two constructions: display (hairlines)
and small (heavier, sparser, for silkscreen or relief at 6–10 mm). Wordmarks are set in OFL
typefaces loaded by the review page; final production outlines are made from the chosen face.
Writes SVG masters of the marks to design/proposals/naming-r2/ and, with --page, the page.
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import argparse, json, sys
from html import escape

from shapely import affinity
from shapely.geometry import box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from branding import fine                         # noqa: E402
from prepare_naming_r1 import family              # noqa: E402

OUT = ROOT / "design/proposals/naming-r2"
DATA = json.loads((ROOT / "design/naming-r2.json").read_text())

def stroked(layers, cls="mark", label=""):
    body = "".join(f'<path d="{fine.path(g)}" fill="none" stroke="currentColor" stroke-width="{w}" '
                   f'stroke-linecap="round" stroke-linejoin="round"/>' for g, w in layers)
    return f'<svg class="{cls}" viewBox="0 0 100 100" role="img" aria-label="{escape(label)}">{body}</svg>'

def filled_d(layers):
    g = fine.solid(layers)
    return " ".join("M" + " L".join(f"{x:.2f},{y:.2f}" for x, y in r.coords) + "Z"
                    for p in getattr(g, "geoms", [g]) for r in [p.exterior] + list(p.interiors))

def filled(layers, cls="mark", label=""):
    return (f'<svg class="{cls}" viewBox="0 0 100 100" role="img" aria-label="{escape(label)}">'
            f'<path d="{filled_d(layers)}" fill="currentColor" fill-rule="evenodd"/></svg>')

def master(layers, title, size_mm, small):
    """Black closed outlines in millimetres: strokes are expanded so the file needs no renderer."""
    d = filled_d(layers) if small else filled_d([(g, w) for g, w in layers])
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size_mm}mm" height="{size_mm}mm" viewBox="0 0 100 100">\n'
            f'<title>{escape(title)}</title>\n<path d="{d}" fill="#000" fill-rule="evenodd"/>\n</svg>\n')

def family_svg(variant):
    keys, new = [], []
    for x, y, r, added in family(variant):
        k = affinity.rotate(box(x - 6.5, y - 6.0, x + 6.5, y + 6.0).buffer(1.3, quad_segs=6), -r, origin=(x, y))
        (new if added else keys).append(k)
    allg = unary_union(keys + new)
    x0, y0, x1, y1 = allg.bounds
    t = lambda g: affinity.translate(g, -x0 + 2, -y0 + 2)
    def d(gs):
        return " ".join("M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in t(g).exterior.coords) + "Z" for g in gs)
    w, h = x1 - x0 + 4, y1 - y0 + 4
    return (f'<svg viewBox="0 0 {w:.0f} {h:.0f}" role="img" aria-label="{variant} teclas">'
            f'<path d="{d(keys)}" fill="none" stroke="currentColor" stroke-width="1.1"/>'
            + (f'<path d="{d(new)}" class="added"/>' if new else "") + '</svg>')

CSS = """
/* Layout: a printed identity book — each name gets a plate: hero lockup, then its uses. */
:root {
  --bg: #f6f5f1; --card: #fbfaf7; --ink: #15171a; --muted: #686c70; --rule: #e2e0da; --accent: #24406e;
  --paper: #f6f5f1; --night: #121416; --board: #1c2f57; --silk: #eef0ea;
  --head: "Shippori Mincho", "Iowan Old Style", Georgia, serif;
  --body: "Zen Kaku Gothic New", "Helvetica Neue", Arial, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #101214; --card: #171a1d; --ink: #ebeae6; --muted: #9ea3a6; --rule: #272c30; --accent: #93acdb; color-scheme: dark; } }
:root[data-theme="dark"] { --bg: #101214; --card: #171a1d; --ink: #ebeae6; --muted: #9ea3a6; --rule: #272c30; --accent: #93acdb; color-scheme: dark; }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--ink); font: 400 16px/1.7 var(--body);
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 0 80px; }
.wrap { max-width: 1120px; margin: 0 auto; display: grid; gap: 88px; }
h1, h2, h3 { font-family: var(--head); font-weight: 500; margin: 0; text-wrap: balance; letter-spacing: .01em; }
p { margin: 0; }
.eyebrow { font: 500 11px/1.4 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
header.top { padding-top: 56px; display: grid; gap: 18px; max-width: 760px; }
header.top h1 { font-size: clamp(34px, 5.2vw, 56px); line-height: 1.12; }
.lede { color: var(--muted); max-width: 64ch; }
.plate { display: grid; gap: 28px; border-top: 1px solid var(--rule); padding-top: 28px; }
.plate > header { display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; }
.plate > header .num { font: 500 12px/1 var(--mono); color: var(--muted); letter-spacing: .1em; }
.plate > header h2 { font-size: 26px; }
.plate > header .say { font: 400 13px/1 var(--mono); color: var(--muted); }
.chip { font: 500 10.5px/1 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--accent); border: 1px solid currentColor; padding: 6px 9px; border-radius: 2px; }
.hero { background: var(--paper); color: #15171a; border-radius: 4px; min-height: 300px; display: grid; place-items: center; padding: 56px 24px; }
.lock { display: flex; align-items: center; gap: clamp(20px, 3.5vw, 44px); flex-wrap: wrap; justify-content: center; }
.lock .mark { width: clamp(110px, 16vw, 168px); height: auto; }
.wm { line-height: 1; white-space: nowrap; }
.wm .n { margin-left: .32em; opacity: .45; font-variant-numeric: lining-nums; }
.f-kumi { font-family: "Zen Kaku Gothic New", sans-serif; font-weight: 400; text-transform: uppercase; letter-spacing: .42em; font-size: clamp(40px, 6vw, 64px); padding-left: .42em; }
.f-kumi .n { font-weight: 300; margin-left: .3em; }
.f-seda { font-family: "Cormorant Garamond", serif; font-weight: 500; font-size: clamp(64px, 9.6vw, 104px); letter-spacing: .01em; }
.f-telar { font-family: "Fraunces", serif; font-weight: 300; font-variation-settings: "SOFT" 100, "opsz" 144; font-size: clamp(56px, 8.6vw, 92px); letter-spacing: -.005em; }
.meaning { max-width: 62ch; font-size: 17px; }
.meaning b { font-family: var(--head); font-weight: 500; }
.uses { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.use { margin: 0; border-radius: 4px; min-height: 220px; display: grid; grid-template-rows: 1fr auto; padding: 20px; gap: 12px; }
.use .stage { display: grid; place-items: center; }
.use figcaption { font: 400 11.5px/1.4 var(--mono); letter-spacing: .04em; opacity: .7; }
.use.night { background: var(--night); color: #ebeae6; }
.use.board { background: var(--board); color: var(--silk); }
.use.paper { background: var(--card); border: 1px solid var(--rule); color: var(--ink); }
.stack { display: grid; justify-items: center; gap: 16px; }
.stack .mark { width: 84px; height: auto; }
.stack .wm { font-size: 30px; }
.stack .f-seda { font-size: 46px; } .stack .f-telar { font-size: 42px; }
.pcb { display: flex; align-items: center; gap: 10px; }
.pcb .mark { width: 34px; height: auto; }
.pcb .wm { font-size: 17px; }
.pcb .f-seda { font-size: 26px; } .pcb .f-telar { font-size: 24px; }
.fam-list { display: grid; gap: 6px; justify-items: start; }
.fam-list .wm { font-size: 26px; }
.fam-list .f-kumi { font-size: 19px; }
.fam-list span.k { font: 400 12px/1 var(--mono); color: var(--muted); margin-left: 10px; letter-spacing: .04em; }
.alt { display: flex; gap: 18px; align-items: center; color: var(--muted); font-size: 15px; }
.alt .mark { width: 56px; height: auto; color: var(--ink); }
section.block { display: grid; gap: 22px; }
section.block > h2 { font-size: clamp(24px, 3vw, 32px); }
.bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.seg { display: inline-flex; border: 1px solid var(--rule); border-radius: 999px; padding: 2px; background: var(--card); }
.seg button { font: 500 13px/1 var(--body); color: var(--ink); background: none; border: 0; border-radius: 999px; padding: 8px 14px; cursor: pointer; }
.seg button[aria-pressed="true"] { background: var(--ink); color: var(--bg); }
.seg button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.fam { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.fam figure { margin: 0; background: var(--card); border: 1px solid var(--rule); border-radius: 4px; padding: 22px; display: grid; gap: 14px; }
.fam svg { width: 100%; height: auto; color: var(--ink); }
.fam svg .added { fill: var(--accent); }
.fam figcaption { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: baseline; }
.fam figcaption b { font-family: var(--head); font-weight: 500; font-size: 19px; }
.fam figcaption span { font-size: 14px; color: var(--muted); }
.editions { display: flex; flex-wrap: wrap; gap: 8px; }
.editions > span { font: 400 13px/1 var(--body); border: 1px solid var(--rule); border-radius: 2px; padding: 9px 12px; background: var(--card); }
.quiet { display: grid; gap: 6px; color: var(--muted); font-size: 15px; max-width: 70ch; }
.quiet b { color: var(--ink); font-weight: 500; }
.quiet h2 { color: var(--ink); }
@media (max-width: 860px) { .uses, .fam { grid-template-columns: minmax(0, 1fr); } }
"""

FONTS = ('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Fraunces:opsz,wght,SOFT@9..144,300,100'
         '&family=IBM+Plex+Mono:wght@400;500&family=Shippori+Mincho:wght@500&family=Zen+Kaku+Gothic+New:wght@300;400;500&display=swap')

def wordmark(c, number=None):
    num = f'<span class="n">{number}</span>' if number else ""
    return f'<span class="wm f-{c["slug"]}">{escape(c["display"])}{num}</span>'

def plate(i, c):
    disp = fine.MARKS[c["mark"]]()
    small = fine.SMALL[c["mark"]]()
    chip = '<span class="chip">Recomendado</span>' if c.get("recommended") else ""
    alt = ""
    if c.get("alt_mark"):
        alt = f'<div class="alt">{stroked(fine.MARKS[c["alt_mark"]](), "mark", "variante")}<span>{escape(c["alt_note"])}</span></div>'
    fam = "".join(f'<div>{wordmark(c, n)}<span class="k">{escape(k)}</span></div>' for n, k in
                  (("36", "base"), ("42", "+ meñique"), ("46", "+ fila numérica"), ("54", "ambas")))
    return f'''<article class="plate" id="{c['slug']}">
  <header><span class="num">0{i}</span><h2>{escape(c['name'])}</h2><span class="say">{escape(c['say'])}</span>{chip}</header>
  <div class="hero"><div class="lock">{stroked(disp, "mark", c["name"])}{wordmark(c)}</div></div>
  <p class="meaning">{c['meaning']}</p>
  <div class="uses">
    <figure class="use night"><div class="stage"><div class="stack">{stroked(disp, "mark", c["name"])}{wordmark(c)}</div></div><figcaption>Apilado, sobre negro</figcaption></figure>
    <figure class="use board"><div class="stage"><div class="pcb">{filled(small, "mark", c["name"])}{wordmark(c)}</div></div><figcaption>Firma del PCB · 6 mm</figcaption></figure>
    <figure class="use paper"><div class="stage"><div class="fam-list">{fam}</div></div><figcaption>La familia</figcaption></figure>
  </div>
  {alt}
</article>'''

def page():
    cands = DATA["candidates"]
    rec = next(c for c in cands if c.get("recommended"))
    plates = "".join(plate(i + 1, c) for i, c in enumerate(cands))
    capt = {36: "base, revI actual", 42: "+ una columna de meñique por mitad", 46: "+ una fila numérica por mitad", 54: "meñique y fila numérica"}
    fam = "".join(f'<figure>{family_svg(v)}<figcaption><b><span class="nm">{escape(rec["name"])}</span> {v}</b><span>{capt[v]}</span></figcaption></figure>' for v in (36, 42, 46, 54))
    buttons = "".join(f'<button type="button" id="n-{c["slug"]}" data-name="{escape(c["name"])}" aria-pressed="{str(c is rec).lower()}">{escape(c["name"])}</button>' for c in cands)
    editions = "".join(f'<span><span class="nm">{escape(rec["name"])}</span> 36 · {e}</span>' for e in DATA["editions"])
    drops = "".join(f'<p><b>{escape(d["name"])}</b> — {escape(d["why"])}</p>' for d in DATA["discarded"])
    return f'''<title>Nombre e identidad</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<style>{CSS}</style>
<div class="wrap">
  <header class="top">
    <span class="eyebrow">Teclado split inalámbrico · antes Flan36</span>
    <h1>Nombre e identidad</h1>
    <p class="lede">Tres nombres, cada uno con su símbolo y su tipografía. Los símbolos son geometría exacta en dos construcciones: líneas finas para la marca y una versión más robusta para la serigrafía y el relieve. El número dice cuántas teclas tiene cada variante, así el mismo nombre crece con la fila numérica y la columna extra de meñique.</p>
  </header>
  {plates}
  <section class="block">
    <h2>La familia</h2>
    <p class="lede">Sobre las posiciones reales de revI; en azul, lo que agrega cada variante. Por ahora es solo el esquema de nombres: las placas 42, 46 y 54 no están diseñadas.</p>
    <div class="bar"><span class="eyebrow">Con el nombre</span><div class="seg" id="names">{buttons}</div></div>
    <div class="fam">{fam}</div>
  </section>
  <section class="block">
    <h2>Ediciones de serigrafía</h2>
    <p class="lede">Los patrones que elegiste se vuelven ediciones, cada una con su paquete de fabricación.</p>
    <div class="editions">{editions}</div>
  </section>
  <section class="block quiet">
    <h2>Descartados</h2>
    {drops}
    <p class="eyebrow">Colisiones revisadas en la web, GitHub y QMK el 17 oct 2026 · no es búsqueda de marca registrada</p>
  </section>
  <section class="block quiet">
    <h2>Siguiente paso</h2>
    <p>Elige nombre y símbolo. Después renombro el proyecto, convierto el logotipo elegido a contornos para la firma del PCB y el case, y genero un paquete de Gerber por edición.</p>
  </section>
</div>
<script>
(function () {{
  var seg = document.getElementById("names");
  function set(name) {{
    seg.querySelectorAll("button").forEach(function (b) {{ b.setAttribute("aria-pressed", String(b.dataset.name === name)); }});
    document.querySelectorAll(".nm").forEach(function (el) {{ el.textContent = name; }});
    try {{ localStorage.setItem("naming-r2-view", name); }} catch (e) {{}}
  }}
  seg.addEventListener("click", function (ev) {{ var b = ev.target.closest("button"); if (b) set(b.dataset.name); }});
  try {{ var s = localStorage.getItem("naming-r2-view"); if (s && seg.querySelector('[data-name="' + s + '"]')) set(s); }} catch (e) {{}}
}})();
</script>
'''

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--page", type=Path)
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    own = [c["mark"] for c in DATA["candidates"]] + [c["alt_mark"] for c in DATA["candidates"] if c.get("alt_mark")]
    for key in own:                       # only R2's marks; later rounds add their own
        (OUT / f"{key}.svg").write_text(master(fine.MARKS[key](), f"{key} mark (display)", 40, False))
        (OUT / f"{key}-small.svg").write_text(master(fine.SMALL[key](), f"{key} mark (6–10 mm)", 8, True))
    print("wrote", len(list(OUT.glob("*.svg"))), "marks to", OUT.relative_to(ROOT))
    if a.page:
        a.page.write_text(page())
        print("wrote page", a.page)

if __name__ == "__main__":
    main()
