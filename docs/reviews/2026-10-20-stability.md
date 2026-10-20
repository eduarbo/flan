# Stability audit · 2026-10-20

**Digital candidate for a first Flan36 build. Physical acceptance remains pending.** The audit covers all four Flan sizes. It starts from clean source commit `541e2975942cbd2368f3de35701b0d5a6c9feab7` and preserves PCB geometry, pinout, firmware binaries and saved configurations.

| Requested result | Evidence / acceptance |
|---|---|
| Current design and fabrication files agree | Layout comparison passes. Fresh KiCad checks pass for eight boards: DRC/ERC/parity/unconnected all zero. Twelve compiled firmware candidates pass mappings, roles, displays, sleep and UF2 validation. `check_build_candidate.py` checks 56 PCB ZIPs and twelve shipped UF2s against source hashes and recorded exports. |
| Stable home and explorer | Network-failure/retry, overlapping size selection and actual print downloads are covered by `viewer/stability-check.cjs`; desktop/mobile home and shared look by `viewer/home-check.cjs`. Configuration contract checks cover 150 fixtures, twelve family presets and an added-key-only collision rejection. |
| Build and ordering preparation | [First-build guide](../first-build.md), [dated supplier check](../parts.md#supply-check-2026-10-20), exact screw references, a complete configuration-bound ZIP and an unfilled physical acceptance record. |
| Honest marketing material | [Introduction kit](../launch.md); English/Spanish home copy says tests are pending, alternative cell fit is nominal, and 14.50 mm measures frame/Level roof height without feet/keycaps. |
| Attributable delivery | Normal synchronization to the existing `eduarbo/flan` main; the delivered commit is identified by Git. The local first-build manifest identifies its exact source and bundled hashes. |

Machine-readable [audit evidence](../../validation/revI-stability.json) binds the tested source and generated pages.

## Corrections and review

Two independent read-only reviews, using constructive and adversarial lenses, agreed on bounded digital stabilization with physical qualification left open. Both found a high-severity fallback: during a pending/failed larger-size load, configuration identity could disagree with Flan36 fabrication/print resources. The fix uses requested size for links and awaits that size for geometry exports. A failing request remains retryable. The regression test rejects wrong-size output and stale selection responses.

The added-key validation gap was confirmed with a negative control that is valid at 36 keys but collides at an added Flan42 key. Both JavaScript and Python now reject it. Marketing wording, fixed-36 acceptance text and obsolete ROW4 prose were corrected. Original status strings in `design/variants.json` remain the layout generator's historical snapshot, as explicitly documented in [variants](../variants.md); changing those firmware-bound inputs would require unrelated binary rebuilds.

Current native CAD and exported mesh bytes match the retained mechanical receipts. CAD geometry was not regenerated in this audit. `tools/keycap_config.py` has changed since that export to validate family positions; the candidate report exposes this generation-tool difference. This does not certify new physical fit or retroactively change historical CAD evidence.

## Reproduction

Run from the repository root with the existing pinned project dependencies:

```sh
python3 tools/check_layout.py
node viewer/config-contract-check.cjs
node viewer/build.mjs
node viewer/home-check.cjs
node viewer/stability-check.cjs
python3 tools/check_build_candidate.py
python3 tools/prepare_first_build.py --print-kit build/stability-check/Flan36-both-complete.zip
```

Set `FLAN36_PLAYWRIGHT_MODULE` and `FLAN36_BROWSER` to the installed Playwright/Chromium if needed. `FLAN36_BROWSER_ANGLE=metal` selects the macOS GPU backend for the stability check. Fresh board checks use KiCad's Python runtime with `tools/check_routed_pcb.py` and `--variant flan42|flan46|flan54`; the base defaults to Flan36. Firmware checks use `tools/check_firmware.py --zephyr PATH` with `--keyboard` for the other sizes, as documented in [firmware](../firmware.md).

`build/` remains ignored: test reports, screenshots, downloaded kits and the frozen first-build ZIP regenerate with these commands. The ZIP checker reads back every archived hash. Reports distinguish digital evidence from physical acceptance. No printer profile, G-code or material strength is qualified.

## Remaining acceptance

The owner supplies parts and the first hands-on results using [the nine gates](../first-build.md#acceptance-sequence): dimensions/polarity, printed samples, continuity, USB, every key/layer, charging/current, BLE/wake, complete case/retention and sustained use. Assembly support and correction of failures remain part of the keyboard objective. Public introduction can describe the digital prototype; a working-unit claim requires those results. No order, paid campaign, message or release was performed by this audit.
