# Flan36 with common M2 screws

This optional Flan36 variant enlarges the hidden head pockets in the plate and display frame. It accepts ordinary M2 × 0.4 machine screws with a head **no larger than Ø4 × 2 mm**. It keeps the PCB holes, bearing seats, thread engagement, exterior height, battery cage and removable magnetic frame.

**Choose it in the [explorer](https://flankbd.com/explore/):** open **Build → Buy the parts** and set **Screws** to **Common M2**. The model then shows the variant's plates and frames; the shopping list, the guide, the print kit and the complete build ZIP all follow that choice, and the link and saved design keep it. The reference low-head screws stay the default, so earlier designs and links open unchanged. The option is offered for Flan36 only; choosing another size returns to the low-head screws.

A saved design records the choice as `"fasteners": "common-m2"`; without that key it uses the low-head screws. `mechanical/revI/Flan36.FCStd` retains the original low-head pockets, and importing a configuration into FreeCAD does **not** change them. The optional native file is `Flan36-common-screws.FCStd`.

## Hardware for both halves

| Quantity | Screw | Example | Unit price observed 2026-11-11 |
|---|---|---|---|
| 6 | M2 × 6 mm, 0.4 mm pitch | [Bolt Depot 6363](https://boltdepot.com/Product-Details?product=6363) | US$0.10 |
| 4 | M2 × 4 mm, 0.4 mm pitch | [Bolt Depot 6358](https://boltdepot.com/Product-Details?product=6358) | US$0.09 |

These stainless DIN 912 / ISO 4762 socket-cap examples specify a head diameter of 3.62–3.98 mm, height of 1.86–2.00 mm and a **1.5 mm hex key**. The required ten screws total **US$0.96 before shipping and tax**. Bolt Depot states [no minimum order or quantity](https://boltdepot.com/Service); delivered cost and availability must be checked at checkout. Equivalent local screws within the same dimensional limits also qualify for the nominal geometry.

Tap the unchanged Ø1.7 mm pilots with an M2 tap. These are not self-tapping screws. Do not substitute countersunk heads or longer screws. Print the existing M2 coupon first; check actual thread grip, seating and repeated disassembly before the full build.

## What changes

Only the two short-head pockets per half grow: radius 2.15 → 2.30 mm, ceiling Z6.75 → Z7.70 mm. A maximum-size short head ends at Z7.40 mm, leaving 0.30 mm nominal clearance to the pocket ceiling and wall. The original PCB seat remains at Z5.40 mm. The three longer screws still seat at Z7.60 mm.

Level's added upper wall receives the same local relief. Its outer surface and the 14.50 mm frame plane remain unchanged. Existing long-screw openings retain their original width; verify actual driver access and printed fit before assembly.

**Long screws.** The installer rejects any head that collides, but its 0.30 mm clearance rule covers only the two pocketed short screws. The [delivery receipt](../validation/revI-common-fasteners.json) therefore records the side gap around a Ø4 × 2 mm head at the three long screws, measured on the adopted plates between seat and head top. Solid, Color rim and Terrace have no wall within 6 mm. **Level's upper shell half-wraps the rear long screw (H3) and leaves 0.10 mm around a Ø4 mm head**, or 0.20 mm around a Ø3.8 mm head, the same as the reference screw there. With Level, choose screws whose head is Ø3.8 mm or test that screw in the printed shell first; the explorer shows this note when Level is selected. The screws drawn in the model keep the reference low-head shape.

Keep the five structural screws per half. They retain the PCB and battery cage when the magnetic frame is removed. A screwless alternative would need independent positive retention, removal access and measured clip fatigue/creep; magnetic attraction alone does not replace that function.

For service, disconnect USB and power, remove the magnetic frame and keycaps, then remove the three M2×6 screws and plate. The two M2×4 screws then become accessible. Retain the existing battery-disconnection and module-removal sequence in the [assembly guide](build.md#magnetic-frame-and-service).

## Reproduce the optional kit

Keep the baseline source unchanged. Use the installed FreeCAD runtime and existing viewer dependencies. The configuration must select Flan36; other sizes have not been qualified for this option.

```sh
python3 tools/freecad/run_macos.py tools/freecad/install_common_fasteners.py \
  --source mechanical/revI/Flan36.FCStd --output build/common-fasteners/Flan36.FCStd
python3 tools/freecad/run_macos.py tools/freecad/check_common_fastener_service.py \
  --source mechanical/revI/Flan36.FCStd --candidate build/common-fasteners/Flan36.FCStd \
  --configuration configuration.json --output build/common-fasteners/Flan36-common-screws.FCStd
/Applications/FreeCAD.app/Contents/Resources/bin/python tools/check_revI_fasteners.py \
  --head-profile design/common-fasteners.json --output build/common-fasteners/cap-travel.json
# If build/viewer-scene.json is absent, regenerate it with the existing scene inputs:
# /Applications/FreeCAD.app/Contents/Resources/bin/python tools/build_viewer_revI.py
node tools/prepare_common_fastener_kit.mjs --configuration configuration.json \
  --candidate build/common-fasteners --output build/common-fasteners/Print-kit.zip
python3 tools/check_configured_print_kit.py build/common-fasteners/Print-kit.zip
```

Publishing the variant in the explorer takes two more steps: check driver access for every case style, then adopt the changed exports with their receipt and rebuild the viewer.

```sh
# one driver-access report per case style (solid, rim, terrace, level): the same design with that case on both
# halves, saved as build/common-fasteners/service-<style>/configuration.json; the report lands beside it
python3 tools/freecad/run_macos.py tools/freecad/check_common_fastener_service.py \
  --source mechanical/revI/Flan36.FCStd --candidate build/common-fasteners/Flan36.FCStd \
  --configuration build/common-fasteners/service-level/configuration.json \
  --output build/common-fasteners/service-level/Flan36-common-screws.FCStd
python3 tools/adopt_common_fasteners.py build/common-fasteners
/Applications/FreeCAD.app/Contents/Resources/bin/python tools/build_viewer_revI.py
node viewer/build.mjs
node viewer/config-contract-check.cjs
FLAN36_PLAYWRIGHT_MODULE=/path/to/playwright FLAN36_BROWSER=/path/to/chromium node viewer/fasteners-check.cjs
```

`adopt_common_fasteners.py` copies only the exports that differ from the default kit into `mechanical/revI/common-m2/`: the four plates, the six current frames and their body volumes, per half. The frames' detail, accent and secondary volumes are byte-identical and stay shared. It refuses any file not bound to the installer's export hash and any case style without a passed driver-access report, measures the long-screw gaps above, then writes the [delivery receipt](../validation/revI-common-fasteners.json). The viewer build refuses a receipt exported from a different `Flan36.FCStd`. `fasteners-check.cjs` exercises the selection, a failed download and its retry, undo and redo, the link, saved design, view, shopping list, guide, print kit, complete build, GLB, earlier designs, other sizes, Spanish, a phone and the offline copy. Every delivered STL must equal its repository file and its receipt hash, and the model's plates and frames must have the triangle counts of those files.

The installer refuses to overwrite an existing native output. `installation.json` binds the source, recipe, exports and reopened file; `service.json` records continuous driver access and saved frame colors. The kit checker compares every delivered STL byte and every translated 3MF triangle with the native exports. `cap-travel.json` records the full-travel keycap/head check with the explicit head profile.

These are digital checks, not physical acceptance. Print fit, thread strength, driver usability, battery service, printer material assignment and electrical operation still require a first prototype.
