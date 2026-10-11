#!/usr/bin/env python3
"""Adopt verified supplied-display exports while preserving unrelated geometry.

Usage: python3 tools/adopt_stock_display.py build/stock-display [--dry-run]
All evidence and file comparisons are checked before any repository write.
SPDX-License-Identifier: GPL-3.0-or-later
"""
import argparse
import copy
import hashlib
import json
import re
import shutil
from pathlib import Path

from adopt_audit_repairs import mesh_signature, rectangle_retriangulation

ROOT = Path(__file__).resolve().parents[1]
SIDES = {"left", "right"}
CHANGED_PARTS = ("display", "display-socket", "display-sled", "electronics-lid")


def require(condition, *message):
    if not condition:
        raise ValueError("; ".join(map(str, message)))


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read(path):
    return json.loads(Path(path).read_text())


def encoded(value):
    return json.dumps(value, indent=2) + "\n"


def filename(value):
    require(isinstance(value, str) and Path(value).name == value,
            "Export must be a plain filename", value)
    require(value not in ("", ".", ".."), "Invalid filename", value)
    return value


def relative_file(value):
    path = ROOT / value
    require(not Path(value).is_absolute() and path.resolve().is_relative_to(ROOT),
            "Input is outside the repository", value)
    return path


def manifest_map(value):
    if isinstance(value, dict):
        result = dict(value)
    else:
        require(isinstance(value, list), "Invalid export manifest")
        result = {entry["path"]: entry["sha256"] for entry in value}
        require(len(result) == len(value), "Duplicate manifest entries")
    require(result, "Empty export manifest")
    for name, digest in result.items():
        filename(name)
        require(re.fullmatch(r"[0-9a-f]{64}", digest), "Invalid digest", name)
        require(name.startswith(("left-", "right-")) and
                Path(name).suffix in (".stl", ".step"), "Unexpected export", name)
    return result


def set_manifest(report, values):
    if isinstance(report["exported_files"], list):
        report["exported_files"] = [{"path": name, "sha256": digest}
                                    for name, digest in sorted(values.items())]
    else:
        report["exported_files"] = dict(sorted(values.items()))


def metadata_files(meta, manifest):
    """Bind every visual/hash reference and derive the permitted geometry scope."""
    allowed = set()
    for name, part in meta["parts"].items():
        filename(name)
        main = name + ".stl"
        require(manifest.get(main) == part["stl_sha256"], "Part hash mismatch", main)
        scoped = any(name == f"{side}-{suffix}"
                     for side in SIDES for suffix in CHANGED_PARTS)
        if scoped:
            allowed.add(main)
            if part["prototype_part"]:
                require(name + ".step" in manifest, "Missing printable STEP", name)
                allowed.add(name + ".step")
        for visual in part["visuals"]:
            path = Path(visual["path"])
            require(path.parent == Path("mechanical/revI") and
                    re.fullmatch(re.escape(name) + r"-visual-\d+\.stl", path.name),
                    "Unexpected visual reference", visual)
            require(path.name in manifest, "Unmanifested visual", path.name)
            if "sha256" in visual:
                require(visual["sha256"] == manifest[path.name], "Visual hash mismatch", path.name)
            if scoped:
                allowed.add(path.name)
    for side in SIDES:
        for suffix in CHANGED_PARTS:
            require(f"{side}-{suffix}" in meta["parts"], "Missing scoped part", side, suffix)
        allowed.update((f"{side}-assembly.step", f"{side}-case-level-plate.stl",
                        f"{side}-case-level-plate.step"))
    for key, variant in meta["frameVariants"].items():
        side, style = key.split("-", 1)
        require(side in SIDES and re.fullmatch(r"[a-z0-9-]+", style), "Invalid frame key", key)
        stem = f"{side}-frame-{style}"
        for ext in ("stl", "step"):
            require(variant[ext] == f"{stem}.{ext}", "Unexpected frame path", key, ext)
            allowed.add(variant[ext])
        roles = set()
        for part in variant["material_parts"]:
            role = part["role"]
            require(role in {"body", "detail", "accent", "secondary"} and role not in roles,
                    "Invalid frame material role", key, role)
            roles.add(role)
            for ext in ("stl", "step"):
                name = f"{stem}-{role}.{ext}"
                require(part[ext] == name and manifest.get(name) == part[ext + "_sha256"],
                        "Frame material hash/path mismatch", name)
                allowed.add(name)
    for entries in meta["batteryLeadProfiles"].values():
        for item in entries:
            require(manifest.get(filename(item["stl"])) == item["stl_sha256"],
                    "Battery lead hash mismatch", item["stl"])
    require(allowed <= manifest.keys(), "Missing scoped exports", sorted(allowed - manifest.keys()))
    return allowed


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--installation", default="installation.json")
    parser.add_argument("--appearance", default="appearance.json")
    parser.add_argument("--readback", default="stock-readback.json")
    parser.add_argument("--metadata", default="revI.json")
    parser.add_argument("--mechanical", default="mechanical.json")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    source = args.source.resolve()
    target = ROOT / "mechanical/revI"
    require(source != target.resolve(), "Candidate must be separate from the adopted source")
    paths = {key: source / filename(getattr(args, key))
             for key in ("installation", "appearance", "readback", "metadata", "mechanical")}
    evidence_hashes = {key: sha(path) for key, path in paths.items()}
    installation, appearance, readback, meta, mechanical = (read(paths[key]) for key in
        ("installation", "appearance", "readback", "metadata", "mechanical"))
    baseline_files = [target / "Flan36.FCStd", ROOT / "design/revI.json",
                      ROOT / "validation/revI-mechanical.json"]
    baseline_hashes = {path: sha(path) for path in baseline_files}
    baseline = baseline_hashes[target / "Flan36.FCStd"]
    old_meta = read(ROOT / "design/revI.json")
    old_mechanical = read(ROOT / "validation/revI-mechanical.json")
    digest = sha(source / "Flan36.FCStd")
    require(baseline == old_meta["fcstd_sha256"] == old_mechanical["source_sha256"],
            "Current source/metadata/mechanical baseline disagree")
    require(digest == meta["fcstd_sha256"] == mechanical["source_sha256"] ==
            appearance["source_sha256"] == readback["source_sha256"], "Candidate hashes disagree")
    require(installation["source_sha256"] == appearance["input_sha256"],
            "Appearance restoration is not bound to the installed geometry")
    require(appearance.get("passed") is True and appearance.get("geometry_preserved") is True and
            appearance.get("baseline_unchanged") is True and appearance.get("source_unchanged") is True and
            appearance.get("source_unchanged_ref") == "baseline",
            "Appearance restoration lacks passed geometry/baseline preservation checks")
    require(baseline == installation["baseline_sha256"] == readback["baseline_sha256"],
            "Evidence is for a different original source")
    require(appearance["baseline_sha256"] == baseline,
            "Appearance restoration used a different original source")
    require(installation.get("source_unchanged") is True and installation.get("saved_reopened") is True,
            "Installation did not preserve its input and reopen its output")
    require(installation.get("unrelated_solids_preserved") and
            installation.get("key_mesh_placements_preserved", 0) > 0,
            "Installation lacks preservation checks")
    require(readback.get("passed") is True and readback.get("opened_from_saved_files") is True and
            readback.get("source_files_unchanged") is True, "Independent saved-file readback did not pass")
    require(readback["preserved_key_mesh_placements"] == installation["key_mesh_placements_preserved"],
            "Key mesh preservation counts disagree")
    require(installation.get("physical_acceptance") is False and
            readback.get("physical_acceptance") is False and
            mechanical.get("physical_acceptance", False) is False and
            meta.get("manufacturing_ready") is False, "Unexpected manufacturing/physical-acceptance claim")
    require(set(readback["halves"]) == set(mechanical["halves"]) == SIDES,
            "Both halves must be verified")
    require(all(not half["collisions"] for half in mechanical["halves"].values()),
            "Mechanical report contains collisions")
    for side in SIDES:
        require("level" in mechanical["halves"][side]["case_variants"], "Missing Level checks", side)
    for key, expected in (("board_separation_mm", 7.0), ("display_bottom_mm", 12.4),
                          ("glass_top_mm", 14.3), ("frame_top_mm", 14.5)):
        require(abs(installation[key] - expected) < 1e-7 and
                abs(meta["stock_display_connector"][key] - expected) < 1e-7,
                "Unexpected supplied-connector recipe", key)
    tool_hashes = {
        "tools/freecad/install_stock_display.py": installation["installer_sha256"],
        "tools/freecad/check_stock_display.py": readback["checker_sha256"],
        "tools/freecad/export_revI.py": mechanical["checker_sha256"],
    }
    appearance_tool = "tools/freecad/restore_stock_display_appearance.py"
    require(appearance.get("restorer_sha256") == sha(ROOT / appearance_tool),
            "Appearance restorer changed since verification")
    tool_hashes[appearance_tool] = appearance["restorer_sha256"]
    for name, expected in tool_hashes.items():
        require(sha(ROOT / name) == expected, "Tool changed since verification", name)
    inputs = {item["path"]: item["sha256"] for item in meta["inputs"]}
    require(len(inputs) == len(meta["inputs"]), "Duplicate metadata inputs")
    for name, expected in inputs.items():
        require(sha(relative_file(name)) == expected, "Input changed since export", name)
    require(set(meta["parts"]) == set(old_meta["parts"]) and
            set(meta["frameVariants"]) == set(old_meta["frameVariants"]),
            "Part/frame inventory changed outside migration scope")
    manifest = manifest_map(mechanical["exported_files"])
    for name, expected in manifest.items():
        require(sha(source / name) == expected, "Export changed after validation", name)
    allowed = metadata_files(meta, manifest)
    # The current active plate is a byte/geometry alias of the selected Level
    # upper shell. Prove that relationship instead of widening the part allowlist.
    active_plate_aliases = []
    for side in sorted(SIDES):
        active = f"{side}-key-plate"
        level = f"{side}-case-level-plate"
        require(meta["parts"][active]["object"] ==
                ("L_" if side == "left" else "R_") + "ActivePlate" and
                not meta["parts"][active]["visuals"], "Unexpected active plate", side)
        require(mesh_signature(source / (active + ".stl")) ==
                mesh_signature(source / (level + ".stl")),
                "Active plate is not the verified Level upper shell", side)
        for ext in ("stl", "step"):
            require(active + "." + ext in manifest, "Missing active plate export", side, ext)
            allowed.add(active + "." + ext)
        active_plate_aliases.append({"active": active, "verified_variant": level,
                                     "method": "oriented_triangle_signature",
                                     "precision_mm": .0001})
    # Common hot-swap visuals are not regenerated by this exporter. Preserve them.
    common_files = {}
    for visual in meta.get("hotswap_model", {}).get("visuals", []):
        path = relative_file(visual["path"])
        require(path.parent == target and path.name.startswith("component-hotswap-"),
                "Unexpected common visual", path)
        require(sha(path) == visual["sha256"], "Common visual changed", path.name)
        common_files[path.name] = visual["sha256"]
        if (source / path.name).exists():
            require(sha(source / path.name) == visual["sha256"], "Candidate common visual changed", path.name)
    exported = {p.name for p in source.iterdir() if p.suffix in (".stl", ".step")}
    require(exported <= manifest.keys() | common_files.keys(),
            "Unverified extra geometry in candidate directory", sorted(exported - manifest.keys() - common_files.keys()))

    adopt = {"Flan36.FCStd"}
    preserve = set()
    preservation = []
    target_hashes = dict(common_files)
    for name in sorted(manifest):
        old, new = target / name, source / name
        require(old.is_file(), "Missing baseline export", name)
        target_hashes[name] = sha(old)
        if Path(name).suffix != ".stl":
            continue
        if target_hashes[name] == manifest[name]:
            preserve.add(name)
            method = {"method": "identical_bytes"}
        elif mesh_signature(old) == mesh_signature(new):
            preserve.add(name)
            method = {"method": "oriented_triangle_signature", "precision_mm": .0001}
        elif name in allowed:
            adopt.add(name)
            continue
        else:
            # This exact proof admits only alternate diagonals of the same raw
            # oriented vertical rectangles. It cannot admit coordinate drift.
            method = rectangle_retriangulation(old, new)
            preserve.add(name)
        preservation.append({"file": name, "preserved_sha256": target_hashes[name],
                             "candidate_sha256": manifest[name], **method})
    for name in sorted(manifest):
        if Path(name).suffix != ".step":
            continue
        if name in {f"{side}-assembly.step" for side in SIDES}:
            adopt.add(name)
            continue
        mesh = str(Path(name).with_suffix(".stl"))
        require(mesh in manifest, "STEP has no verified paired STL", name)
        if mesh in preserve:
            preserve.add(name)
        else:
            require(name in allowed and mesh in adopt, "Unscoped STEP geometry change", name)
            adopt.add(name)
    for name in list(adopt - {"Flan36.FCStd"}):
        if target_hashes[name] == manifest[name]:
            adopt.remove(name)
            preserve.add(name)
    require(adopt - {"Flan36.FCStd"} <= allowed, "Adoption escaped metadata scope")
    require(adopt.isdisjoint(preserve) and (adopt - {"Flan36.FCStd"}) | preserve == manifest.keys(),
            "Every exported file must have exactly one disposition")
    final_hashes = {name: manifest[name] if name in adopt else target_hashes[name] for name in manifest}
    for name, part in meta["parts"].items():
        part["stl_sha256"] = final_hashes[name + ".stl"]
        for visual in part["visuals"]:
            if "sha256" in visual:
                visual["sha256"] = final_hashes[Path(visual["path"]).name]
    for variant in meta["frameVariants"].values():
        for part in variant["material_parts"]:
            for ext in ("stl", "step"):
                part[ext + "_sha256"] = final_hashes[part[ext]]
    for entries in meta["batteryLeadProfiles"].values():
        for item in entries:
            item["stl_sha256"] = final_hashes[item["stl"]]
    final_mechanical = copy.deepcopy(mechanical)
    set_manifest(final_mechanical, final_hashes)
    final_mechanical["adoption"] = {
        "receipt": "validation/revI-stock-display-adoption.json",
        "candidate_report_sha256": evidence_hashes["mechanical"],
        "exported_files_describe": "Adopted repository bytes after equivalent-mesh/paired-STEP preservation",
    }
    adopter_hash = sha(__file__)
    report = {
        "schema": "flan36-stock-display-adoption-1", "baseline_sha256": baseline,
        "native_sha256": digest, "adopter_sha256": adopter_hash,
        "mesh_comparison_helper_sha256": sha(ROOT / "tools/adopt_audit_repairs.py"),
        "active_plate_aliases": active_plate_aliases,
        "candidate_evidence_sha256": evidence_hashes, "allowed_geometry_files": sorted(allowed),
        "adopted_files": sorted(adopt),
        "preserved_files": sorted(preserve | common_files.keys()),
        "preserved_meshes": preservation, "unchanged_mesh_comparison_precision_mm": .0001,
        "final_exported_files": dict(sorted(final_hashes.items())),
        "physical_acceptance": False,
    }
    if args.dry_run:
        print(encoded({"dry_run": True, "verified": True, "adopted_files": report["adopted_files"],
                       "preserved_file_count": len(report["preserved_files"])}), end="")
        return
    # Recheck the read set immediately before beginning the bounded mutation.
    for path, expected in baseline_hashes.items():
        require(sha(path) == expected, "Baseline changed during verification", path)
    for key, path in paths.items():
        require(sha(path) == evidence_hashes[key], "Evidence changed during verification", key)
    require(sha(source / "Flan36.FCStd") == digest and sha(__file__) == adopter_hash,
            "Candidate or adopter changed during verification")
    for name, expected in {**inputs, **tool_hashes}.items():
        require(sha(relative_file(name)) == expected, "Input changed during verification", name)
    for name, expected in target_hashes.items():
        require(sha(target / name) == expected, "Target changed during verification", name)
    for name, expected in manifest.items():
        require(sha(source / name) == expected, "Candidate export changed during verification", name)
    for name in report["adopted_files"]:
        shutil.copy2(source / name, target / name)
    require(sha(target / "Flan36.FCStd") == digest, "Native adoption readback failed")
    for name, expected in {**final_hashes, **common_files}.items():
        require(sha(target / name) == expected, "Export adoption readback failed", name)
    (ROOT / "design/revI.json").write_text(encoded(meta))
    validations = ROOT / "validation"
    for suffix in ("installation", "appearance", "readback"):
        shutil.copy2(paths[suffix], validations / f"revI-stock-display-{suffix}.json")
        require(sha(validations / f"revI-stock-display-{suffix}.json") == evidence_hashes[suffix],
                "Validation receipt copy readback failed", suffix)
    (validations / "revI-stock-display-mechanical.json").write_text(encoded(final_mechanical))
    (validations / "revI-mechanical.json").write_text(encoded(final_mechanical))
    report["metadata_sha256"] = sha(ROOT / "design/revI.json")
    report["validation_sha256"] = {f"revI-stock-display-{suffix}.json":
                                    sha(validations / f"revI-stock-display-{suffix}.json")
                                    for suffix in ("installation", "appearance", "readback", "mechanical")}
    require(read(ROOT / "design/revI.json") == meta and
            read(validations / "revI-mechanical.json") == final_mechanical,
            "Metadata/report write readback failed")
    report["passed"] = True
    (validations / "revI-stock-display-adoption.json").write_text(encoded(report))
    print(f"Adopted {len(report['adopted_files'])} supplied-display files; "
          f"preserved {len(report['preserved_files'])} equivalent files")


if __name__ == "__main__":
    run()
