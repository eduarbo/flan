# Naming R1 — a name that scales

**Proposal; the project is still Flan36.** The owner asked for a better name than Flan and logo options, and wants a family with a number row and extra pinky columns. Candidates, rationale and the collision check are in [`design/naming-r1.json`](../../naming-r1.json).

| Name | Says | Marks |
|---|---|---|
| **Kumi** (recommended) | 組み, to join or assemble: the root of kumiko and kumihimo | `kumi-asanoha`, `kumi-split` |
| **Telar** | Loom: warp and weft cross like the key matrix's rows and columns | `telar-weave` |
| **Nopal** | Grows pad by pad; two pads, two halves | `nopal-pair` |
| **Seda** | Silk, as in silkscreen; the raimon fret is one folded thread | `seda-raimon` |

Discarded: Tesela (reads as Tesla), Trama (sounds like trauma in English), Petate (*petatearse* means to die in Mexico).

**Family rule:** `<Name> <keys>`. 36 is revI (5 × 3 + 3 per half); 42 adds an outer pinky column, 46 a number row, 54 both. `family-*.svg` draws each on the real revI key poses, with the added keys in orange. Only the naming is defined; the 42/46/54 boards are not designed. Back-silkscreen editions keep their pattern names (Asanoha, Kikkō, Sayagata, Seigaiha, Meandro, Vías).

**Lettering and marks** are drawn in code (`tools/branding/`): monoline, round-capped strokes like PCB traces, no font files. `*.svg` are 10 mm marks and `*-lockup.svg` 8 mm lockups, black closed paths in millimetres, ready for KiCad graphics import or a FreeCAD relief.

Regenerate: `python tools/prepare_naming_r1.py` (needs `tools/requirements-silkscreen.txt` and the R3 geometry in `build/silkscreen-r3/`).
