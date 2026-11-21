# Contributing

Ideas, questions and physical test results are welcome in Issues.

Include the revision, affected part, expected behavior and observed result. For mechanical issues, add measurements and print settings; for firmware, include the controller, version and reproduction steps.

Preserve the 36-key centers and angles unless explicitly proposing a different layout. Distinguish measurements, estimates and renders. Keep documentation in English, concise and focused on what changed, why and how it was checked. Preserve upstream authorship and licenses. Do not label experimental files as manufacturing-ready.

Use [FreeCAD + KiCad + StepUp](docs/freecad.md). Save mechanical work in a copy of the FCStd and include that editable source with its dimensions; STL or a render alone loses the design history. Test StepUp on a PCB copy and compare centers, angles, outlines, holes and DRC afterward. Never run the reference generator over a hand-edited FCStd.

For keycap/frame contributions, include the complete configuration, source hashes and clearance results. A visually plausible combination must also pass the configuration checker. New frame geometry requires a new collision check and updated exported/viewer meshes.

## Viewer changes

Keep the viewer self-contained and preserve geometry, configuration checks and export metadata. Native-mesh thumbnails reuse the main renderer at startup; sidebar links and highlight meshes are viewing aids outside the exported assembly.

From a fresh checkout, use Python 3.12, Node.js with npm, KiCad with its Python bindings, librsvg (`rsvg-convert`) and ImageMagick 7 (`magick`). Run the following from the repository root. KiCad supplies its own Python on macOS. On Linux, set `KICAD_PYTHON=/usr/bin/python3` (or the interpreter that can `import pcbnew`) and export it.

```sh
python3.12 -m venv .venv
. .venv/bin/activate
python -m pip install -r tools/requirements-viewer.txt
npm ci --prefix viewer
python tools/build_silkscreen_textures.py
python tools/build_viewer_revI.py
node viewer/build.mjs
python -m http.server 8000 --bind 127.0.0.1 --directory docs
```

Open <http://127.0.0.1:8000/explore/>. Select a size, open Build and download its complete kit. The build also produces `docs/explore/offline.zip`. Stop the server with Ctrl-C. For a byte-matching rebuild of the published shading and opening previews on macOS, use the VTK shipped with FreeCAD (tested with VTK 9.3.1). Create the environment with `uv venv --seed --system-site-packages --python /Applications/FreeCAD.app/Contents/Resources/bin/python .venv` in place of the first command. The PyPI VTK wheel can round surface normals differently; the viewer still renders the model. The [firmware guide](docs/firmware.md#build-personal-firmware) covers personal UF2 builds.

To check the browser workflows from the same checkout, stop the preview server and install the test browser in a project-local folder:

```sh
npm install --prefix build/browser-tools --no-package-lock playwright@1.64.1
export FLAN36_PLAYWRIGHT_MODULE="$PWD/build/browser-tools/node_modules/playwright"
export PLAYWRIGHT_BROWSERS_PATH="$PWD/build/browser-tools/browsers"
node "$FLAN36_PLAYWRIGHT_MODULE/cli.js" install chromium
node viewer/build-focus-check.cjs
node viewer/marketing/check.cjs
```

If Playwright and Chromium are already installed, reuse their module path and browser cache. Both checks start and stop their own local server. The first opens the complete build ZIP and checks the packaged files against their sources. The second checks the bilingual media downloads and clipboard.

`build/` is ignored and reproducible: the scene generator creates its geometry bundle; the UI checker writes screenshots, configuration JSON, GLB and its receipt. Frame palettes live in `design/frame-finishes.json`; accent colors are assigned only to existing relief. `python3 tools/render_frames.py` rebuilds the comparison image. `FILO_QT_PLATFORM=cocoa python3 tools/freecad/run_macos.py tools/freecad/check_finishes.py` checks all three themes on both native halves, height changes and save/reopen using the installed macOS FreeCAD runtime; its temporary FCStd, image and receipt stay under ignored `build/viewer-multicolor/`. The geometry check creates a reproducible JS bundle and receipt there. The source of the standalone HTML is under `viewer/`; do not hand-edit `docs/explore/index.html`.

## Publishing the site

flankbd.com publishes only the site pages in `docs/` (home, explorer, marketing, branding, their assets and the files at the root), not the documentation next to them. `.github/workflows/pages.yml` deploys on every push to `main` that touches `docs/`. The allowlist is in `tools/stage_site.py`, which also fails if a page refers to a local file it left out. A new public file must be added there; design proposals, reviews and concept material go in `design/`, never in `docs/`. To check what will be published:

```sh
python3 tools/stage_site.py build/site
FLAN_SITE_ROOT=build/site node viewer/public-check.cjs --local "$(git rev-parse HEAD)"
```

For a viewer performance change, compare the same browser and machine with a declared CPU throttle:

```sh
node viewer/performance.cjs --baseline
node viewer/performance.cjs
```

The baseline is the immutable pre-correction HTML at `8b4edc1`. Results go to `build/viewer-sidebar/`. The benchmark separately records startup, fixed orbit input, long tasks and frame-choice response. It also measures the old viewer with labels disabled to isolate their contribution. The corrected orbit must reduce p95 frame interval by at least 35% and long-task time by at least 65%. These are regression thresholds, not physical-phone guarantees.

The identity migration is checked by `tools/check_rebrand.py` and `tools/freecad/check_rebrand.py`: the latter reopens and recomputes both native snapshots. Original generation receipts retain their pre-rename source hashes; `validation/rebrand-file-map.json` binds them to the renamed files. Regenerate mechanical/electrical acceptance after any geometry or circuit change.
