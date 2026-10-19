# Using the viewer

[Open Flan36](https://flankbd.com/explore/) · [Download the complete offline viewer](https://flankbd.com/explore/offline.html)

The explorer uses the home page's look. The page takes its colours from the keyboard: the named theme the left half wears, or its own case and frame colours, with a dark page for dark-bodied designs. The model floats on the page with a soft shadow under each half.

Drag to orbit, scroll or pinch to zoom, and right-drag or use two fingers to pan. The camera chip at the bottom left chooses **3D, Top, Front, Left, Right, Back or Bottom**; a narrow scene folds them into one **3D view** menu. Bottom looks up at the boards with the rear edge at the top, so the back silkscreen reads correctly. Beside the chip, **Fit** recenters visible parts without changing the viewing angle and **Reset** resets the camera only, preserving visibility, separation and your design. The vertical slider between the model and the panel separates the layers: up takes them apart, down puts them back together.

The top bar holds the lockup back to the home page, the three modes **Design · Parts · Files**, **Undo / Redo**, the save state, **Share** and **About** (ⓘ). The viewer opens in Design with the panel beside the model; the panel has no outline and scrolls on its own.

- **Design** stacks one section per choice, with real thumbnails: **Size**, **Theme** (28 swatches), **Case**, **Keycaps** and **Frame**, then **Build** with **Battery** and **PCB** as single rows. A short index at the top of the panel jumps to each section. The usual options stay in view; everything else opens in place behind one link per section, in the accent colour: **Per half** for themes and cases (halves, colours and finish, matching the frame and rim), **Paint keys** for keycaps (halves; all keys, a row, a column or one key on the real key map; the colour; curated and saved palettes), **Fine-tune** for frames (halves, body and accent colours, design colours) and the Battery and PCB rows (halves and profiles; back-silkscreen [edition](electronics.md#editions), solder mask, underside and Gerber/drill ZIPs). **Done** closes a section's options again. **Size** lists Flan36 and every [family variant](variants.md) whose case is built. A variant loads its own case and PCB on demand; its added keys copy the key beside them (K00 follows K01, K41 follows K01 and so on) and its added fasteners copy H1. Its print kit uses its own case parts, and its PCB links its Gerber packages without silkscreen editions, which exist for Flan36's boards only. The PCB edition and mask colour are saved in the design JSON; the colour is not in the Gerbers, so pick the same one in the quote.
- **Parts** shows **Inside**, **Stack** and **Magnets** previews, then every component group with its count, an eye for Hide/Show and a **Solo** toggle; pressing a pressed Solo brings the assembly back. **Show all** at the top of the panel restores every installed component and closes separated layers.
- **Magnets** in Parts opens a location preview and its detail page. Three paired stations form a triangle around each electronics bay, beneath the removable frame. Six Ø2 × 3 mm base magnets meet six Ø2 × 4 mm frame magnets. They are enclosed in plastic; the preview highlights their locations through the surrounding geometry and separates the pairs.
- **Files** starts with **Share**, then JSON, print kit, downloads (GLB, offline viewer, source CAD) and saved versions with recovery. **About** (ⓘ) contains original design and CAD by Eduardo Ruiz, dimensions, resources and credits. Full license texts expand individually; their close button remains visible.

**Share** copies a link that opens this exact keyboard. A design that a home-page look describes completely gets the short look link below; any other design, such as painted keys, custom colours, mixed halves, a battery or a PCB edition, travels whole in a compressed `?design=` parameter. Opening either link applies the design as a new step: Undo returns to the saved design, and the parameter then leaves the address.

Selecting a component row or tapping a part in the model replaces the panel content with that part's card. Below its description, **Visible / Solo / All** acts on the whole selection: hide or show it, show only it, or show every installed part. Each individual piece has its own eye and **Solo**. **Back** restores the previous page, scroll position and panel size. **Customize this part** opens the matching Design section with its options open and targets that half or key when applicable.

On phones and portrait screens the model stays on top with the slider at the thumb, and a sheet holds the home page's tabs: **Size, Theme, Case, Keys, Frame, Battery and PCB**, each with its current choice. Options scroll sideways in one row; **Fine-tune** opens inside the sheet. Drag the sheet's grip between three stops: **model focus**, **shared screen** and **panel focus**. The canvas resizes with the sheet. On wider screens, drag the panel's edge to choose its width. The grip also works with arrow keys and Home/End: Up/Down selects phone stops, Left/Right adjusts the width, and Home/End chooses the minimum/maximum. **›** (⌄ on phones) hides the panel; a mode brings it back. Modes behave as tabs, so choosing the open mode keeps it open. Sections share your chosen panel size; closing and reopening retains session position and scrolling. A short text-entry viewport temporarily enlarges the panel while retaining the canvas.

Escape dismisses an open dialog or the views menu; otherwise it returns from a selected-part card before hiding the panel. Closing restores focus to the opener. Hover or keyboard-focus a component row to highlight it in the model. Resizing and orientation changes preserve your viewing angle, pan and relative zoom while fitting the available canvas.

Visibility is a preview choice, separate from what your design includes. To omit or reinstall a display frame and its three frame magnets, open **Parts → Frame → Installed display frames** and change Left or Right. This changes the saved configuration and print kit. **Show all** reveals installed parts; it does not reinstall an omitted frame. Case, frame and battery edits retain explicit **Both / Left / Right** targets.

**Undo / Redo** keeps 40 design steps during the current session. Ctrl/Cmd Z and Ctrl/Cmd Shift Z work outside text fields. One continuous color gesture is one step. View changes are separate from design history.

In **Files**, give your design a name and save its JSON. Load that file to return to the same shapes, per-key colors, frames and batteries. JSON also transfers selections to FreeCAD.

## The home page

[flankbd.com](https://flankbd.com/) opens on a live, simplified configurator; the full explorer is at [`/explore/`](https://flankbd.com/explore/). On load the layers ease apart, then the keyboard turns and floats slowly until you drag it. The vertical slider separates or reassembles the layers, ⏸ stops the standby motion and the cube resets the view. Pinch or ⌘/Ctrl-scroll zooms, so ordinary scrolling still moves the page.

- **Size, Theme, Case, Keycaps and Frame** change the model at once. Theme colours the case, frames and keycaps exactly as the explorer's theme presets do, and the page eases to colours derived from it in about 600 ms; dark-bodied themes give a dark page. Every option's thumbnail is rendered live in the current colours.
- **Browse 6** lists the six magnetic frames. Hovering one previews it on the model; nothing changes until **Apply**, for both halves or one. A frame keeps the theme's colours unless you choose its own palette.
- **The spec sheet** draws each card from the same model in the current colours: the 14.5 mm profile and the 18 × 17 mm pitch with dimensions measured from the meshes, the nice!nano, the nice!view, the four sizes, the separated electronics stack, the six frames and the PCB. They render when the sheet nears the screen.
- **Open this build in 3D** opens the explorer on the same design. English by default; **ES** switches to Spanish. The last look and language stay on the device.

The explorer accepts the same look as a link: `explore/?size=flan54&theme=gameboy&case=terrace&keys=saddle&frame=talavera,gameboy&palette=frame,theme`. Every parameter is optional (Flan36, SNES, Color rim, Original and the theme's frame, or the default frame). `frame` and `palette` take one value for both halves or `left,right`. The look opens as a new design: **Undo** returns to the saved one, and the parameters leave the address so a reload keeps later edits. The flan lockup at the left of the bottom bar returns to the home page.

`node viewer/build.mjs` writes the explorer and then the home. `viewer/home-build.mjs` (also runnable alone) welds, simplifies and meshopt-encodes the scene's own meshes: one common pack of keycaps, switches, frames and electronics, and one pack per size with its four cases and PCB. Its receipt, [`validation/revI-home.json`](../validation/revI-home.json), records each family's error bound, source and result triangle counts and pack sizes. Fasteners, magnets and the underside diodes are left out. The model draws one instanced call per repeated mesh (switch housings, stems, sockets), about 130 calls in all. Resolution follows the frame rate, the standby motion draws every other frame, and thumbnails render one at a time while the model is still, read back from the GPU without stalling it. A browser without hardware acceleration gets no antialiasing, a lower resolution and no standby motion. `viewer/home-performance.cjs` measures load, intro, standby, a drag and a theme change on the real GPU (`FLAN_GL=software` for the worst case). On 2026-10-18 on an Apple M5 at 1920 × 1080 and 1440 × 900, both at 2×, every phase held 60 fps with one 70 ms task at load; with software rendering a drag held about 50 fps.

`viewer/home-poster.cjs` renders the poster shown until WebGL is ready and the social image from the built page; `viewer/home-check.cjs` serves `docs/` and checks the page end to end, including the explorer opening on the chosen look.

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

The browser checks drive the current controls: bottom navigation, Design tabs, Parts rows with eye and **Solo**, and part pages with **Visible / Solo / All**. They load `docs/explore/offline.html`; `reliability-check.cjs` also serves `docs/explore/index.html` locally to exercise the online print loader. The removed half filter, leader lines, annotations and per-key shape editor are covered by their current equivalents: per-piece eyes, hover highlights, part pages and design-file import.

On 2026-10-18, with playwright-core 1.56.1 and Chrome for Testing 156, these passed with no runtime errors against the then `docs/offline.html` SHA-256 `0fd8a433…`: `variant-check.cjs` (every built size and back, with persistence), `check.cjs`, `responsive-check.cjs`, `customize-check.cjs`, `frame-orientation-check.cjs` (Game Boy and Hanafuda), `battery-leads-check.cjs`, `cap-rows-check.cjs`, `reliability-check.cjs`, `frame-collection-check.cjs`, `display-seam-check.cjs`, `loading-check.cjs`, `keycolors-check.cjs` and `hex-check.cjs`.

Run any check with a local Playwright and Chromium:

```sh
FLAN36_PLAYWRIGHT_MODULE=/path/to/playwright-core FLAN36_BROWSER=/path/to/chromium node viewer/check.cjs
```

`capture-readme.cjs` regenerates the README images (`revI-assembled`, the Solid, Color rim and Terrace `revI-case-*` captures and `revI-pcb-underside`) from `docs/explore/offline.html` and records their hashes in [the image receipt](../validation/revI-readme-images.json):

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
