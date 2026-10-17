# Naming R2 — elegant identities

**Proposal; the project is still Flan36.** R1's code-drawn lettering and heavy marks read as a technical sketch, and the owner asked for something more elegant. R2 keeps three names, rebuilds each mark as exact fine-line geometry, and sets each wordmark in an OFL typeface. Data: [`design/naming-r2.json`](../../naming-r2.json); collision check as in R1.

| Name | Mark | Wordmark |
|---|---|---|
| **Kumi** (recommended) | Asanoha in a hexagon: a heavier frame holds lighter pieces, as in kumiko joinery. Alternate: split into the two halves. | Zen Kaku Gothic New 400, caps, 0.42 em tracking |
| **Seda** | A seigaiha field held in a circle, like a family crest | Cormorant Garamond 500 |
| **Telar** | Warp and weft interlaced on the diagonal inside a key-shaped square | Fraunces 300, SOFT 100 |

Each mark has two constructions in `tools/branding/fine.py`: display (hairlines, `<mark>.svg`, 40 mm) and small (heavier and sparser, `<mark>-small.svg`, 8 mm) for the back-silkscreen plate or printed relief. Both are black closed outlines in millimetres. Wordmarks stay live text in the review page; the chosen one is converted to outlines from its OFL font for production.

Family rule unchanged: `<Name> 36 / 42 / 46 / 54` (base, + pinky column, + number row, both). Only the naming is defined.

Regenerate: `python tools/prepare_naming_r2.py --page <out.html>` (needs `tools/requirements-silkscreen.txt` and the R3 geometry in `build/silkscreen-r3/`).
