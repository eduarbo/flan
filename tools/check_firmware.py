#!/usr/bin/env python3
"""Verify built devicetrees, all key positions and UF2 blocks before publishing.
SPDX-License-Identifier: GPL-3.0-or-later
"""
import argparse
import hashlib
import json
import re
import shutil
import struct
import sys
from pathlib import Path
from firmware_inputs import verify_attestation

ROOT = Path(__file__).resolve().parents[1]


PARTS = ("left", "right", "right-no-display")

def keyboard_keys(keyboard):
    """Physical key order (rows top to bottom, left half then right, each by x) and pins."""
    pinmap = json.loads((ROOT / "design/pinmap.json").read_text())
    pins = {s: dict(pinmap["halves"][s], rows=list(pinmap["halves"][s]["rows"])) for s in ("left", "right")}
    if keyboard == "flan36":
        halves, rows = json.loads((ROOT / "design/layout.json").read_text())["halves"], (0, 1, 2, 3)
    else:
        v = json.loads((ROOT / "design/variants.json").read_text())["variants"][keyboard]
        halves, rows = v["keys"], ((4, 0, 1, 2, 3) if v["number_row"] else (0, 1, 2, 3))
        if v["number_row"]:
            for s in pins:
                pins[s]["rows"].append(pinmap["variants"][keyboard][s]["row4"])
    order = []
    for row in rows:
        for side in ("left", "right"):
            for key in sorted((k for k in halves[side] if k["row"] == row), key=lambda k: k["x"]):
                order.append({"side": side, "ref": key["ref"], "row": row,
                              "column": key["col"] + (6 if side == "right" else 0)})
    if keyboard == "flan36":
        assert order == json.loads((ROOT / "design/key-order.json").read_text()) and len(order) == 36
    return order, pins

def verify(zephyr, publish=False, keyboard="flan36"):
    sys.path.insert(0, str(zephyr / "scripts/dts/python-devicetree/src"))
    from devicetree import dtlib
    def cells(prop):
        assert len(prop.value) % 4 == 0
        return list(struct.unpack(">" + "I" * (len(prop.value) // 4), prop.value))
    order, pins = keyboard_keys(keyboard)
    encoded = [(k["row"] << 8) + k["column"] for k in order]
    assert len(set(encoded)) == len(order)
    report = {"schema": "flan36-firmware-1", "keyboard": keyboard, "physical_acceptance": False,
              "zmk_revision": "edf5c0814fd3ea202e43aad2d68fd32e882a518c",
              "board": "nice_nano_v2", "keys": order, "variants": {}, "sources": []}
    builds = {(part if keyboard == "flan36" else f"{keyboard}-{part}"): part for part in PARTS}
    # Validate every input/output binding before touching any published artifact.
    attestations = {v: verify_attestation(v) for v in builds}
    for variant, part in builds.items():
        directory = ROOT / "build" / ("firmware-" + variant) / "zephyr"
        dt = dtlib.DT(str(directory / "zephyr.dts"))
        conf = dict(re.findall(r"^(CONFIG_\w+)=(.*)$", (directory / ".config").read_text(), re.M))
        central = part == "left"
        display = part != "right-no-display"
        assert (conf.get("CONFIG_ZMK_SPLIT_ROLE_CENTRAL") == "y") == central
        for name in ("ZMK_SPLIT", "ZMK_BLE", "ZMK_SLEEP", "ZMK_BATTERY_REPORTING"):
            assert conf.get("CONFIG_" + name) == "y", name
        for name in ("ZMK_RGB_UNDERGLOW", "ZMK_BACKLIGHT", "ZMK_USB_LOGGING"):
            assert conf.get("CONFIG_" + name, "n") == "n", name
        assert conf["CONFIG_ZMK_IDLE_SLEEP_TIMEOUT"] == "900000"
        assert (conf.get("CONFIG_ZMK_DISPLAY") == "y") == display
        transform = dt.label2node["default_transform"]
        assert transform.props["map"].to_nums() == encoded
        assert transform.props["columns"].to_num() == 12
        offset = transform.props.get("col-offset")
        assert (offset.to_num() if offset else 0) == (0 if central else 6)
        scan = dt.label2node["kscan0"]
        assert scan.props["diode-direction"].to_string() == "col2row"
        assert "wakeup-source" in scan.props
        rows = cells(scan.props["row-gpios"])
        cols = cells(scan.props["col-gpios"])
        pm = dt.label2node["pro_micro"].props["phandle"].to_num()
        side_pins = pins["left" if central else "right"]
        assert rows == sum(([pm, pin, 32] for pin in side_pins["rows"]), [])  # pull-down
        assert cols == sum(([pm, pin, 0] for pin in side_pins["cols"]), [])
        # Resolve the connector map, not just the Pro Micro aliases.
        mapping = cells(dt.label2node["pro_micro"].props["gpio-map"])
        gpio = {mapping[i]: (mapping[i+2], mapping[i+3]) for i in range(0, len(mapping), 5)}
        gp0 = dt.label2node["gpio0"].props["phandle"].to_num()
        gp1 = dt.label2node["gpio1"].props["phandle"].to_num()
        assert gpio[0] == (gp0, 8) and gpio[1] == (gp0, 6) and gpio[14] == (gp1, 11)
        used = [gpio[n] for n in [0, 1, 14, *side_pins["rows"], *side_pins["cols"]]]
        assert len(set(used)) == len(used)
        for bus in ("uart0", "i2c0", "spi1"):
            assert dt.label2node[bus].props["status"].to_string() == "disabled", bus
        if display:
            spi = dt.label2node["nice_view_spi"]
            assert spi.props["status"].to_string() == "okay"
            assert cells(spi.props["cs-gpios"]) == [pm, 14, 0]
            for label in ("slim_spi_default", "slim_spi_sleep"):
                group = dt.label2node[label].nodes["group1"]
                assert group.props["psels"].to_nums() == [0x40008, 0x50006]
            assert "low-power-enable" in dt.label2node["slim_spi_sleep"].nodes["group1"].props
            screen = dt.label2node["nice_view"]
            assert [screen.props[x].to_num() for x in ("width", "height")] == [160, 68]
            assert screen.props["spi-max-frequency"].to_num() == 1000000
            widget = "status.c.obj" if central else "peripheral_status.c.obj"
            assert any(directory.rglob(widget))
        else:
            assert "nice_view" not in dt.label2node
        data = (directory / "zmk.uf2").read_bytes()
        assert data and len(data) % 512 == 0
        start, length = dt.label2node["code_partition"].props["reg"].to_nums()
        addresses = []
        for i in range(0, len(data), 512):
            block = data[i:i+512]
            a, b, flags, address, size, number, count, family = struct.unpack("<8I", block[:32])
            assert (a, b, struct.unpack("<I", block[-4:])[0]) == (0x0A324655, 0x9E5D5157, 0x0AB16F30)
            assert family == 0xADA52840 and flags & 0x2000
            assert number == i // 512 and count == len(data) // 512 and size == 256
            assert start <= address and address + size <= start + length
            addresses.append(address)
        assert addresses == list(range(0x26000, 0x26000+len(addresses)*256, 256))
        report["variants"][variant] = {"role": "central" if central else "peripheral",
            "display": display, "matrix_positions": len(order), "sleep": True,
            "uf2_bytes": len(data), "uf2_sha256": hashlib.sha256(data).hexdigest(),
            "devicetree_sha256": hashlib.sha256((directory / "zephyr.dts").read_bytes()).hexdigest(),
            "config_sha256": hashlib.sha256((directory / ".config").read_bytes()).hexdigest()}
        report["variants"][variant]["build_attestation"] = attestations[variant]
    for path in sorted((ROOT / "firmware/config").rglob("*")):
        if path.is_file():
            report["sources"].append({"path": str(path.relative_to(ROOT)), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    if publish:
        dest = ROOT / "firmware/uf2"; dest.mkdir(exist_ok=True)
        for variant, part in builds.items():
            shutil.copyfile(ROOT / "build" / ("firmware-" + variant) / "zephyr/zmk.uf2", dest / f"{keyboard}-{part}.uf2")
    receipt = "revI-firmware.json" if keyboard == "flan36" else f"{keyboard}-firmware.json"
    (ROOT / "validation" / receipt).write_text(json.dumps(report, indent=2) + "\n")
    print(f"PASS: {keyboard}: 3 UF2 variants, {len(order)} physical positions, roles, GPIO, displays and sleep configuration")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--zephyr", type=Path, required=True)
    p.add_argument("--publish", action="store_true", help="Copy verified UF2 files into firmware/uf2")
    p.add_argument("--keyboard", default="flan36", help="flan36 or a variant in design/variants.json")
    a = p.parse_args(); verify(a.zephyr, a.publish, a.keyboard)
