# Revision H: continuous edge and themed frames

The red-line reference called for one continuous inner edge from the display to the outer thumb. RevG still had a notch and a wide thumb-plate wing. Its three taper styles also did not express the requested handheld-console, TV and cyberpunk themes.

## What changed

- A straight flank at **X=135 mm left / X=25 mm right**, with a low plate continuing past the high frame.
- **16 intentional case corners**, each with an analytical **1.2 mm radius**. Case size is approximately **118.1 × 93.8 mm**, 8.1 mm narrower than revG.
- A rounded **24 × 56 mm frame**, ending before the thumb at Y=67 mm. Handheld, Retro TV and Cyberpunk add **0.6 mm raised details** to the 16.6 mm roof height. Plain styles remain available.
- Both KiCad outlines match the CAD proposal. All 36 switch positions/angles and all footprint/net data are preserved.

The power-switch reference still projects 1.5 mm past the case; it is the existing functional access exception. The TV treatment surrounds the real portrait LCD rather than implying a landscape screen.

## Evidence

| Check | Artifact |
|---|---|
| Continuous flank, corner count, switch margins, board/cavity fit | [Outline acceptance](../../validation/revH-outline.json) |
| Exact Piantor layout, reference cap choices and complete selected configurations | [KLP qualification](../../validation/revH-keycaps.json), `tools/check_layout.py` |
| Closed parts, six covers per half, component and USB intersections | [Native geometry](../../validation/revH-mechanical.json) |
| Real FreeCAD configuration, height edit, save/reopen | [Editable source check](../../validation/revH-freecad.json) |
| KiCad outline, preserved footprint/net state, unresolved DRC | [Electrical readback](../../validation/revH-electrical.json) |
| Exact current geometry in the viewer | [Viewer provenance](../../validation/revH-viewer.json) |

Screenshots and renders come from exported geometry. The theme comparison colors the raised faces to illustrate optional paint; each supplied frame is one printable solid. Actual printing, fasteners, cables, retention, firmware, BLE, charging and power measurements remain unfinished.

## Bounded correction review

Two independent read-only reviews agreed on the straight-flank correction and identified the stale PCB wing, possible thumb/frame collisions, service-opening access and the power-switch exception. Their dispositions are recorded in the [design review](../../validation/revH-design-review.json).

The prior outline was inherited from revF and was not checked against a continuous-flank requirement. RevH adds a direct geometric acceptance check for the marked side, plus synchronized board-outline readback and renewed cap qualification. Historical revisions remain available.

The height-edit test also exposed a FreeCAD boolean failure with identical curved loft sections. Constant-section covers now use native extrusions; only tapered plain covers use lofts. Recompute, height and save/reopen assertions must pass before publication. This correction does not establish physical fit.
