# Firmware

Flan36 uses **ZMK v0.3.0**, pinned to `edf5c0814fd3ea202e43aad2d68fd32e882a518c`, on genuine **nice!nano v2** controllers with the standard UF2 bootloader. These files have been compiled and checked against the electrical matrix; flashing, radio operation and power use still need hardware tests.

| Download | Role | Display |
|---|---|---|
| [Left UF2](../firmware/uf2/flan36-left.uf2) | Central: connects to the computer | nice!view |
| [Right UF2](../firmware/uf2/flan36-right.uf2) | Peripheral: connects to the left half | nice!view |
| [Right UF2 without display](../firmware/uf2/flan36-right-no-display.uf2) | Peripheral, optional single-screen build | None |

Use one right-hand file. Both right variants use the same PCB pinout. USB on the right supports charging and bootloader access; the left half provides the keyboard's USB connection to the computer.

## Keymap

The [editable keymap](../firmware/config/flan36.keymap) has four layers. The physical order is left-to-right across the complete keyboard, including the six thumb keys. F and J correspond to the homing caps in the CAD.

- **Base:** QWERTY; left thumbs Ctrl/Esc, Numbers, Shift/Space; right thumbs Shift/Enter, Symbols, GUI/Backspace. Slash-separated keys tap the second function and hold the first.
- **Numbers:** digits, navigation, F1–F10.
- **Symbols:** punctuation, Alt/Delete, F11/F12 and volume.
- **Settings:** hold Symbols, then the Numbers thumb. Top row selects Bluetooth profiles 1–5, clears the active profile, selects BLE or USB, enters bootloader, or resets.

Sleep starts after 15 minutes; idle begins after 30 seconds. The scan matrix uses interrupts and supports waking by keypress. RGB, backlight and USB logging are disabled. Each display uses ZMK's official nice!view driver and status widget. The right display reports its local peripheral status; the left is not configured to proxy the right battery level.

## Wiring contract

| Function | Pro Micro labels | nRF52840 pins |
|---|---|---|
| Left rows 0–3 | D2, D3, D4, D5 | P0.17, P0.20, P0.22, P0.24 |
| Right rows 0–3 | D21, D20, D19, D18 | P0.31, P0.29, P0.02, P1.15 |
| Left column 0 / right column 0 | D6 / D15 | P1.00 / P1.13 |
| Both columns 1–5 | D7, D8, D9, D10, D16 | P0.11, P1.04, P1.06, P0.09, P0.10 |
| Display MOSI / SCK / CS | D1 / D0 / D14 | P0.06 / P0.08 / P1.11 |

The matrix has 18 populated positions per half. Electrical column 0 holds one thumb; it is not a sixth physical finger column. Diode cathodes connect to rows (`col2row`). The halves use different MCU pins to route around the battery opening without changing the case. The right transform reverses the visual key order. The [per-half pin map](../design/pinmap.json) is checked against both compiled firmware and PCB pads.

Flan36 defines its own `nice_view_spi`; **do not add `nice_view_adapter`**, whose default pins conflict with this matrix. Display CS is active high. UART and competing I²C/SPI controllers are disabled. The standard nice!nano bootloader configures the two NFC-capable pins used by columns 4/5 as GPIO; a clone or different bootloader must establish that independently.

## Family variants

Each [Flan variant](variants.md) has its own ZMK shield, generated from `design/variants.json` by `tools/build_variant_firmware.py`, with Flan36's pins, display and settings. The outer pinky column uses matrix column 0, which is already wired for thumb K30. The number row is matrix row 4 on the pin recorded for each variant in `design/pinmap.json`.

| Variant | Left | Right | Right without display | Added keys on the base layer |
|---|---|---|---|---|
| **Flan42** | [UF2](../firmware/uf2/flan42-left.uf2) | [UF2](../firmware/uf2/flan42-right.uf2) | [UF2](../firmware/uf2/flan42-right-no-display.uf2) | Tab, Ctrl, Shift on the left; Backspace, ', Esc on the right |
| **Flan46** | [UF2](../firmware/uf2/flan46-left.uf2) | [UF2](../firmware/uf2/flan46-right.uf2) | [UF2](../firmware/uf2/flan46-right-no-display.uf2) | 1–0 on the number row |
| **Flan54** | [UF2](../firmware/uf2/flan54-left.uf2) | [UF2](../firmware/uf2/flan54-right.uf2) | [UF2](../firmware/uf2/flan54-right-no-display.uf2) | Flan42's outer column plus ` 1–0 - on the number row |

Each keymap is Flan36's with the added keys filled in: [Flan42](../firmware/config/flan42.keymap), [Flan46](../firmware/config/flan46.keymap), [Flan54](../firmware/config/flan54.keymap). On Numbers the number row carries F1–F10, with F11 and F12 on Flan54's outer keys; the outer column is transparent on Numbers and Symbols, and every added key is unused on Settings. The number row is matrix row 4 on D15 (left) and D6 (right), the pins its PCBs route. Receipts: [Flan42](../validation/flan42-firmware.json), [Flan46](../validation/flan46-firmware.json), [Flan54](../validation/flan54-firmware.json). Flash a variant's files only onto that variant's PCBs.

For a personal variant, follow [Build personal firmware](#build-personal-firmware). Maintainers can regenerate and qualify a variant using the official environment below:

```sh
python3 tools/build_variant_firmware.py
sh tools/build_firmware.sh flan42-left flan42-right flan42-right-no-display      # likewise flan46-*, flan54-*
python3 tools/check_firmware.py --zephyr "$FLAN36_ZMK_WORKSPACE/zephyr" --keyboard flan42 --publish
```

## Build personal firmware

To change a keymap or compile for your own boards, use ZMK's normal `west build` with an Arm bare-metal toolchain. This path writes your UF2 files under `build/personal/`. The published binaries, their build records and the qualification check remain separate.

### Prepare a new workspace

Start at the root of a Flan checkout. Install Git, Python 3.12, CMake, and the [Arm GNU Toolchain for your host](https://developer.arm.com/tools-and-software/gnu-toolchain) targeting `arm-none-eabi`. Add its `bin` directory to `PATH`. Arm GNU Toolchain 15.3.Rel2 was tested on Apple Silicon. Use an empty destination for the ZMK workspace. The commands use a POSIX shell.

```sh
export FLAN36_REPO="$PWD"
export FLAN36_ZMK_WORKSPACE="$(dirname "$PWD")/flan-zmk-workspace"
python3.12 -m venv "$FLAN36_REPO/build/west-env"
. "$FLAN36_REPO/build/west-env/bin/activate"
python -m pip install west==1.5.0 ninja
git init "$FLAN36_ZMK_WORKSPACE"
git -C "$FLAN36_ZMK_WORKSPACE" remote add origin https://github.com/zmkfirmware/zmk.git
git -C "$FLAN36_ZMK_WORKSPACE" fetch --depth=1 origin edf5c0814fd3ea202e43aad2d68fd32e882a518c
git -C "$FLAN36_ZMK_WORKSPACE" checkout --detach FETCH_HEAD
west init -l "$FLAN36_ZMK_WORKSPACE/app"
cd "$FLAN36_ZMK_WORKSPACE"
west config --local manifest.file "$FLAN36_REPO/firmware/west-frozen.yml"
west manifest --validate
west update --narrow
python -m pip install -r zephyr/scripts/requirements-base.txt
```

If you already have a local cache of these same repositories, `west update --narrow --path-cache /absolute/path/to/cache` reuses Git objects during initialization. West checks out the revisions in the frozen manifest.

### Compile both halves

From the ZMK workspace, with the environment above active, set `size` to `flan36`, `flan42`, `flan46` or `flan54`. Each board uses its own shield. For a right half without a display, build the third file.

```sh
size=flan36
export ZEPHYR_TOOLCHAIN_VARIANT=cross-compile
export CROSS_COMPILE="$(dirname "$(command -v arm-none-eabi-gcc)")/arm-none-eabi-"
export ZEPHYR_BASE="$FLAN36_ZMK_WORKSPACE/zephyr"
out="$FLAN36_REPO/build/personal"
config="$FLAN36_REPO/firmware/config"
west build -p always -s app -b nice_nano_v2 -d "$out/$size-left" -- \
  "-DSHIELD=${size}_left nice_view" "-DZMK_CONFIG=$config"
west build -p always -s app -b nice_nano_v2 -d "$out/$size-right" -- \
  "-DSHIELD=${size}_right nice_view" "-DZMK_CONFIG=$config"
west build -p always -s app -b nice_nano_v2 -d "$out/$size-right-no-display" -- \
  "-DSHIELD=${size}_right" "-DZMK_CONFIG=$config" "-DEXTRA_CONF_FILE=$config/no-display.conf"
ls "$out"/"$size"-*/zephyr/zmk.uf2
```

Each UF2 belongs to the board size and half in its directory name. The [notices for redistribution](../firmware/NOTICE.md) identify ZMK, Zephyr and the other included software.

## Reproduce an official candidate

The checked-in UF2 files use GCC ARM 15.2.0 on macOS with compiler SHA-256 `7528680ad6078c1d2dd67a414fca656e5d78e56e7bc31f422a849bb15a7db04a`. To run the maintainer checks with that compiler, use the pinned workspace above and put the qualified toolchain on PATH:

```sh
cd "$FLAN36_REPO"
export CROSS_COMPILE="$(dirname "$(command -v arm-none-eabi-gcc)")/arm-none-eabi-"
sh tools/build_firmware.sh
python3 tools/check_firmware.py --zephyr "$FLAN36_ZMK_WORKSPACE/zephyr"
```

The maintainer checker writes a new candidate record under `validation/` even when run without `--publish`. Run it in a clean release checkout and review the record. Add `--publish` only when replacing the official binaries. The personal workflow above writes only to `build/personal/`.

The script expects the pinned ZMK checkout at `app/` and Zephyr at `zephyr/`, both clean. All active dependencies must match the pinned list and be clean. This version uses target `nice_nano_v2`; newer ZMK targets differ. The checker reads the actual compiled devicetrees, all 36 mappings, GPIO assignments, roles, sleep settings and every UF2 block. Before and after each build, the script records and compares sources, dependencies and compiler inputs. The checker requires that build-time attestation and verifies every output hash before copying any file. It records [source and binary hashes](../validation/revI-firmware.json).

`python3 tools/test_firmware_binding.py --zephyr "$FLAN36_ZMK_WORKSPACE/zephyr"` checks, in an isolated copy, that a changed key binding or altered binary is rejected without changing published files. Build products in `build/firmware-*` regenerate with these commands. [Dependency notices](../firmware/NOTICE.md).

## First hardware test

1. Verify battery connector polarity and inspect the assembled PCB for shorts before applying power. Keep the nice!nano **BOOST jumper open**: the selected small cells must not use its 500 mA charge mode.
2. Connect a USB data cable, double-tap reset and copy the matching UF2 to the bootloader drive. Do each half separately.
3. Power both halves, select profile 1 and pair the selected **Flan** size with the computer. Verify all 36/42/46/54 keys for that size and layer/thumb functions, including simultaneous presses and releases. Keep the [first-build record](first-build.md).
4. Check both displays, reset recovery, BLE reconnection, sleep/wake and measured current with the final assembled case. Repeat wake testing with both displays installed.
5. For charging, SW1 must connect the cell. With USB attached, opening SW1 disconnects the cell from charging but does not necessarily turn off the controller. Confirm the actual pack's permitted charge current before connecting it.

No real device has been flashed or electrically qualified by these build checks.

Sources: [nice!nano installation](https://nicekeyboards.com/docs/nice-nano/getting-started/), [nice!view pinout](https://nicekeyboards.com/docs/nice-view/pinout-schematic/), [ZMK v0.3.0](https://github.com/zmkfirmware/zmk/releases/tag/v0.3.0), [matrix configuration](https://zmk.dev/docs/config/kscan).
