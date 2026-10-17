#!/usr/bin/env python3
"""Naming study R4: the Flan identity, tecla-flan mark variants.

Marks come from tools/branding/flankey.py as filled geometry, each in a display and a small
(6–10 mm silkscreen) construction. Writes millimetre SVG masters to design/proposals/naming-r4/
and, with --page, the review page.
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import argparse, json, math, sys
from html import escape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from branding.flankey import VARIANTS        # noqa: E402

OUT = ROOT / "design/proposals/naming-r4"
TYPES = [("a", "Suave", "Fraunces 300, SOFT 100"), ("b", "Firme", "Fraunces 500, SOFT 100"),
         ("c", "Itálica", "Cormorant Garamond 500 itálica"), ("d", "Geométrica", "Jost 400")]
FONTS = ("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,500&family=Fraunces:opsz,wght,SOFT@9..144,300..500,100"
         "&family=IBM+Plex+Mono:wght@400;500&family=Jost:wght@400&family=Shippori+Mincho:wght@500"
         "&family=Zen+Kaku+Gothic+New:wght@400;500&display=swap")

def path_d(g):
    return " ".join("M" + " L".join(f"{x:.2f},{y:.2f}" for x, y in r.coords) + "Z"
                    for p in getattr(g, "geoms", [g]) if p.geom_type == "Polygon" for r in [p.exterior] + list(p.interiors))

def svg(g, cls, label, pad=1.5):
    x0, y0, x1, y1 = g.bounds
    w, h = x1 - x0 + 2 * pad, y1 - y0 + 2 * pad
    em = math.sqrt(1.74 / (w / h))          # equal optical area next to the wordmark
    return (f'<svg class="{cls}" style="--h:{em:.3f}" viewBox="{x0 - pad:.2f} {y0 - pad:.2f} {w:.2f} {h:.2f}" '
            f'role="img" aria-label="{escape(label)}"><path d="{path_d(g)}" fill="currentColor" fill-rule="evenodd"/></svg>')

def master(g, title, width_mm):
    x0, y0, x1, y1 = g.bounds
    w, h = x1 - x0, y1 - y0
    s = width_mm / w
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w * s:.3f}mm" height="{h * s:.3f}mm" viewBox="{x0:.3f} {y0:.3f} {w:.3f} {h:.3f}">\n'
            f'<title>{escape(title)}</title>\n<path d="{path_d(g)}" fill="#000" fill-rule="evenodd"/>\n</svg>\n')

CSS = """
/* Layout: one name, one composing stage; then all six marks side by side and the family line. */
:root {
  --bg: #f6f5f1; --card: #fbfaf7; --ink: #15171a; --muted: #686c70; --rule: #e2e0da; --accent: #9a5b13;
  --paper: #f6f5f1; --night: #121416; --board: #1c2f57; --silk: #eef0ea;
  --head: "Shippori Mincho", "Iowan Old Style", Georgia, serif;
  --body: "Zen Kaku Gothic New", "Helvetica Neue", Arial, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #101214; --card: #171a1d; --ink: #ebeae6; --muted: #9ea3a6; --rule: #272c30; --accent: #e0a35a; color-scheme: dark; } }
:root[data-theme="dark"] { --bg: #101214; --card: #171a1d; --ink: #ebeae6; --muted: #9ea3a6; --rule: #272c30; --accent: #e0a35a; color-scheme: dark; }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--ink); font: 400 16px/1.7 var(--body);
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 0 80px; }
.wrap { max-width: 1160px; margin: 0 auto; display: grid; gap: 72px; }
h1, h2, h3 { font-family: var(--head); font-weight: 500; margin: 0; text-wrap: balance; }
p { margin: 0; }
.eyebrow { font: 500 11px/1.4 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
header.top { padding-top: 56px; display: grid; gap: 18px; max-width: 760px; }
header.top h1 { font-size: clamp(34px, 5.2vw, 56px); line-height: 1.12; }
.lede { color: var(--muted); max-width: 64ch; }
.controls { display: flex; flex-wrap: wrap; gap: 12px 26px; align-items: center; }
.ctl { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ctl > span { font: 500 11px/1 var(--mono); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.seg { display: inline-flex; flex-wrap: wrap; border: 1px solid var(--rule); border-radius: 999px; padding: 2px; background: var(--card); }
.seg button { font: 500 13px/1 var(--body); color: var(--ink); background: none; border: 0; border-radius: 999px; padding: 8px 14px; cursor: pointer; }
.seg button[aria-pressed="true"] { background: var(--ink); color: var(--bg); }
.seg button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.studio { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 14px; }
.side { display: grid; gap: 14px; }
.stage { border-radius: 4px; display: grid; place-items: center; padding: 40px 24px; position: relative; }
.stage.paper { background: var(--paper); color: #15171a; min-height: 400px; border: 1px solid var(--rule); }
.stage.night { background: var(--night); color: #ebeae6; min-height: 193px; }
.stage.board { background: var(--board); color: var(--silk); min-height: 193px; }
.stage .cap { position: absolute; left: 16px; bottom: 12px; font: 400 11px/1 var(--mono); letter-spacing: .04em; opacity: .7; }
.lock { display: flex; align-items: center; justify-content: center; gap: .3em; flex-wrap: nowrap; }
.lock.stacked { flex-direction: column; gap: .22em; }
.lock .mark { height: calc(var(--h) * 1em); width: auto; flex: none; }
.lock.stacked .mark { height: calc(var(--h) * 1.35em); }
.paper .lock { font-size: clamp(54px, 8vw, 96px); }
.night .lock { font-size: 34px; }
.board .lock { font-size: 17px; gap: .38em; }
.wm { line-height: 1; white-space: nowrap; }
.wm .n { margin-left: .22em; opacity: .42; }
.t-a { font-family: "Fraunces", serif; font-weight: 300; font-variation-settings: "SOFT" 100, "opsz" 144; }
.t-b { font-family: "Fraunces", serif; font-weight: 500; font-variation-settings: "SOFT" 100, "opsz" 144; }
.t-c { font-family: "Cormorant Garamond", serif; font-weight: 500; font-style: italic; font-size: 1.1em; }
.t-d { font-family: "Jost", sans-serif; font-weight: 400; font-size: .96em; }
.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.card { margin: 0; background: var(--card); border: 1px solid var(--rule); border-radius: 4px; display: grid; grid-template-rows: auto auto 1fr; overflow: hidden; }
.card button.face { all: unset; cursor: pointer; display: grid; place-items: center; min-height: 170px; background: var(--paper); color: #15171a; }
.card button.face:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.card .face .lock { font-size: 46px; }
.card .chip { display: flex; justify-content: center; align-items: center; gap: 14px; background: var(--board); color: var(--silk); padding: 14px; }
.card .chip .mark { height: calc(var(--h) * 22px); width: auto; }
.card .chip .mark.xs { height: calc(var(--h) * 11px); }
.card figcaption { padding: 16px 18px 18px; display: grid; gap: 4px; }
.card figcaption b { font-family: var(--head); font-weight: 500; font-size: 18px; }
.card figcaption span { font-size: 14px; color: var(--muted); }
.card.on { border-color: var(--accent); }
.family { display: grid; gap: 14px; justify-items: start; }
.family .lock { font-size: clamp(30px, 4vw, 44px); justify-content: flex-start; }
.next { border-top: 1px solid var(--rule); padding-top: 24px; display: grid; gap: 8px; max-width: 70ch; }
.next h2 { font-size: 26px; }
section.block { display: grid; gap: 20px; }
section.block > h2 { font-size: clamp(24px, 3vw, 30px); }
@media (max-width: 860px) { .studio, .grid { grid-template-columns: minmax(0, 1fr); } }
"""

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--page", type=Path)
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    marks = {}
    for k, (label, idea, f) in VARIANTS.items():
        g, gs = f(), f(small=True)
        (OUT / f"{k}.svg").write_text(master(g, f"Flan — {label} (display)", 40))
        (OUT / f"{k}-small.svg").write_text(master(gs, f"Flan — {label} (6–10 mm)", 8))
        marks[k] = {"label": label, "idea": idea, "display": svg(g, "mark", label), "small": svg(gs, "mark", label),
                    "xs": svg(gs, "mark xs", label)}
    print("wrote", len(list(OUT.glob("*.svg"))), "marks to", OUT.relative_to(ROOT))
    if not a.page:
        return
    first = "iso"
    word = lambda t, n="": f'<span class="wm t-{t}">flan{f"<span class=n>{n}</span>" if n else ""}</span>'
    mk_btn = "".join(f'<button type="button" id="m-{k}" data-k="mark" data-v="{k}" aria-pressed="{str(k == first).lower()}">{escape(m["label"])}</button>' for k, m in marks.items())
    ty_btn = "".join(f'<button type="button" id="t-{t}" data-k="type" data-v="{t}" aria-pressed="{str(t == "a").lower()}">{escape(l)}</button>' for t, l, _ in TYPES)
    ly_btn = ('<button type="button" id="l-row" data-k="layout" data-v="row" aria-pressed="true">Horizontal</button>'
              '<button type="button" id="l-stack" data-k="layout" data-v="stack" aria-pressed="false">Apilado</button>')
    cards = "".join(f'''<figure class="card" data-card="{k}"><button type="button" class="face" data-pick="{k}" aria-label="Usar {escape(m['label'])}"><div class="lock">{m["display"]}{word("a")}</div></button>
  <div class="chip">{m["small"]}{m["xs"]}</div>
  <figcaption><b>{escape(m["label"])}</b><span>{escape(m["idea"])}</span></figcaption></figure>''' for k, m in marks.items())
    data = {"marks": {k: {"display": m["display"], "small": m["small"]} for k, m in marks.items()},
            "words": {t: word(t) for t, _, _ in TYPES},
            "family": {t: [word(t, n) for n in ("36", "42", "46", "54")] for t, _, _ in TYPES}}
    page = f'''<title>Identidad Flan</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<style>{CSS}</style>
<div class="wrap">
  <header class="top">
    <span class="eyebrow">Identidad · ronda 4</span>
    <h1>Flan</h1>
    <p class="lede">Una tecla de perfil bajo vista de lado ya tiene silueta de flan: hombros suaves, cara inclinada y una superficie apenas cóncava. Seis maneras de contar ese chiste, todas con curvas reales y gotas de caramelo con cuello, cada una con su versión gruesa para la serigrafía.</p>
  </header>
  <section class="block">
    <div class="controls">
      <div class="ctl"><span>Símbolo</span><div class="seg" id="seg-mark">{mk_btn}</div></div>
      <div class="ctl"><span>Letra</span><div class="seg">{ty_btn}</div></div>
      <div class="ctl"><span>Disposición</span><div class="seg">{ly_btn}</div></div>
    </div>
    <div class="studio">
      <div class="stage paper"><div class="lock" data-out="paper"></div></div>
      <div class="side">
        <div class="stage night"><div class="lock stacked" data-out="night"></div><span class="cap">Sobre negro</span></div>
        <div class="stage board"><div class="lock" data-out="board"></div><span class="cap">Firma del PCB · 6 mm</span></div>
      </div>
    </div>
  </section>
  <section class="block">
    <h2>Las seis</h2>
    <p class="lede">Toca una para llevarla al compositor. Abajo de cada una, su construcción para serigrafía a 6 y 3 mm.</p>
    <div class="grid">{cards}</div>
  </section>
  <section class="block family">
    <h2>La familia</h2>
    <p class="lede">El número es la cantidad de teclas: base, con columna de meñique, con fila numérica y con ambas.</p>
    <div class="lock" data-out="family0"></div><div class="lock" data-out="family1"></div>
    <div class="lock" data-out="family2"></div><div class="lock" data-out="family3"></div>
  </section>
  <section class="next">
    <h2>Siguiente paso</h2>
    <p>Dime símbolo, letra y disposición. Convierto ese logotipo a contornos, pongo la firma en el reverso del PCB, renombro donde haga falta y genero un paquete de Gerber por cada edición de serigrafía.</p>
  </section>
</div>
<script>
(function () {{
  var D = {json.dumps(data)};
  var st = {{ mark: "{first}", type: "a", layout: "row" }};
  try {{ var s = JSON.parse(localStorage.getItem("naming-r4") || "null"); if (s && D.marks[s.mark] && D.words[s.type]) st = s; }} catch (e) {{}}
  function out(name) {{ return document.querySelector('[data-out="' + name + '"]'); }}
  function render() {{
    document.querySelectorAll(".controls button").forEach(function (b) {{ b.setAttribute("aria-pressed", String(st[b.dataset.k] === b.dataset.v)); }});
    document.querySelectorAll("[data-card]").forEach(function (c) {{ c.classList.toggle("on", c.dataset.card === st.mark); }});
    var m = D.marks[st.mark], w = D.words[st.type];
    var p = out("paper"); p.className = "lock" + (st.layout === "stack" ? " stacked" : ""); p.innerHTML = m.display + w;
    out("night").innerHTML = m.display + w;
    out("board").innerHTML = m.small + w;
    for (var i = 0; i < 4; i++) out("family" + i).innerHTML = m.display + D.family[st.type][i];
    try {{ localStorage.setItem("naming-r4", JSON.stringify(st)); }} catch (e) {{}}
  }}
  document.querySelector(".controls").addEventListener("click", function (ev) {{
    var b = ev.target.closest("button"); if (!b) return; st[b.dataset.k] = b.dataset.v; render();
  }});
  document.querySelector(".grid").addEventListener("click", function (ev) {{
    var b = ev.target.closest("[data-pick]"); if (!b) return; st.mark = b.dataset.pick; render();
    window.scrollTo({{ top: 0, behavior: "smooth" }});
  }});
  render();
}})();
</script>
'''
    a.page.write_text(page)
    print("wrote page", a.page)

if __name__ == "__main__":
    main()
