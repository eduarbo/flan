# Flan36 Outline — SVG kit

The selected Outline concept is now an editable, font-free vector. Its symbol and six letters are closed filled Bézier paths; the four internal holes remain open. One chosen logo, supplied as a complete mark, symbol and lettering.

| File | Use | SVG page width |
| --- | --- | --- |
| `flan36-outline-master.svg` | Editable source; symbol and each letter have a named path | 30 mm |
| `flan36-outline-black.svg` | Complete logo, one ink; starting point for graphics import | 30 mm |
| `flan36-outline-symbol-black.svg` | Symbol alone, one ink; starting point for a small case/PCB mark | 12 mm |
| `flan36-outline-wordmark-black.svg` | Lettering alone, already converted to paths | 30 mm |

Backgrounds are transparent. `preview.svg` is a presentation sheet, **not** a manufacturing master; it presents the same logo on a light background. The logo SVGs have no fonts, raster images, live strokes, masks or external resources.

## PCB: KiCad

Import the black logo or symbol through **File → Import → Graphics**, set scale to **1**, select **F.SilkS** (or B.SilkS for a back-side mark), and group the imported items. Inspect the actual size and back-side orientation. Keep the mark clear of exposed pads, existing legends and mounting holes; check the fabricator's minimum line/space rules at the final scale. [KiCad graphics-import documentation](https://docs.kicad.org/10.0/en/pcbnew/pcbnew.html#importing-vector-graphics).

These are page widths with a tiny artboard margin, not approved placement dimensions. No logo is placed on the keyboard PCB by this kit. KiCad placement and final fabrication output still need checking.

## Case: FreeCAD

Import the black logo or symbol as **SVG as geometry (importSVG)**. The imported paths can form faces for an emboss or a pocket. Select the symbol alone for a compact mark, or all seven faces for the complete logo. [FreeCAD SVG workflow](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/Import_text_and_geometry_from_Inkscape.md).

The supplied black logo, symbol and wordmark were imported headlessly into FreeCAD 1.1.3: dimensions, counters and valid trial extrusions were checked. This does not qualify a cut in a case wall. Choose the final placement and relief depth against the actual wall, ribs, battery and joining features. No case geometry is changed by this kit.

## Edit and regenerate

Edit `flan36-outline-master.svg` in a vector editor. For the repository generator, keep the seven named top-level paths, explicit absolute M/C/Z commands, no transforms and `fill-rule="evenodd"`; closed cubic contours keep the import path simple.

From the repository root, use a Python environment with `tools/requirements-branding.txt`:

```sh
python tools/build_outline_logo.py --png --package
python tools/check_outline_logo.py
python tools/freecad/run_macos.py tools/freecad/check_outline_logo.py
```

CairoSVG needs the Cairo system library for PNG rendering and raster readback. On macOS with Homebrew Cairo, prefix the first two commands with `DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib`. The last command uses the existing macOS FreeCAD installation and opens no GUI. On other platforms, run `tools/freecad/check_outline_logo.py` in a FreeCAD Python environment.

`--trace` intentionally recreates the master from the selected concept and **replaces manual master edits**. Normal regeneration omits that flag. The vector trace uses the bottom-left monochrome reference from `docs/images/branding/flan36-caramel-outline.png`; earlier concept boards remain historical references.

The kit contains SVG art, this guide, a hash manifest and the repository license. It contains no placed PCB artwork, case cut, G-code or print-process approval. [Source and provenance](https://github.com/eduarbo/flan/blob/main/design/branding-outline-vectors.json).
