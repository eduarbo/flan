#!/usr/bin/env python3
"""Point current sources and pages at the renamed repository eduarbo/flan36 → eduarbo/flan.

Only exact repository URLs and slugs change: `eduarbo/flan36` (github.com, raw, codeload,
`.git`) and `eduarbo.github.io/flan36`. Model identifiers such as Flan36, flan36-config-1,
flan36_left or FLAN36_* are untouched. Historical receipts (validation/, design/proposals/,
design/rebrand.json, design/branding.json) keep their original URLs. Generated viewer pages
get the same substitution as their sources, with a byte proof, because rebuilding them from
the local scene cache would also change the embedded print kit. Writes design/rename-flan.json.
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import argparse, hashlib, json, re, subprocess

ROOT = Path(__file__).resolve().parents[1]
OLD, NEW = "flan36", "flan"
SLUG = re.compile(rb"(?<![\w.-])eduarbo/flan36(?![\w-])")
PAGES = re.compile(rb"eduarbo\.github\.io/flan36(?![\w-])")
KEEP = ("validation/", "design/proposals/", "design/rebrand.json", "design/branding.json", "design/rename-flan.json")

def sub(b):
    return PAGES.sub(b"eduarbo.github.io/" + NEW.encode(), SLUG.sub(b"eduarbo/" + NEW.encode(), b))

def sha(b):
    return hashlib.sha256(b).hexdigest()

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--write", action="store_true", help="apply; default is a dry run")
    a = ap.parse_args()
    files = subprocess.check_output(["git", "grep", "-l", "-E", r"eduarbo/flan36|eduarbo\.github\.io/flan36"], cwd=ROOT, text=True).split()
    files = [f for f in files if not f.startswith(KEEP)]
    record = {"schema": "flan-rename-1", "repository_id": 1380608588, "old": "eduarbo/flan36", "new": "eduarbo/flan",
              "pages": {"old": "https://eduarbo.github.io/flan36/", "new": "https://eduarbo.github.io/flan/",
                        "note": "GitHub redirects repository, git, raw and codeload URLs after a rename, not Pages project URLs"},
              "kept_historical": list(KEEP[:-1]),
              "fabrication_zips": "Existing packages keep a github.com/eduarbo/flan36 link in README.txt, which redirects; the exporters now write the new URL",
              "files": {}}
    for f in files:
        old = (ROOT / f).read_bytes()
        new = sub(old)
        n = len(SLUG.findall(old)) + len(PAGES.findall(old))
        assert new != old and not SLUG.search(new) and not PAGES.search(new), f
        record["files"][f] = {"replacements": n, "sha256_before": sha(old), "sha256_after": sha(new)}
        if a.write:
            (ROOT / f).write_bytes(new)
    total = sum(v["replacements"] for v in record["files"].values())
    print(("rewrote" if a.write else "would rewrite"), len(files), "files,", total, "URLs")
    if a.write:
        (ROOT / "design/rename-flan.json").write_text(json.dumps(record, indent=2) + "\n")

if __name__ == "__main__":
    main()
