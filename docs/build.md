# Build status

**Start here:** [first Flan36 build, purchasing sequence and blank acceptance record](first-build.md). For another size, use its own PCBs/firmware and the [per-size quantities](parts.md#quantities-by-size); test every key of that size.

The current design is a routed digital prototype. [Gerber/drill packages and ordering instructions](electronics.md#order-the-two-pcbs) and [compiled UF2 firmware](firmware.md) are available. Both boards pass DRC, ERC and schematic parity with no disconnected nets. The [purchasing BOM](parts.md) specifies the supplied nice!view connector and exact Mill-Max controller sockets/pins. Printed fit, retention and electrical operation have not been physically qualified.

The intended sequence is:

1. Use the selected BOM and inspect the delivered components, dimensions and battery polarity.
2. Print the three magnetic/thread coupons below and three KLP Lamé samples. Check stem fit, return and comfort before printing the full set.
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

## Magnetic frame and service

The frame is cosmetic and removable. The five internal structural screws per half keep the PCB and battery cage secured when the frame is lifted. Its three small locator lips resist sliding; magnets provide attraction. Do not use the frame as a carrying handle before retention is measured.

1. **Try the glue-in samples first.** Print the [base socket](../mechanical/glue-in/revI/coupon-magnet-base.stl) floor down with thin-wall detection enabled for its centering lip, and the [frame socket](../mechanical/glue-in/revI/coupon-magnet-frame.stl) top face down. Their openings face the nozzle and remain accessible after printing. The [M2 thread coupon](../mechanical/revI/coupon-m2-thread.stl) checks the screw fit.
2. **Dry-fit and mark one attracting pair.** Each base takes three axial Ø2 × 3 mm magnets from above. Each installed frame takes three axial Ø2 × 4 mm magnets from underneath. Use the same exposed pole in every base and the opposite exposed pole in every frame. Check attraction in the assembled position.
3. **Glue after printing, before installing electronics.** Use a small amount of adhesive compatible with your printed plastic and magnet coating. Seat each magnet against the blind end. Wipe the mating surfaces and let the parts cure separately for the time on the adhesive label. Supermagnete advises against conventional superglue for its coated neodymium magnets. [Manufacturer guidance](https://www.supermagnete.de/eng/Magnet-applications/Create-your-own-glass-magnets)
4. **Check seating and retention.** The base bore is Ø2.30 mm and the frame bore is Ø2.20 mm. The dry, fully seated magnet faces have a nominal 1.10 mm gap. Try the coupons, then check a full frame for peel, sliding and repeated removal. The physical bond and holding force still need testing.

The [configurator](https://flankbd.com/explore/#build-print) exports glue-in sockets. The original revision I STEP and FreeCAD files retain their enclosed magnet pockets.

5. **Tap and test the M2 pilot:** use an M2 tap in the Ø1.7 mm printed hole, then test the specified screw without bottoming or stripping. Do not assume the screws are self-tapping.

For the nominal assembly, seat the open-bottom locator, cell directly on the **1.4 mm case floor**, and cage before lowering the PCB over the cell. The cage’s wider feet remain below the board. Install the three plate spacers and structural screws, then the removable modules and frame. Do not compress the pouch. Actual lead exit and strain relief remain to be qualified.

Use **three Ø2 × 4 mm axial magnets per frame**, paired with the three Ø2 × 3 mm base magnets. Both halves use twelve magnets from existing stock; each additional pair of frames needs six more Ø2 × 4 mm magnets. Fit the **eight Essentra RBS-5BK adhesive feet** on the external case underside, clear of reset access and screw holes. Their 1.6 mm height changes the external height only, not the internal assembly datums.

Use the selected **Olimex KAPTON-TAPE10MM** for local electrical isolation, keeping connector contacts accessible and avoiding pressure on the battery pouch. The printed cage provides retention. The **Adafruit 4199 USB-C to USB-C data cable** connects directly to a USB-C computer for firmware transfer and charging; one cable serves both halves in sequence. Check that the plug seats fully without forcing the case.

For service, power off and disconnect USB first. Lift the magnetic frame and use the [inherited nominal removal sequence](slim-flush.md) to expose and unplug the battery connector. Remove the caps, then the three plate screws and plate/Level upper shell, then the two short PCB screws and PCB before withdrawing the captured cage. The magnetic cover alone does not release the battery. Cable flex, connector grip and actual removal still need a physical trial. Reset is operated from the underside with a small tool through the recessed access hole.

The [historical support study](slim-mount-study.md) records why the earlier closed cable tunnels prevented display/sled removal. The [current Level stack](level-stack.md) retains the open-bottom support relief and lowered battery routes. The supplied 7.00 mm display connector puts the glass at **14.30 mm**, recessed 0.20 mm beneath the **14.50 mm** frame/shell plane. It supersedes the lower Samtec study without changing the battery, controller, key positions or PCB. Digital checks do not qualify bending forces or real terminal tolerances.

## Hardware acceptance

No item below has been physically accepted. Record the supplied part number, measurement or observation rather than checking an item from a CAD image.

| Test | Acceptance evidence |
|---|---|
| Actual parts | Selected Adafruit 1570 envelope, protection wrapping, lead exit and polarity; specified controller/display connector seating and installed heights |
| Printed interfaces | Choc stem/return, screw engagement, glued base/frame magnet retention and paired polarity, frame peel/sliding and battery service without pouch or glass loading |
| Bare assembly | Continuity, no power short, diode orientation and all switches of the selected size without stuck/reversed keys |
| Firmware and displays | Correct half images, four layers, simultaneous keys, both screens or selected single-screen option, reset and wake recovery |
| Wireless operation | Pairing, reconnect after power cycle, sleep/wake and usable range in the complete case |
| Charging and power | Correct cell charge limit and polarity, SW1 behavior, measured active/idle/sleep current and no abnormal heating |

The next physical step is to measure the exact connector pair and supplied cell, then print the small fit/retention coupons. The source and firmware candidates can be revised from those results without changing the key layout.
