# Naming R3 — Kumi, Telar or Flan

**Proposal; the project is still Flan36.** The owner narrowed R2 to Kumi and Telar, asked for logo variants, then added Flan back: a simple name, the owner's favourite dessert and a cultural nod. Data: [`design/naming-r3.json`](../../naming-r3.json).

| Name | Marks | Typefaces (OFL) |
|---|---|---|
| **Kumi** | `kumi` asanoha · `kumi-split` two halves · `kumi-key` mitsukude cube with an asanoha keycap · `kumi-mon` asanoha in a circle | Zen Kaku Gothic New caps · Shippori Mincho · Jost with an asanoha i-dot |
| **Telar** | `telar` diagonal woven key · `telar-key` rounded keycap, straight weave · `telar-warp` warp threads with two wefts | Fraunces SOFT · Cormorant Garamond caps · Jost |
| **Flan** | `flan` profile on a plate, caramel drips · `flan-key` a Choc keycap in profile is a flan, with both stem legs · `flan-mon` seen from above in a circle · `flan-split` cut in two | Fraunces SOFT · Cormorant Garamond italic · Jost |

The page also shows the current Outline symbol next to the Flan marks for comparison.

Every mark has a display construction (`<mark>.svg`, 40 mm) and a heavier one for the 6–10 mm back-silkscreen plate or relief (`<mark>-small.svg`, 8 mm), as black closed outlines in millimetres. Dropped: `telar-pair`, two woven diamonds that crowded at the centre.

Regenerate: `python tools/prepare_naming_r3.py --page <out.html>` (needs `tools/requirements-silkscreen.txt` and the R3 silkscreen geometry in `build/silkscreen-r3/`).
