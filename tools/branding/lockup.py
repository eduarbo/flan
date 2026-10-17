"""The Flan lockup: the three-quarter tecla-flan mark beside the wordmark "flan".

Reproduces the review page's horizontal lockup exactly: the mark's height balances its area
against the wordmark (sqrt(1.74 / aspect) em), a 0.3 em gap, and the text's line box centred
on the mark (baseline (ascender - descender) / 2 below the centre). Geometry is in em, y down,
origin at the lockup's top-left; callers scale it to millimetres.

Wordmark: Fraunces (OFL), SOFT 100, opsz 144, WONK at its default, shaped with HarfBuzz
(the "fl" ligature included). The display lockup uses weight 300. At silkscreen size the
same face is set at weight 450 so that no hairline falls below 0.17 mm.
"""
import math
from pathlib import Path
from shapely import affinity
from shapely.ops import unary_union
from .flankey import iso
from .outline_text import outline

FONT = {"family": "Fraunces", "license": "OFL-1.1",
        "source": "https://github.com/google/fonts/tree/main/ofl/fraunces",
        "file": "Fraunces[SOFT,WONK,opsz,wght].ttf",
        "sha256": "177ff6c0f14e5550a3c624247cd1189611d4eb65d000b14944c63d967958abbb"}
PAD = 1.5          # the page's SVG padding around the mark, in mark units
AREA = 1.74        # optical area constant used by the review page
GAP = 0.30         # em between mark box and text box

def lockup(font_path, small=False, wght=None):
    mark = iso(small=small)
    x0, y0, x1, y1 = mark.bounds
    bw, bh = x1 - x0 + 2 * PAD, y1 - y0 + 2 * PAD
    h_em = math.sqrt(AREA / (bw / bh))
    s = h_em / bh
    m = affinity.translate(affinity.scale(mark, s, s, origin=(x0 - PAD, y0 - PAD)), -(x0 - PAD), -(y0 - PAD))
    weight = wght or (450 if small else 300)
    text, met = outline("flan", font_path, {"wght": weight, "opsz": 144, "SOFT": 100})
    baseline = h_em / 2 + (met["ascender"] - met["descender"]) / 2
    t = affinity.translate(affinity.scale(text, 1, -1, origin=(0, 0)), bw * s + GAP, baseline)
    g = unary_union([m, t])
    return g, {"mark_em": h_em, "width_em": bw * s + GAP + met["advance"], "wght": weight,
               "mark_box": (0, 0, bw * s, h_em), "glyphs": met["glyphs"]}

def font_file(root):
    """Local copy of the pinned font; fetch it from the URL in FONT if missing."""
    p = Path(root) / "build/fonts" / FONT["file"]
    return p
