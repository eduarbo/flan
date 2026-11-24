# Build status

**Start here:** [first Flan36 build, purchasing sequence and blank acceptance record](first-build.md). For another size, use its own PCBs/firmware and the [per-size quantities](parts.md#quantities-by-size); test every key of that size.

The current design is a routed digital prototype. [Gerber/drill packages and ordering instructions](electronics.md#order-the-two-pcbs) and [compiled UF2 firmware](firmware.md) are available. Both boards pass DRC, ERC and schematic parity with no disconnected nets. The [purchasing BOM](parts.md) specifies the supplied nice!view connector and exact Mill-Max controller sockets/pins. Printed fit, retention and electrical operation have not been physically qualified.

The intended sequence is:

1. Use the selected BOM and inspect the delivered components, dimensions and battery polarity.
2. Print the [M2 thread coupon](../mechanical/revI/coupon-m2-thread.stl) and three KLP Lamé samples. Check screw grip, stem fit, return and comfort before printing the full set.
3. Order the matching left and right prototype PCB packages. Solder the small parts, then sockets/connectors using the heights below; check continuity and polarity before fitting either controller.
4. Follow the [firmware guide](firmware.md) to flash each half and test all keys of the selected size, combinations, layers and key releases.
5. Install the supported battery, controller, display and frames without loading the pouch or glass.
6. Verify BLE, charging, sleep/wake and measured power use.

PLA Basic and PETG HF are available for prototype trials; ABS is another case material. No filament/profile is qualified for the final parts yet. Print orientation and stem tolerances need physical tests. [Parts and alternatives](parts.md).

## Install the selected connectors

Cut the Mill-Max **315-43-164-41-003000** 64-position strip into **four 12-contact strips**, allowing sacrificial contacts at the cuts. Use **48 of the 50 supplied 3320-0-00-15-00-00-03-0 round pins**. The 6.35 mm pin length is not the installed board separation: hold the controller level on its printed support before soldering, with its PCB underside at **Z8.20 mm**, **2.80 mm above the main PCB top at Z5.40 mm**. Inspect seating, engagement and insulation before power-up.

Use the **5 mm socket and 2 mm header supplied with each nice!view**. The display PCB underside is **Z12.40 mm**, giving **7.00 mm** board separation; its glass top is **Z14.30 mm** under the **Z14.50 mm** frame and Level roof. Insert the male header's short solder tails into the display and its long mating posts into the socket. Trim **only free solder tails** to at most **0.30 mm above the display PCB**, with a **0.50 mm maximum joint envelope**; keep the mating posts intact. The socket's free tails may protrude at most **1.00 mm below the main PCB**. Inspect for solder bridges and test frame clearance before final assembly.

## Inspect the layout now

`design/layout.json` contains each half’s 18 key centers and angles in millimeters. They are Piantor's key positions and angles, translated per half without change; the pinned Piantor boards under `sources/` and [ATTRIBUTION.md](../ATTRIBUTION.md) record that provenance. The PCBs, case outline and the rest of the CAD are Eduardo Ruiz's original design.

```sh
python3 tools/check_layout.py
python3 tools/build_variants.py      # needs Shapely
```

The checker compares all 36 positions/rotations with the original boards. `build_variants.py` regenerates the [family layouts](variants.md) and their drawings in `docs/images/variants/`. `sources/piantor/` contains the original **wired** reference boards, not Flan36’s wireless PCB designs.

## Display frame and service

The frame is cosmetic and removable. It has no magnets or clips: for now it rests over the display, loose, and a frame that holds on to the display is being redesigned. The five internal structural screws per half keep the PCB and battery cage secured when the frame is lifted. Do not use the frame as a carrying handle.

On the printer this was tested with (Bambu Lab X2D, 0.4 mm nozzle, PLA) the M2 screws cut their own thread in the printed Ø2.1 mm pilots. Print the [M2 thread coupon](../mechanical/revI/coupon-m2-thread.stl) first. If the screw will not start, clear the hole with a 2 mm drill or an M2 tap; if it turns without gripping, reprint the sample with −0.1 mm X-Y hole compensation. Drive each screw straight and stop when the head seats; do not overtighten. Cases printed from files before 2026-11-24 have Ø1.7 mm pilots, which need an M2 tap, and magnet pockets that are no longer used.

For the nominal assembly, seat the open-bottom locator, cell directly on the **1.4 mm case floor**, and cage before lowering the PCB over the cell. The cage’s wider feet remain below the board. Install the three plate spacers and structural screws, then the removable modules and frame. Do not compress the pouch. Actual lead exit and strain relief remain to be qualified.

Fit the **eight Essentra RBS-5BK adhesive feet** on the external case underside, clear of reset access and screw holes. Their 1.6 mm height changes the external height only, not the internal assembly datums.

**Battery plug and switch.** JST PH plugs are not wired to one standard. The Typeractive 301230 measured on 2026-11-23 arrived reversed for J1 (−3.95 V between pad 1 and pad 2); its two wires were swapped in the plug. Measure every battery before connecting it: pad 1 of J1 is BAT+. SW1 connects the battery when its lever is toward its pad 1: toward the USB end on the right half, confirmed on a built keyboard (4.20 V on, 0 V off), and toward the thumb keys on the left half, from the board layout.

Use the selected **Olimex KAPTON-TAPE10MM** for local electrical isolation, keeping connector contacts accessible and avoiding pressure on the battery pouch. The printed cage provides retention. The **Adafruit 4199 USB-C to USB-C data cable** connects directly to a USB-C computer for firmware transfer and charging; one cable serves both halves in sequence. Check that the plug seats fully without forcing the case.

For service, power off and disconnect USB first. Lift the display frame and use the [inherited nominal removal sequence](slim-flush.md) to expose and unplug the battery connector. Remove the caps, then the three plate screws and plate/Level upper shell, then the two short PCB screws and PCB before withdrawing the captured cage. Lifting the frame alone does not release the battery. Cable flex, connector grip and actual removal still need a physical trial. Reset is operated from the underside with a small tool through the recessed access hole.

The [historical support study](slim-mount-study.md) records why the earlier closed cable tunnels prevented display/sled removal. The [current Level stack](level-stack.md) retains the open-bottom support relief and lowered battery routes. The supplied 7.00 mm display connector puts the glass at **14.30 mm**, recessed 0.20 mm beneath the **14.50 mm** frame/shell plane. It supersedes the lower Samtec study without changing the battery, controller, key positions or PCB. Digital checks do not qualify bending forces or real terminal tolerances.

## Hardware acceptance

No item below has been physically accepted. Record the supplied part number, measurement or observation rather than checking an item from a CAD image.

| Test | Acceptance evidence |
|---|---|
| Actual parts | Selected Adafruit 1570 envelope, protection wrapping, lead exit and polarity; specified controller/display connector seating and installed heights |
| Printed interfaces | Choc stem/return, screw grip in the Ø2.1 mm pilots, frame fit over the display and battery service without pouch or glass loading |
| Bare assembly | Continuity, no power short, diode orientation and all switches of the selected size without stuck/reversed keys |
| Firmware and displays | Correct half images, four layers, simultaneous keys, both screens or selected single-screen option, reset and wake recovery |
| Wireless operation | Pairing, reconnect after power cycle, sleep/wake and usable range in the complete case |
| Charging and power | Correct cell charge limit and polarity, SW1 behavior, measured active/idle/sleep current and no abnormal heating |

The next physical step is to measure the exact connector pair and supplied cell, then print the M2 thread coupon and the keycap samples. The source and firmware candidates can be revised from those results without changing the key layout.
