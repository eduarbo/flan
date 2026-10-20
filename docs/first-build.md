# First Flan36 build

**Build one Flan36 prototype first.** The digital candidate is for manual qualification; a working keyboard and a sale-ready kit still require the results below. [Parts and supplier links](parts.md) · [Assembly](build.md) · [Firmware](firmware.md) · [Marketing material](launch.md).

## Order in two stages

1. **Components and fit samples.** Use the exact [Typeractive](parts.md#typeractive-shopping-list), [DigiKey](parts.md#digikey-shopping-list) and [fastener](parts.md#fasteners-cable-and-tools) selections. Measure the received cell, connectors and magnets. Print the three keycap samples and the three magnetic/thread coupons before committing to the complete case. Use the twelve magnets already in stock.
2. **Prototype boards and complete prints.** Order one left design and one right design using the [PCB settings](electronics.md#order-the-two-pcbs). A fabricator's minimum lot may give spare boards; these are two different jobs, not two copies of one board. Choose one silkscreen edition for both. Keep the downloaded ZIPs, UF2s and configuration together. Print the switch plates first and check switch seating/retention; continue with the remaining complete kit only after sample fit passes.

For Flan36 the purchase quantities are: 2 nice!nano v2, 2 nice!view with their supplied connectors, 40 Pro Red Choc v1 switches, 40 Choc sockets, 40 diodes, 2 white battery jacks, 2 Adafruit 1570 cells, 2 PCM12SMTR power switches, 2 TL3342F160QG/TR reset switches, one 64-contact Mill-Max strip, 50 round pins, 6 M2 × 6 low-head screws, 4 M2 × 4 ultra-low-head screws and 8 feet. The [BOM](parts.md) includes the exact references, data cable, tape and tools.

**Supply check, 2026-10-20:** Typeractive's product data marked all six selected lines available; its selected subtotal was **US$128** before shipping/tax. DigiKey listed the selected cell, power/reset switches, 64-contact strip and round pins in stock. PCM12SMTR remains obsolete: this stock supports prototyping, not a long-term supply promise. NBK lists the matching screw packs; their dispatch date and the final delivered total require checkout. No order has been placed. [Dated buying details](parts.md#supply-check-2026-10-20).

## Keep one build record

Copy this section into your build notes. Leave results **NOT TESTED** until measured. Attach photos of assembly and the exact configuration JSON; screenshots of the CAD do not count as a physical result.

| Identity | Record |
|---|---|
| Build ID / date / tester | |
| Size / PCB revision / edition / source commit | Flan36 / revI / ___ / ___ |
| Case / frame / cap preset / configuration filename | |
| Left/right PCB ZIP filenames + SHA-256 | |
| Left/right UF2 filenames + SHA-256 | |
| Print-kit filename + SHA-256 | |
| Printer / material / nozzle / layer height / slicer version | |
| Actual cell / switches / connectors / magnet sizes and grade | |

Use `shasum -a 256 FILE` to record a downloaded file. Preserve this candidate with the test results; do not mix a later PCB revision into the same record.

## Acceptance sequence

| Gate | Procedure and pass condition | Result / evidence |
|---|---|---|
| 1. Supplied parts | Record cell dimensions including wrapping, connector polarity and charge limit. Measure controller support at Z8.20 mm and display underside at Z12.40 mm. Parts seat without force or pouch/glass loading. | NOT TESTED |
| 2. Printed samples | Three cap samples seat, return through full travel and detach without splitting. M2 pilot taps and retains its specified screw without bottoming. Both magnet coupons capture the measured magnets with opposite mating polarity. | NOT TESTED |
| 3. Unpowered PCB | Inspect bridges, diode bands, socket orientation and MCU/display orientation. Verify intended continuity against the schematic and no sustained power-to-ground short. Battery remains unplugged; USB remains disconnected. | NOT TESTED |
| 4. USB bring-up | Keep BOOST open. With the cell disconnected, flash each genuine nice!nano with its matching half's UF2. Left USB reports the keyboard. Confirm both screens, reset/bootloader recovery and absence of unexpected heating. | NOT TESTED |
| 5. Keys and layers | Test each physical key independently for press **and release**; then chords, all four layers, tap/hold thumbs and profile keys. Record failures by side + PCB reference. Expected counts: 36, 42, 46 or 54 for the selected size. | NOT TESTED |
| 6. Battery / charging | Only after gates 1–4, connect the verified-polarity pack. Measure charge current within the actual pack's limit (selected Adafruit listing: ≤100 mA), SW1 operation and active/idle/sleep current. Record instrument, voltage and display mode. Stop on unexpected heating or cell damage. | NOT TESTED |
| 7. BLE and wake | Pair the left central; verify the right half. Repeat disconnect/reconnect and power-cycle recovery. After the configured 15-minute sleep, wake by keypress on each half; no stuck keys or lost pairing. Record host/OS, distance and failures. | NOT TESTED |
| 8. Complete case | USB plug and switch remain accessible; no rubbing caps, stressed glass or compressed pouch. Test frame peel/sliding, repeated removal, magnet capture and battery service. Record repetitions and observations; no carrying-handle claim. | NOT TESTED |
| 9. Real use | Use the assembled keyboard for a declared session, recording duration, battery voltage before/after, dropped/repeated keys and discomfort. Correct defects and repeat the affected gate before calling this unit accepted. | NOT TESTED |

For the reference layout, test K01–K05, K11–K15, K21–K25 and K30–K32 on **each half**. Larger variants add the references in [the family guide](variants.md); their acceptance does not follow automatically from a successful Flan36.

## What can be announced

Before acceptance, show the design, customization and documented prototype progress. Label renders as renders. After the recorded gates pass, publish actual photographs and measured results with their configuration and limits. Availability, price, runtime and delivery dates require separate evidence; do not infer them from the digital candidate.

The physical record remains with the builder. Report a failure with its build ID, gate, side/reference, measurement and photo so the next correction targets the actual defect.

## Freeze the files

The local first-build ZIP includes one complete Flan36 print kit, its configuration, matching PCB edition, three UF2 choices, three cap samples, the magnetic/thread coupons, guides and a SHA-256 manifest. It contains no printer profile or G-code. Print one of each cap sample first; the complete kit records final quantities.

Regenerate from the repository root after building the viewer:

```sh
node viewer/stability-check.cjs
python3 tools/prepare_first_build.py --print-kit build/stability-check/Flan36-both-complete.zip
```

Set `FLAN36_PLAYWRIGHT_MODULE`/`FLAN36_BROWSER` for your installed Playwright/Chromium when needed. Output: `build/first-build/Flan36-first-build.zip`. The script checks source-bound PCB/firmware, complete-kit size, STL bytes and every bundled file hash. The manifest records the source commit and whether local changes were present; preserve it with the measurements.
