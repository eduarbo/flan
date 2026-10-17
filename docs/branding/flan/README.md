# Flan — logo kit

The selected logo (2026-10-17): the **tecla-flan** mark — a low-profile keycap in three-quarter view, caramel on its top face dripping down the front — beside the wordmark **flan**.

| File | Use | Width |
|---|---|---|
| `flan-lockup.svg`, `flan-lockup-white.svg` | Horizontal lockup for screens, print and case relief | 60 mm |
| `flan-mark.svg`, `flan-mark-white.svg` | Mark alone (avatar, keycap legend, small relief) | 20 mm |
| `flan-lockup-pcb.svg` | Silkscreen construction, exactly as installed on the revI boards | 15.05 mm |
| `flan-mark-pcb.svg` | Silkscreen mark alone | 6 mm |

All files are black (or white) closed outlines in millimetres, with no fonts, strokes or bitmaps. Use the display files above about 20 mm. Below that, use the `-pcb` construction: heavier mark lines, two drips instead of four, and the wordmark at weight 450, so no line prints thinner than 0.17 mm.

**Wordmark.** “flan” is set in [Fraunces](https://github.com/google/fonts/tree/main/ofl/fraunces) (SIL Open Font License 1.1) at SOFT 100, opsz 144 and weight 300 (450 for silkscreen), shaped with HarfBuzz, including the “fl” ligature, and converted to outlines. The font itself is not distributed here.

**Lockup rule.** The mark's height balances its area against the wordmark: about 1.19 em. The gap is 0.3 em, and the wordmark's line box is centred on the mark.

**KiCad.** Use *File → Import → Graphics* at scale 1 onto F/B.SilkS. On the back, mirror it so it reads from below. The revI boards already carry the signature as the `flan-signature` group (`tools/install_signature.py`).

**FreeCAD.** Import as *SVG as geometry*, make faces and pad or pocket them.

Regenerate: `python tools/build_flan_logo.py` (needs the pinned Fraunces file in `build/fonts/`; source and hash in `design/branding-flan.json`).
