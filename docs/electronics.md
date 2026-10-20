# Routed electronics

Both revI boards are now routed. KiCad 10.0.6 reports **0 DRC violations, 0 unconnected items, 0 schematic parity issues and 0 ERC violations** on each serialized board and schematic. All 247 physical pads per half were checked, including duplicate pad numbers in the hot-swap footprints.

These are prototype candidates for Eduardo Ruiz's original FLAN36 design. The [parts guide](parts.md) now selects the supplied nice!view connector and exact controller sockets/pins. Supplied-part fit, printed retention, radio performance and electrical operation remain physically untested. Use the [assembly sequence](build.md) and [firmware](firmware.md) together.

| Half | Editable project | Prototype Gerbers and drills |
|---|---|---|
| Left | [KiCad project](../hardware/revI/flan36-left.kicad_pro) | [Left ZIP](../hardware/revI/fabrication/flan36-left-revI-prototype.zip) |
| Right | [KiCad project](../hardware/revI/flan36-right.kicad_pro) | [Right ZIP](../hardware/revI/fabrication/flan36-right-revI-prototype.zip) |

Download the repository to retain the relative libraries and 3D models. In KiCad, open the project, then PCB Editor; use **Alt+3** for the assembly view. The [FreeCAD workflow](freecad.md) remains the editable mechanical source.

## Order the two PCBs

Download the **[left Gerber/drill ZIP](https://raw.githubusercontent.com/eduarbo/flan/main/hardware/revI/fabrication/flan36-left-revI-prototype.zip)** and **[right Gerber/drill ZIP](https://raw.githubusercontent.com/eduarbo/flan/main/hardware/revI/fabrication/flan36-right-revI-prototype.zip)**. Open **[JLCPCB's PCB quotation page](https://cart.jlcpcb.com/quote)** and upload them as **two separate jobs in the same cart**. One keyboard needs one left and one right board; the usual minimum is five boards per job, so confirm the quantity shown by the current quote.

Select **2 layers, FR4, 1.6 mm thickness, 1 oz copper and lead-free HASL**, with **no assembly and no stencil**. For **PCB Color**, any of JLCPCB's seven solder masks works: green, purple, red, yellow, blue, white or black. The Gerbers are the same for every color; green has the fastest turnaround. Silkscreen is white, or black on white boards. Black and white need 0.13 mm mask bridges, and Flan's smallest is 0.47 mm ([capabilities](https://jlcpcb.com/capabilities/pcb-capabilities), checked 2026-10-17). Preview the combination in the viewer's **Design → PCB** tab. Both outlines measure **113.45 × 91.272757 mm**; let the Gerber importer detect them and inspect both outer contours and internal cutouts. The files already contain the separate plated and non-plated drill programs. No manual redraw or Piantor PCB substitution is needed. Shipping and the final price depend on the live quote and destination; no fabrication order or price is implied here.

The back of both boards carries the **Flan signature**: the logo, `REV I · 2026 · RIGHT/LEFT` and the credit `by`, the eduarbo cube and `eduarbo` ([logo](branding.md), [receipt](../validation/revI-signature.json)). The base ZIPs above have the signature and no pattern.

The connector-height correction changes the printed assembly, not these routed PCBs.

### Editions

Each edition adds an all-over back-silkscreen pattern, drawn as one design across both halves. It stops along the signature's own outline and calms down within 6 mm of it, so the signature sits inside the pattern rather than in a cut-out box: Vías dots shrink, the Asanoha and Kikkō lattices keep their frames and drop their spokes, Meandro runs straight, Seigaiha fans lose their inner arcs and Sayagata its centre vias. To order an edition, upload its two ZIPs instead of the base ones; everything else above is the same. The viewer's **Design → PCB** tab shows each edition from below in any mask color and links its ZIPs.

| Edition | Both halves from below | Gerber/drill ZIPs |
|---|---|---|
| **Asanoha** | [preview](images/editions/asanoha.png) | [left](https://raw.githubusercontent.com/eduarbo/flan/main/hardware/revI/fabrication/editions/flan36-left-revI-asanoha.zip) · [right](https://raw.githubusercontent.com/eduarbo/flan/main/hardware/revI/fabrication/editions/flan36-right-revI-asanoha.zip) |
| **Kikkō** | [preview](images/editions/kikko.png) | [left](https://raw.githubusercontent.com/eduarbo/flan/main/hardware/revI/fabrication/editions/flan36-left-revI-kikko.zip) · [right](https://raw.githubusercontent.com/eduarbo/flan/main/hardware/revI/fabrication/editions/flan36-right-revI-kikko.zip) |
| **Sayagata** | [preview](images/editions/sayagata.png) | [left](https://raw.githubusercontent.com/eduarbo/flan/main/hardware/revI/fabrication/editions/flan36-left-revI-sayagata.zip) · [right](https://raw.githubusercontent.com/eduarbo/flan/main/hardware/revI/fabrication/editions/flan36-right-revI-sayagata.zip) |
| **Seigaiha** | [preview](images/editions/seigaiha.png) | [left](https://raw.githubusercontent.com/eduarbo/flan/main/hardware/revI/fabrication/editions/flan36-left-revI-seigaiha.zip) · [right](https://raw.githubusercontent.com/eduarbo/flan/main/hardware/revI/fabrication/editions/flan36-right-revI-seigaiha.zip) |
| **Meandro** | [preview](images/editions/meandro.png) | [left](https://raw.githubusercontent.com/eduarbo/flan/main/hardware/revI/fabrication/editions/flan36-left-revI-meandro.zip) · [right](https://raw.githubusercontent.com/eduarbo/flan/main/hardware/revI/fabrication/editions/flan36-right-revI-meandro.zip) |
| **Vías** | [preview](images/editions/vias.png) | [left](https://raw.githubusercontent.com/eduarbo/flan/main/hardware/revI/fabrication/editions/flan36-left-revI-vias.zip) · [right](https://raw.githubusercontent.com/eduarbo/flan/main/hardware/revI/fabrication/editions/flan36-right-revI-vias.zip) |

Every edition and half passes KiCad DRC with schematic parity (0 violations, 0 unconnected, 0 parity issues) and reads back from the saved board. Apart from export dates, every file matches the base package except `B_Silkscreen`, so copper, mask, outline and drills are identical. [Edition receipt](../validation/revI-editions.json) · [patterns and rules](../design/proposals/silkscreen-r3/README.md).

![Asanoha edition, both halves from below](images/editions/asanoha.png)

![Left PCB — actual copper and contour](images/revI-routed-left.svg)
![Right PCB — actual copper and contour](images/revI-routed-right.svg)

## Fabrication candidate

- Two copper layers; **1.6 mm FR4**, nominal **1 oz copper**.
- Minimum routed track **0.20 mm**; netclass clearance **0.20 mm**; copper-to-edge **0.50 mm**.
- ZIPs include both copper, mask and silkscreen layers, Edge.Cuts, separate plated/non-plated drills, drill maps, source hashes and a prototype notice. Internal battery/station openings belong to Edge.Cuts.
- Back silkscreen: signature lines ≥ 0.17 mm and text 1.0 mm; edition patterns 0.22–0.30 mm, ≥ 0.24 mm apart, 0.30 mm from pads and legends, 0.35 mm from holes and 0.8 mm from the signature's outline (closed over 0.9 mm). Check that the fabricator preview keeps the fine lines.
- Inspect the fabricator's Gerber and drill preview, including internal cutouts and the narrow north bridge. No panelization or assembly service is specified here.

The exact original key angles, all footprint/pad geometry, holes, model references and outer/internal contours were preserved against `fe8c7fd`. The FreeCAD case did not change. The router's sub-micron coordinate rounding was restored before the final checks.

The right MCU uses different GPIOs so signals can escape toward the keys. Its rows use **D21/D20/D19/D18**, and column 0 uses **D15**. The left keeps D2/D3/D4/D5 and D6. All other columns and display pins are unchanged. The same [pin map](../design/pinmap.json) is checked against schematic, every PCB pad and compiled firmware. Do not flash the left file onto the right board.

## Power and assembly checks

Before installing controllers, check BAT+ to GND for shorts and verify J1 polarity against the supplied pack. J1 pin 1 is BAT+; pin 2 is GND. SW1 connects BAT+ to the controller's RAW/B+ input. Opening SW1 disconnects the cell, including from charging; USB can still power the controller. Reset connects RST to GND.

Keep the nice!nano **BOOST jumper open**. The Adafruit reference allows at most 100 mA charging; obtain the actual 301230 pack's permitted charge rate before using that alternative. A matching pouch dimension does not establish charging compatibility.

Check diode cathodes toward row nets, socket solder joints and every key before installing the case. The pin map and zero ERC result do not prove the actual modules, charging, BLE, sleep current or display wake work. Record those observations in the [hardware acceptance checklist](build.md#hardware-acceptance).

## Reproduce the checks and exports

Run from the repository root with KiCad 10.0.6 and its Python module. On macOS:

```sh
KICAD_PY=/Applications/KiCad/KiCad.app/Contents/Frameworks/Python.framework/Versions/Current/bin/python3
"$KICAD_PY" tools/check_routed_pcb.py
python3 tools/export_fabrication.py
python3 tools/export_editions.py      # needs tools/requirements-silkscreen.txt
python3 tools/check_layout.py
```

On other systems, use a Python runtime that can import `pcbnew`, and pass `--cli /path/to/kicad-cli` when needed. The geometry comparison needs the baseline commit in local Git history; use a full clone. The checker rejects unrouted boards, altered geometry, mismatched physical pads and failed DRC/ERC/parity. It writes [routing evidence](../validation/revI-routing.json); the exporter refuses stale evidence and records [package hashes](../validation/revI-fabrication.json).

`build/routing-validation/` and `build/fabrication/` are ignored, reproducible outputs of these commands. Export timestamps can differ; the receipt identifies the actual generated bytes. The editable routed KiCad boards are the source for future edits. The earlier `prepare_routing.py`, `remap_right_mcu.py` and `complete_pcb_routes.py` are migration helpers, not required to rebuild the fabrication package. Do not run an old placement generator over routed work.

The routing history used Freerouting 2.4.1 with internal cutout routing reserves, followed by local clearance repair and independent KiCad checks. Approval and bounds are recorded in the [build continuation](reviews/2026-10-08-build-continuation.md).
