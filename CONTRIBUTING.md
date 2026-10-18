# Contributing

Ideas, questions and physical test results are welcome in Issues.

Include the revision, affected part, expected behavior and observed result. For mechanical issues, add measurements and print settings; for firmware, include the controller, version and reproduction steps.

Preserve the 36-key centers and angles unless explicitly proposing a different layout. Distinguish measurements, estimates and renders. Keep documentation in English, concise and focused on what changed, why and how it was checked. Preserve upstream authorship and licenses. Do not label experimental files as manufacturing-ready.

Use [FreeCAD + KiCad + StepUp](docs/freecad.md). Save mechanical work in a copy of the FCStd and include that editable source with its dimensions; STL or a render alone loses the design history. Test StepUp on a PCB copy and compare centers, angles, outlines, holes and DRC afterward. Never run the reference generator over a hand-edited FCStd.

For keycap/frame contributions, include the complete configuration, source hashes and clearance results. A visually plausible combination must also pass the configuration checker. New frame geometry requires a new collision check and updated exported/viewer meshes.

## Viewer changes

Keep the viewer self-contained and preserve geometry, configuration checks and export metadata. Native-mesh thumbnails reuse the main renderer at startup; sidebar links and highlight meshes are viewing aids outside the exported assembly.

With Python dependencies from `tools/requirements-render.txt`, the pinned npm dependencies and Playwright available:

```sh
python3 tools/build_viewer_revI.py
npm ci --prefix viewer
node viewer/build.mjs
node viewer/check.cjs
node viewer/finishes-check.cjs
node viewer/rebrand-check.cjs
python3 tools/check_rebrand.py
```

If Playwright is installed outside the project or needs a particular Chromium executable, set `FLAN36_PLAYWRIGHT_MODULE` and `FLAN36_BROWSER`. To repeat functional acceptance against a published revision, also set `FLAN36_VIEWER_URL` to its URL. The same checks exercise local HTML with HTTP(S) blocked and the public page with scene integrity verification.

`build/` is ignored and reproducible: the scene generator creates its geometry bundle; the UI checker writes screenshots, configuration JSON, GLB and its receipt. `docs/images/viewer-explorer.png` is copied from `build/viewer-multicolor/handheld.png`. Frame palettes live in `design/frame-finishes.json`; accent colors are assigned only to existing relief. `python3 tools/render_frames.py` rebuilds the comparison image. `FILO_QT_PLATFORM=cocoa python3 tools/freecad/run_macos.py tools/freecad/check_finishes.py` checks all three themes on both native halves, height changes and save/reopen using the installed macOS FreeCAD runtime; its temporary FCStd, image and receipt stay under ignored `build/viewer-multicolor/`. The geometry check creates a reproducible JS bundle and receipt there. The source of the standalone HTML is under `viewer/`; do not hand-edit `docs/explore/index.html`.

For a viewer performance change, compare the same browser and machine with a declared CPU throttle:

```sh
node viewer/performance.cjs --baseline
node viewer/performance.cjs
```

The baseline is the immutable pre-correction HTML at `8b4edc1`. Results go to `build/viewer-sidebar/`. The benchmark separately records startup, fixed orbit input, long tasks and frame-choice response. It also measures the old viewer with labels disabled to isolate their contribution. The corrected orbit must reduce p95 frame interval by at least 35% and long-task time by at least 65%. These are regression thresholds, not physical-phone guarantees.

The identity migration is checked by `tools/check_rebrand.py` and `tools/freecad/check_rebrand.py`: the latter reopens and recomputes both native snapshots. Original generation receipts retain their pre-rename source hashes; `validation/rebrand-file-map.json` binds them to the renamed files. Regenerate mechanical/electrical acceptance after any geometry or circuit change.
