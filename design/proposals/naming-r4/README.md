# Naming R4 — Flan, tecla-flan marks

**Name chosen: Flan** (2026-10-17). The owner kept the name for its simplicity, as their favourite dessert and as a cultural nod. They liked the tecla-flan idea from [R3](../naming-r3/) but not its execution, so R4 redraws it. **Logo chosen: `iso` (Tres cuartos) with Fraunces 300 SOFT 100, horizontal.** It is built into the [logo kit](../../../docs/branding/flan/README.md) and installed as the back-silkscreen signature on both revI boards.

A low-profile keycap in profile already has a flan's silhouette: soft shoulders, drafted sides and a shallow dish. All six marks share one cap (`tools/branding/flankey.py`), built from tangent arcs. The caramel is a glaze with teardrop drips joined by real fillets (morphological closing).

| Mark | Idea |
|---|---|
| `glaseado` | Outline custard, solid caramel, a plate |
| `solido` | One solid mass; the caramel edge is a cut. Strongest at small sizes |
| `patitas` | The flan stands on two Choc stems instead of a plate |
| `un-trazo` | The plate line rises into the flan and returns to the plate |
| `iso` | The keycap in three-quarter view, caramel over the top face and down the front |
| `linea` | All fine line: outline and caramel edge |

`<mark>.svg` is the display construction at 40 mm wide. `<mark>-small.svg` is the heavier construction with fewer drips, for the back-silkscreen plate at 6–10 mm (8 mm file). Both are black closed outlines. The review page pairs each mark with Fraunces 300/500 SOFT, Cormorant Garamond italic or Jost (OFL).

Regenerate: `python tools/prepare_naming_r4.py --page <out.html>` (needs `tools/requirements-silkscreen.txt`).
