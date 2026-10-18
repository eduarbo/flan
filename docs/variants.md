# The Flan family

**Flan36 is built. Flan42, Flan46 and Flan54 have generated layouts, matrices and preliminary case outlines; their PCBs, cases, firmware and viewer support come next.**

![The Flan family: Flan36, Flan42, Flan46 and Flan54, both halves from the front](images/variants/family.svg)

| Variant | Per half | Keys | Adds per half | Case per half | Matrix |
|---|---|---|---|---|---|
| **Flan36** | 3 × 5 + 3 | 36 | — | 116.75 × 94.57 mm | 4 × 6 |
| **Flan42** | 3 × 6 + 3 | 42 | outer pinky column K00, K10, K20 | 134.75 × 94.57 mm | 4 × 6 |
| **Flan46** | 4 × 5 + 3 | 46 | number row K41–K45 | 116.75 × 111.57 mm | 5 × 6 |
| **Flan54** | 4 × 6 + 3 | 54 | both, plus K40 | 134.75 × 111.57 mm | 5 × 6 |

## Rules

- **Nothing in Flan36 moves.** Every Flan36 key, the thumbs and the electronics bay keep their exact centres and angles; the larger variants only add keys, so a saved Flan36 design maps onto them key for key.
- **Outer pinky column:** the K00/K10/K20 centres of the pinned [Piantor boards](../sources/piantor/), which Flan36 left out, level with column 1. Piantor turns those footprints 180°, which moves only the hot-swap socket; Flan keeps every key upright.
- **Number row:** one 17 mm row pitch above each column's top key, keeping the column stagger.
- **Refs follow the matrix:** `K<row><column>`. Column 0 is already wired (thumb K30 uses it), so the outer column needs no new GPIO. The number row is matrix row 4 and needs one row GPIO per half; free pins are D15 and D18–D21 on the left and D2–D6 on the right, to be chosen while routing.
- **Outline:** the revI rule in [`tools/outline.py`](../tools/outline.py): column plateaus 4.75 mm beyond each switch cut, the bay flank, offset thumb faces and local tangent rounds. Flan36 reproduces the revI control vertices exactly.
- **Spacing:** every new key keeps at least Flan36's own finger-key spacing: 0.5 mm cap to cap, 3.0 mm cut to cut and 0.25 mm cap to bay. The closest new key to the bay, K45, has 0.79 mm.

Layouts, matrix transforms, outline control vertices and spacing are in [`design/variants.json`](../design/variants.json). Regenerate and check them, including the Flan36 regressions against revI and the shipped firmware transform:

```sh
python3 tools/build_variants.py      # needs Shapely (tools/requirements-silkscreen.txt)
```

## Next stages

Each stage applies to Flan42, Flan46 and Flan54. Flan42 is the natural first build: it adds keys to an existing matrix column and needs no new pin.

1. **PCB:** a KiCad project per variant with the added switch, socket and diode footprints, the row-4 net for the number row, routing, DRC/ERC/schematic parity and Gerber packages. The signature and the six silkscreen editions regenerate from each board's outline.
2. **Case:** FreeCAD bodies from the variant outline with the same stack, bay, frames, magnets and batteries; new fastener positions for the larger plates; fit coupons.
3. **Firmware:** a ZMK shield per variant from its matrix transform, the row-4 pin and keymaps with the number row or outer column.
4. **Keycaps:** KLP Lamé qualification for the new positions.
5. **Viewer:** a variant choice in Design, each variant's scene loaded on demand like the print kit.

None of this is physically qualified; the variants inherit Flan36's open hardware tests.
