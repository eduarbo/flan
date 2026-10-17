#!/usr/bin/env python3
"""Naming study R3: logo variants for Kumi, Telar and Flan, and an interactive comparison page.

Marks come from tools/branding/fine.py (display hairlines and a heavier small construction).
Wordmarks are set in OFL typefaces by the page. Writes SVG masters of every mark to
design/proposals/naming-r3/ and, with --page, the comparison page.
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import argparse, json, sys
from html import escape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from branding import fine                                   # noqa: E402
from prepare_naming_r2 import stroked, filled, master       # noqa: E402

OUT = ROOT / "design/proposals/naming-r3"
DATA = json.loads((ROOT / "design/naming-r3.json").read_text())

FONTS = ("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Fraunces:opsz,wght,SOFT@9..144,300,100"
         "&family=IBM+Plex+Mono:wght@400;500&family=Jost:wght@300;400&family=Shippori+Mincho:wght@500"
         "&family=Zen+Kaku+Gothic+New:wght@300;400;500&display=swap")

CSS = """
/* Layout: a design studio sheet — per name, a live composing stage with its uses, then the parts laid out. */
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
.wrap { max-width: 1160px; margin: 0 auto; display: grid; gap: 96px; }
h1, h2, h3 { font-family: var(--head); font-weight: 500; margin: 0; text-wrap: balance; }
p { margin: 0; }
.eyebrow { font: 500 11px/1.4 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
header.top { padding-top: 56px; display: grid; gap: 18px; max-width: 760px; }
header.top h1 { font-size: clamp(34px, 5.2vw, 56px); line-height: 1.12; }
.lede { color: var(--muted); max-width: 64ch; }
.name { display: grid; gap: 30px; border-top: 1px solid var(--rule); padding-top: 30px; }
.name > header { display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; }
.name > header h2 { font-size: clamp(28px, 3.4vw, 36px); }
.controls { display: flex; flex-wrap: wrap; gap: 12px 26px; align-items: center; }
.ctl { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ctl > span { font: 500 11px/1 var(--mono); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.seg { display: inline-flex; flex-wrap: wrap; border: 1px solid var(--rule); border-radius: 999px; padding: 2px; background: var(--card); }
.seg button { font: 500 13px/1 var(--body); color: var(--ink); background: none; border: 0; border-radius: 999px; padding: 8px 14px; cursor: pointer; }
.seg button[aria-pressed="true"] { background: var(--ink); color: var(--bg); }
.seg button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.studio { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 14px; }
.side { display: grid; gap: 14px; }
.stage { border-radius: 4px; display: grid; place-items: center; padding: 40px 24px; }
.stage.paper { background: var(--paper); color: #15171a; min-height: 380px; border: 1px solid var(--rule); }
.stage.night { background: var(--night); color: #ebeae6; min-height: 183px; }
.stage.board { background: var(--board); color: var(--silk); min-height: 183px; position: relative; }
.stage.board .cap, .stage.night .cap { position: absolute; left: 16px; bottom: 12px; font: 400 11px/1 var(--mono); letter-spacing: .04em; opacity: .7; }
.stage.night { position: relative; }
.lock { display: flex; align-items: center; justify-content: center; gap: .36em; flex-wrap: wrap; }
.lock.stacked { flex-direction: column; gap: .32em; }
.lock .mark { height: 2.2em; width: auto; }
.lock.stacked .mark { height: 2.5em; }
.paper .lock { font-size: clamp(44px, 6.6vw, 74px); }
.night .lock { font-size: 26px; }
.board .lock { font-size: 15px; gap: .5em; }
.board .lock .mark { height: 2.3em; }
.wm { line-height: 1; white-space: nowrap; }
/* Kumi */
.t-kumi-a { font-family: "Zen Kaku Gothic New", sans-serif; font-weight: 400; text-transform: uppercase; letter-spacing: .42em; font-size: .62em; padding-left: .42em; }
.t-kumi-b { font-family: "Shippori Mincho", serif; font-weight: 500; font-size: .86em; letter-spacing: .02em; }
.t-kumi-c { font-family: "Jost", sans-serif; font-weight: 400; font-size: .9em; letter-spacing: .01em; }
.idot { position: relative; display: inline-block; line-height: 1.2; }
.idot svg { position: absolute; left: 50%; top: .29em; width: .2em; height: .2em; transform: translate(-50%, -50%); }   /* measured on Jost's own tittle */
/* Telar */
.t-telar-a { font-family: "Fraunces", serif; font-weight: 300; font-variation-settings: "SOFT" 100, "opsz" 144; font-size: .9em; }
.t-telar-b { font-family: "Cormorant Garamond", serif; font-weight: 600; text-transform: uppercase; letter-spacing: .3em; font-size: .6em; padding-left: .3em; }
.t-telar-c { font-family: "Jost", sans-serif; font-weight: 300; font-size: .9em; letter-spacing: .01em; }
/* Flan */
.t-flan-a { font-family: "Fraunces", serif; font-weight: 300; font-variation-settings: "SOFT" 100, "opsz" 144; font-size: .94em; }
.t-flan-b { font-family: "Cormorant Garamond", serif; font-weight: 500; font-style: italic; font-size: 1.04em; letter-spacing: .01em; }
.t-flan-c { font-family: "Jost", sans-serif; font-weight: 400; font-size: .92em; letter-spacing: .01em; }
.note { max-width: 64ch; color: var(--muted); }
.parts { display: grid; gap: 16px; }
.parts h3 { font-size: 20px; }
.marks { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
.mk { background: var(--card); border: 1px solid var(--rule); border-radius: 4px; padding: 20px; display: grid; gap: 12px; align-content: start; }
.mk .pair { display: flex; align-items: center; gap: 18px; }
.mk .pair .big { width: 96px; height: 96px; color: var(--ink); }
.mk .pair .tiny { width: 30px; height: 30px; background: var(--board); color: var(--silk); padding: 4px; border-radius: 3px; box-sizing: content-box; }
.mk b { font-family: var(--head); font-weight: 500; font-size: 17px; }
.mk p { font-size: 14px; color: var(--muted); }
.types { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
.ty { background: var(--card); border: 1px solid var(--rule); border-radius: 4px; padding: 22px 20px; display: grid; gap: 10px; }
.ty .sample { font-size: 52px; color: var(--ink); min-height: 64px; display: flex; align-items: center; }
.ty b { font-family: var(--head); font-weight: 500; }
.ty p { font: 400 12px/1.5 var(--mono); color: var(--muted); }
.next { border-top: 1px solid var(--rule); padding-top: 24px; display: grid; gap: 8px; max-width: 70ch; }
.next h2 { font-size: 26px; }
@media (max-width: 860px) { .studio { grid-template-columns: minmax(0, 1fr); } }
"""

def source_mark(path, cls, label):
    """A filled reference mark from an existing SVG, fitted to the 100 × 100 box."""
    from silkscreen.prims import load_logo, place
    g = place(load_logo(ROOT / path), 50, 50, width=88)
    d = " ".join("M" + " L".join(f"{x:.2f},{y:.2f}" for x, y in r.coords) + "Z"
                 for p in getattr(g, "geoms", [g]) for r in [p.exterior] + list(p.interiors))
    return (f'<svg class="{cls}" viewBox="0 0 100 100" role="img" aria-label="{escape(label)}">'
            f'<path d="{d}" fill="currentColor" fill-rule="evenodd"/></svg>')

def tight(svg, layers, min_aspect=0.72, pad=2.0):
    """Crop the 100 × 100 viewBox to the drawing, so wide marks (a flan on its plate) sit at
    the same visual size as square ones next to the wordmark."""
    from shapely.ops import unary_union
    x0, y0, x1, y1 = unary_union([g.buffer(w / 2 + pad) for g, w in layers]).bounds
    w, h = x1 - x0, y1 - y0
    if h < w * min_aspect:
        y0 -= (w * min_aspect - h) / 2; h = w * min_aspect
    return svg.replace('viewBox="0 0 100 100"', f'viewBox="{x0:.2f} {y0:.2f} {w:.2f} {h:.2f}"', 1)

def mark_svgs(m, big="mark", small="mark"):
    if m.get("source"):
        return source_mark(m["source"], big, m["label"]), source_mark(m["source"], small, m["label"])
    d, sm = fine.MARKS[m["id"]](), fine.SMALL[m["id"]]()
    return tight(stroked(d, big, m["label"]), d), tight(filled(sm, small, m["label"]), sm)

def word_html(slug, t):
    if slug == "kumi" and t == "c":      # the i's dot is a tiny asanoha
        dot = filled(fine.SMALL["kumi"](), "dotmark", "punto")
        return f'<span class="wm t-kumi-c">kum<span class="idot">ı{dot}</span></span>'
    text = {"kumi": "Kumi", "telar": "telar", "flan": "flan"}[slug]
    return f'<span class="wm t-{slug}-{t}">{escape(text)}</span>'

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--page", type=Path)
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    data = {}
    for slug, n in DATA["names"].items():
        for m in n["marks"]:
            k = m["id"]
            if m.get("source"):
                continue
            (OUT / f"{k}.svg").write_text(master(fine.MARKS[k](), f"{n['name']} — {m['label']} (display)", 40, False))
            (OUT / f"{k}-small.svg").write_text(master(fine.SMALL[k](), f"{n['name']} — {m['label']} (6–10 mm)", 8, True))
        data[slug] = {
            "marks": {m["id"]: dict(zip(("display", "small"), mark_svgs(m))) for m in n["marks"]},
            "words": {t["id"]: word_html(slug, t["id"]) for t in n["types"]},
        }
    print("wrote", len(list(OUT.glob("*.svg"))), "marks to", OUT.relative_to(ROOT))
    if not a.page:
        return
    sections = []
    for slug, n in DATA["names"].items():
        mk_btn = "".join(f'<button type="button" id="{slug}-m-{m["id"]}" data-k="mark" data-v="{m["id"]}" aria-pressed="{str(i == 0).lower()}">{escape(m["label"])}</button>' for i, m in enumerate(n["marks"]))
        ty_btn = "".join(f'<button type="button" id="{slug}-t-{t["id"]}" data-k="type" data-v="{t["id"]}" aria-pressed="{str(i == 0).lower()}">{escape(t["label"])}</button>' for i, t in enumerate(n["types"]))
        ly_btn = (f'<button type="button" id="{slug}-l-row" data-k="layout" data-v="row" aria-pressed="true">Horizontal</button>'
                  f'<button type="button" id="{slug}-l-stack" data-k="layout" data-v="stack" aria-pressed="false">Apilado</button>')
        marks = "".join(f'''<article class="mk"><div class="pair">{"".join(mark_svgs(m, "big", "tiny"))}</div>
          <b>{escape(m["label"])}</b><p>{escape(m["idea"])}</p></article>''' for m in n["marks"])
        types = "".join(f'''<article class="ty"><div class="sample">{word_html(slug, t["id"])}</div><b>{escape(t["label"])}</b><p>{escape(t["face"])}</p></article>''' for t in n["types"])
        sections.append(f'''<section class="name" id="{slug}" data-name="{slug}">
  <header><h2>{escape(n["name"])}</h2><span class="eyebrow">{len(n["marks"])} símbolos · {len(n["types"])} tipografías</span></header>
  {f'<p class="note">{escape(n["note"])}</p>' if n.get("note") else ""}
  <div class="controls">
    <div class="ctl"><span>Símbolo</span><div class="seg">{mk_btn}</div></div>
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
  <div class="parts"><h3>Los símbolos</h3><div class="marks">{marks}</div></div>
  <div class="parts"><h3>Las tipografías</h3><div class="types">{types}</div></div>
</section>''')
    page = f'''<title>Kumi, Telar o Flan</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<style>{CSS}</style>
<div class="wrap">
  <header class="top">
    <span class="eyebrow">Variantes de logo</span>
    <h1>Kumi, Telar o Flan</h1>
    <p class="lede">Símbolos y tipografías para cada nombre. Combínalos en cada sección: verás el logo en papel, sobre negro y como firma en el reverso del PCB, con la construcción más gruesa que exige la serigrafía.</p>
  </header>
  {''.join(sections)}
  <section class="next">
    <h2>Siguiente paso</h2>
    <p>Dime la combinación que prefieras, por ejemplo «Flan, tecla-flan, itálica, horizontal». Convierto ese logotipo a contornos, renombro el proyecto y genero un paquete de Gerber por cada edición de serigrafía.</p>
  </section>
</div>
<script>
(function () {{
  var DATA = {json.dumps(data)};
  document.querySelectorAll("section.name").forEach(function (sec) {{
    var slug = sec.dataset.name, d = DATA[slug];
    var st = {{ mark: Object.keys(d.marks)[0], type: Object.keys(d.words)[0], layout: "row" }};
    try {{ var saved = JSON.parse(localStorage.getItem("naming-r3-" + slug) || "null"); if (saved && d.marks[saved.mark] && d.words[saved.type]) st = saved; }} catch (e) {{}}
    function render() {{
      sec.querySelectorAll(".seg button").forEach(function (b) {{ b.setAttribute("aria-pressed", String(st[b.dataset.k] === b.dataset.v)); }});
      var paper = sec.querySelector('[data-out="paper"]');
      paper.className = "lock" + (st.layout === "stack" ? " stacked" : "");
      paper.innerHTML = d.marks[st.mark].display + d.words[st.type];
      sec.querySelector('[data-out="night"]').innerHTML = d.marks[st.mark].display + d.words[st.type];
      sec.querySelector('[data-out="board"]').innerHTML = d.marks[st.mark].small + d.words[st.type];
      try {{ localStorage.setItem("naming-r3-" + slug, JSON.stringify(st)); }} catch (e) {{}}
    }}
    sec.querySelector(".controls").addEventListener("click", function (ev) {{
      var b = ev.target.closest("button"); if (!b) return;
      st[b.dataset.k] = b.dataset.v; render();
    }});
    render();
  }});
}})();
</script>
'''
    a.page.write_text(page)
    print("wrote page", a.page)

if __name__ == "__main__":
    main()
