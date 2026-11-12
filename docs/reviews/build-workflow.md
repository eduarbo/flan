# Configuration-driven build workflow

Request: keep the information needed to order and build the selected keyboard
inside the explorer, replacing generic summaries and mandatory trips to Markdown;
also fix the inconsistent alignment of recovery actions.
Baseline: clean `main` at `5037b67`.

Required outcomes:
- An itemized buying list derived from size, per-half batteries and installed
  frames, with exact references, quantities, pack selections and supplier links.
- Usable shopping progress and portable copies of the list and build instructions.
- Per-half PCB downloads and order settings, selected print contents and fit
  samples, contextual firmware downloads, and assembly instructions in the page.
- Consistent recovery action alignment; existing save/import/recovery, print-kit,
  sharing, independent PCB choices and all four sizes remain available.
- Functional and visual checks of the complete path on desktop and mobile in
  English and Spanish, then normal synchronization and public readback.

Observed cause: the Build panel composed summaries and reference links rather
than a build plan. Its shopping text used only the key count and screws; it never
resolved battery choices. Firmware listed three files with equal emphasis. Print
contents were hidden inside the downloaded kit. Recovery downloads explicitly
used left-aligned text while adjacent recovery buttons inherited centered text.

Scope: the explorer's build workflow and its immediate entry points. Existing
parts, electronics, assembly and firmware documentation supplies the technical
content. Supplier links remain the place to confirm price, stock and checkout.
Physical prototype qualification remains distinct from a usable digital guide.

Implemented:
- A shared purchasing catalog resolves key counts/spares, size-specific screws,
  per-half cells and installed-frame magnets. Checked lines persist locally and
  changed quantities no longer count as ready. No stock is assumed to be owned.
- Supplier links preselect Pro Red, Choc sockets, the white PCB jack and the
  301230 WHT PH connector. Public Typeractive product data was read on 2026-11-11;
  its pages confirm ten-piece switch/socket/diode packs, two jacks per pack and
  the included nice!view connectors. Prices and availability remain checkout data.
- Build contains PCB order settings, selected print parts/colors and fit-sample
  downloads, connector/soldering steps, contextual UF2 files, flashing, assembly
  and physical checks. Technical Markdown links are supplemental references.
- CSV exports the current shopping quantities/progress. The portable HTML guide
  includes all expanded instructions and a link reopening the exact design for
  its generated print kit. Its browser print command can save a PDF.
- The Build panel has its own wider/taller initial size and sticky step navigation.
  Manual resizing and the Design panel's size are preserved. Recovery actions
  share alignment, width, padding and wrapping; recovery messages name Build.

Verification: the browser check passes all four sizes; mixed cells, cases, frame
installation, PCB editions and masks; selected supplier variants; persistent
shopping progress; quantity invalidation; CSV and portable guide readbacks; the
guide's fresh-context design link; print subsets; and a real complete Flan54 ZIP
whose physical parts match the visible inventory exactly. Existing configuration
checks pass 178 JS/Python parity fixtures. The independent PCB check still passes
sharing, history, mask/ink and edition rendering across all sizes. The previous
README PCB render remains byte-identical.

Desktop (1440 px), mobile (390 px), and small phone (320 px) captures were visually
inspected, including ordering, print contents and recovery. No page errors or
unintended page overflow occurred. The wider Build view corrects the observed
mobile problem where the original half-height sheet barely showed the first item.

Reproduction, from the repository root with the existing locked viewer runtime:

    npm --prefix viewer run build
    node viewer/config-contract-check.cjs
    node viewer/build-check.cjs
    node viewer/pcb-check.cjs

For an externally installed Playwright module, set FLAN36_PLAYWRIGHT_MODULE to
its path. Verification used Chromium 151.0.7922.34 and the checks' Metal flags.
Receipts: validation/build-workflow.json and validation/revI-viewer.json.
The generated scene is reused; its regeneration is documented in pcb-identity.md.
The checks close their browsers and servers. Captures and downloaded test
artifacts under build/build-workflow/ are ignored and reproduced by build-check.cjs;
its ZIP is validated by reading the manifest and comparing it to the visible list.
No source PCB, fabrication package, firmware or geometry changed.

Prevention for the demonstrated recurrence: keep configuration-dependent build
content in the app, resolve quantities from the same family/print registry used
for output, and exercise the actual buying/export path in the browser instead
of accepting a working reference link as the build outcome.

Delivery target: the configured public eduarbo/flan origin/main and its Pages
explorer. No orders are placed by this change.

The two independent read-only reviewers reported no HIGH/CRITICAL findings and
recommended publication after two MEDIUM wording corrections. Applied both:
USB/display/reset checks now use the single listed cable one half at a time;
the complete key/chord/layer test follows assembly with verified cells. Settings
controls are identified by Q–P positions, so added number rows are not mistaken
for the active control row. The browser acceptance check retains the exact key
count at its corrected stage and checks both instructions in the exported guide.

All 29 baseline hashes were unchanged during review. The only subsequent source
edits are those two instructions and their focused assertions, plus regeneration.
A LOW residual is confined to shopping progress: simultaneous tabs can overwrite
their checklist maps. Design/configuration persistence keeps its existing
concurrency protections; shared checklist synchronization is not claimed.
