# PCB identity and independent editions

Request: verify LEFT/RIGHT on the PCBs, consolidate the maker's credit with
eduarbo.com, put flankbd.com below Flan, align the revision column to the full
logo/URL height, use the same Flan mark as the web, and select editions per half.

Acceptance:
- Side names match the typing position, checked against key and controller geometry.
- Both URLs are readable on all four sizes, in source PCBs, Gerbers and viewer textures.
- The Flan silhouette and four caramel drips match across color, display and PCB
  constructions; only printable stroke and wordmark weight vary.
- Each half can select, save, share and download its own edition; old configurations
  retain their paired edition. Copper, outline, drills and existing controls are preserved.

Baseline: `0c49df6`, clean tracked and untracked state on `main`.
The left PCB's controller bay is on its right in top coordinates; the back view
mirrors it to the left. LEFT/RIGHT therefore already identify the correct typing hand.
Swapping their text would misidentify the boards. The viewer explains the back view.

Verified: 8 source PCBs and 56 packages; only back silkscreen differs from
`0c49df6`. All DRC/ERC, schematic parity, print-clearance and native-readback
checks pass. The logo-kit geometry check passes. Configuration checks pass
164 fixtures with exact JS/Python parity and 12 family presets.

The browser check passes mixed rendering and package links for all four sizes,
fresh-context sharing, reload, undo/redo, paired selection and a 390 px phone
layout, with no page errors. Desktop and phone captures were visually inspected.
Receipts: `validation/pcb-identity.json`, `validation/pcb-viewer.json`,
`validation/{revI,flan42,flan46,flan54}-{signature,routing,fabrication,editions}.json`.
Delivery target: the configured public `origin/main` and its Pages site.

Two independent read-only reviews (domain and adversarial) agreed on normal
commit/push after verification; no HIGH/CRITICAL implementation findings.
The review baseline hashes remained unchanged. The sharing check opens Build
before reading its generated share link.

Regeneration also exposed broken generated library links to the former `filo36`
checkout. The edition exporter now repairs only broken links at its known helper
paths before recreating them. Board sources and library contents are preserved.

Reproduce the build with the installed FreeCAD Python (Shapely 2.1.2, NumPy
1.26.4, VTK 9.3.1), plus a task-local environment containing uharfbuzz 0.51.1
and gerbonara 1.5.0. Use KiCad 10.0.6 and its Python for PCB checks; the number-row
GND check additionally uses Shapely 2.0.7 in a task-local KiCad environment.

```sh
uv venv --python /Applications/FreeCAD.app/Contents/Resources/bin/python --system-site-packages build/pcb-identity-env
uv pip install --python build/pcb-identity-env/bin/python uharfbuzz==0.51.1 gerbonara==1.5.0
uv venv --python /Applications/KiCad/KiCad.app/Contents/Frameworks/Python.framework/Versions/Current/bin/python3 --system-site-packages build/pcb-identity-kicad
uv pip install --python build/pcb-identity-kicad/bin/python shapely==2.0.7
build/pcb-identity-env/bin/python tools/build_flan_logo.py
for variant in flan36 flan42 flan46 flan54; do
  build/pcb-identity-env/bin/python tools/install_signature.py --variant "$variant"
  build/pcb-identity-kicad/bin/python tools/check_routed_pcb.py --variant "$variant"
  build/pcb-identity-env/bin/python tools/export_fabrication.py --variant "$variant"
  build/pcb-identity-env/bin/python tools/export_editions.py --variant "$variant"
done
python3 tools/check_pcb_identity.py
build/pcb-identity-env/bin/python tools/render_pcb_signature.py
build/pcb-identity-env/bin/python tools/build_silkscreen_textures.py
build/pcb-identity-env/bin/python tools/build_viewer_revI.py
npm --prefix viewer run build
build/pcb-identity-env/bin/python tools/test_silkscreen_spacing.py
node viewer/config-contract-check.cjs
node viewer/pcb-check.cjs  # set FLAN36_PLAYWRIGHT_MODULE if Playwright is outside node_modules
```

The environments and generated intermediates remain ignored under `build/` for
reproduction. Source, final assets and verification receipts belong in Git.
The slower software-browser run was stopped; the project's existing Metal/GPU
path completed the same checks. Both test browsers and local servers were closed.
Diagnostic scratch files were removed; retained screenshots are reproduced by
`viewer/pcb-check.cjs` and the signature detail by `tools/render_pcb_signature.py`.

The first edition run repeatedly requeued Sayagata strokes in `patterns.spaced`.
All four interrupted stacks showed its buffer/trim loop. The old test also trimmed
already-clear rectangles because 0.26 mm was represented as 0.2599999999999998.
The correction ignores 1 nm roundoff and compensates the chord sagitta of the
8-segment quadrant buffer (about 1.26 µm at a 0.26 mm radius). It preserves the
0.26 mm spacing target and the separate 0.24 mm fabrication check. Boundary and
angled-corner regression checks cover this calculation. All 24 edition pairs now
finish with spacing, native readback and PCB checks intact.

A second interrupted stack still spent its time buffering the same kept-neighbour
set. `spaced` now caches up to 64 exact buffer results within a single invocation;
kept polygons are immutable and their indices remain stable. This changes reuse,
not geometry, and bounds cache memory. The same spacing regressions pass.

Owner refinements: consolidate the maker credit to one line (`by [symbol]
eduarbo.com`), with no separate `eduarbo` text; match the revision/year/hand
column and its divider to the full ink height of the Flan logo plus URL. These
replace the initial two-line credit and short revision column. Native text polygons
and the fresh preview confirm the alignment; dependent packages were regenerated.

The web mark had four caramel drips while the PCB's small-size branch used two.
Both now use `iso_regions` and its canonical `ISO_DRIPS`. The logo-kit build
compares the actual silhouette, caramel and front-edge geometry across all three
constructions and records the match in `design/branding-flan.json`.

The first-build packager also resolves each PCB's chosen edition; a direct check
covered both legacy paired Kikkō and mixed Asanoha/Seigaiha package paths. The
browser check refreshes the README underside render and records its hash in
`validation/pcb-viewer.json`, superseding that image's older capture receipt.
