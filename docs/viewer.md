# Using the viewer

[Open Flan36](https://eduarbo.github.io/flan/) · [Download the complete offline viewer](https://eduarbo.github.io/flan/offline.html)

Drag to orbit, scroll or pinch to zoom, and right-drag or use two fingers to pan. The floating camera buttons choose **3D, Top, Front, Right, Left, Back or Bottom**. Bottom looks up at the boards with the rear edge at the top, so the back silkscreen reads correctly. The adjacent fit icon recenters visible parts without changing the viewing angle; the vertical **Separate layers** slider opens the assembly. **Reset** in the bottom navigation resets the camera only, preserving visibility, separation and your design.

The viewer opens with the editor closed so the model fills the workspace above the compact bottom navigation. Camera controls float within the model area; they collapse out of the way when the drawer leaves only a small model strip.

- **Design** opens the **Case / Frame / Keys / Colors / Battery / PCB** tabs. Case and Frame colors and finishes sit directly below their previews; Keys has curated shape presets followed by its color controls. **PCB** picks the back-silkscreen [edition](electronics.md#editions) and one of JLCPCB's solder-mask colours, turns the model to the underside without base or fasteners, and links that edition's Gerber/drill ZIPs. Both choices are saved in the design JSON; the colour is not in the Gerbers, so pick the same one in the quote. Use Left/Right arrows or Home/End while a category tab is focused to switch tabs.
- **Parts** shows component rows with an eye for Hide/Show and a **Solo** toggle; pressing a pressed Solo brings the assembly back. **Show all** in the sidebar header restores every installed component and closes separated layers. **Inside** and **Stack** are component previews in this panel.
- **Magnets** in Parts opens a location preview and its detail page. Three paired stations form a triangle around each electronics bay, beneath the removable frame. Six Ø2 × 3 mm base magnets meet six Ø2 × 4 mm frame magnets. They are enclosed in plastic; the preview highlights their locations through the surrounding geometry and separates the pairs.
- **Files** contains JSON, print kit, GLB, offline download and recovery. **About** contains original design and CAD by Eduardo Ruiz, dimensions, resources and credits. Full license texts expand individually; their close button remains visible.

Selecting a component row or tapping a part in the model replaces the drawer content with that part's detail page. Below its description, **Visible / Solo / All** acts on the whole selection: hide or show it, show only it, or show every installed part. Each individual piece has its own eye and **Solo**. **Back** in the header restores the previous page, scroll position and drawer size. **Customize this part** opens the appropriate Design tab and targets that half or key when applicable.

On mobile and portrait screens, drag the top grip between three stops: **model focus**, **shared screen**, and **panel focus**. The canvas resizes with the drawer. On wider screens, drag the sidebar edge to choose its width. The grip also works with arrow keys and Home/End: Up/Down selects mobile stops, Left/Right adjusts desktop width, and Home/End chooses the minimum/maximum. **×** closes the editor. Selecting the already-open navigation destination also closes it. Categories share your chosen drawer size; closing and reopening retains session position and scrolling. A short text-entry viewport temporarily enlarges the editor while retaining the canvas.

Escape dismisses an open dialog; otherwise it returns from a selected-part detail page before closing the editor. Closing restores focus to the opener. Hover or keyboard-focus a component row to highlight it in the model. Resizing and orientation changes preserve your viewing angle, pan and relative zoom while fitting the available canvas.

Visibility is a preview choice, separate from what your design includes. To omit or reinstall a display frame and its three frame magnets, open **Parts → Frame → Installed display frames** and change Left or Right. This changes the saved configuration and print kit. **Show all** reveals installed parts; it does not reinstall an omitted frame. Case, frame and battery edits retain explicit **Both / Left / Right** targets.

**Undo / Redo** keeps 40 design steps during the current session. Ctrl/Cmd Z and Ctrl/Cmd Shift Z work outside text fields. One continuous color gesture is one step. View changes are separate from design history.

In **Files**, give your design a name and save its JSON. Load that file to return to the same shapes, per-key colors, frames and batteries. JSON also transfers selections to FreeCAD.

## Saved data and recovery

Opening the viewer never overwrites saved data. If an older or damaged value cannot be read, it stays intact and a **Save warning** links to recovery.

Two current viewer tabs cannot silently replace one another's changes. A stale tab keeps a separate recovery draft. **Files → Saved data & recovery** lets you download the original values and those drafts. You can load the saved version, export your current design separately, or explicitly use it as the saved version; replacement keeps a recovery copy first. Palette conflicts use the same protection. Import recovered palette files through **My palettes**.

If browser storage is unavailable, the design remains editable and exportable in that tab. Export before closing. Session undo does not survive a reload.

## Online and offline

The online viewer loads print files only when you request a print kit. A failed download can be retried without changing the design. Files are matched to the viewer version before use.

Use the **Download offline viewer** link for a complete, single-file copy. It opens without a server or network and includes configuration, GLB and print-kit export. The smaller online `index.html` alone is not the offline download.

GLB exports all installed parts assembled, regardless of hidden layers or exploded offsets. Its units are meters; use FreeCAD/STEP for solid editing.

Both use the same full-resolution geometry. Print kits preserve the exact native STL files; 3MF retains the registered material volumes. These checks do not qualify physical fit, electronics or a print process.

## Verification and reproduction

The current redesign's browser evidence is recorded in [the interaction receipt](../validation/revI-interaction.json), including its CUA method, exercised viewports and limitations. Earlier [canvas workspace](reviews/canvas-workspace.md) and [reliability](../validation/revI-reliability.json) receipts describe their stated revisions; they are historical evidence, not acceptance of this interface.

With the locked viewer dependencies installed, rebuild and run the non-browser configuration checks:

```sh
node viewer/build.mjs
node viewer/config-contract-check.cjs
node viewer/rebrand-check.cjs
```

The browser checks drive the current controls: bottom navigation, Design tabs, Parts rows with eye and **Solo**, and part pages with **Visible / Solo / All**. They load `docs/offline.html`; `reliability-check.cjs` also serves `docs/index.html` locally to exercise the online print loader. The removed half filter, leader lines, annotations and per-key shape editor are covered by their current equivalents: per-piece eyes, hover highlights, part pages and design-file import.

On 2026-10-18, with playwright-core 1.61.1 and Chromium 149, these passed with no runtime errors against `docs/offline.html` SHA-256 `02b3fb5a…`: `check.cjs`, `responsive-check.cjs`, `customize-check.cjs`, `frame-orientation-check.cjs` (Game Boy and Hanafuda), `battery-leads-check.cjs`, `cap-rows-check.cjs`, `reliability-check.cjs`, `frame-collection-check.cjs`, `display-seam-check.cjs`, `loading-check.cjs` and `keycolors-check.cjs`.

`hex-check.cjs` fails at one step: Escape in a HEX field closes the editor instead of restoring the field's last valid value. That is a viewer bug, not an outdated check; its other steps pass.

Run any check with a local Playwright and Chromium:

```sh
FLAN36_PLAYWRIGHT_MODULE=/path/to/playwright-core FLAN36_BROWSER=/path/to/chromium node viewer/check.cjs
```

`capture-readme.cjs` regenerates the README images (`revI-assembled`, the Solid, Color rim and Terrace `revI-case-*` captures and `revI-pcb-underside`) from `docs/offline.html` and records their hashes in [the image receipt](../validation/revI-readme-images.json):

```sh
FLAN36_PLAYWRIGHT_MODULE=/path/to/playwright FLAN36_BROWSER=/path/to/chromium node viewer/capture-readme.cjs
```

The silkscreen textures come from the fabrication ZIPs themselves: `tools/build_silkscreen_textures.py` (with `tools/requirements-silkscreen.txt`) rasterizes each package's `B_Silkscreen`, then `tools/build_viewer_revI.py` and `viewer/build.mjs` embed them.

Browser checks write only ignored artifacts under `build/`; `check.cjs` keeps its case captures in `build/case-variants/`, since `capture-readme.cjs` owns the README images. A passing run must identify the current built viewer and contain no runtime errors. Browser emulation does not constitute a physical iPhone test. The [reliability plan](reviews/reliability-plan.md) and its original receipts retain their historical scope and hashes; `python3 tools/restore_reliability_review.py` restores their ignored advisory artifacts.

After publication, compare the anonymous source archive and served viewer assets with the exact published commit:

```sh
python3 tools/check_public_delivery.py <published-commit>
```

This checks delivered bytes. The interaction receipt separately records functional browser evidence; neither substitutes for physical keyboard testing.

Save serialization uses the browser [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API). Without it, the viewer preserves a separate recovery draft and offers JSON export instead of overwriting shared saved state.
