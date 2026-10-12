# Port and viewer refinement

Request: user 2026-10-11, “pues abordalo”. Baseline: `b86574ae5366a4d0ee397d3c3683c709b899a67d`, clean checkout.

## Required outcomes

- **ports**: Refine USB and power-switch openings without obstructing plug insertion or actuator; current native CAD, exports, viewer and print kits agree.
- **magnets**: Explain three magnet pairs per half and provide a viewer action that reveals their location.
- **parts**: Hide and Solo on component rows, Show all in header, Inside and Stack in Components; selecting a part replaces panel with details and Back restores prior panel.
- **drawer**: Remove Expand; mobile drawer has draggable snap positions for model, split and panel focus with independent content scrolling and responsive 3D canvas.
- **navigation**: Replace design-category select with tabs; remove View nav/modal, Half and Part links controls; floating camera segments and vertical layer slider; Reset in nav; traditional undo/redo icons.
- **design**: Remove Shape and rotation and Case display-cover setting; inline Colors and Finish in Case/Frame/Keys; polished visual hierarchy and spacing.
- **verification**: Validate phone, landscape, tablet and desktop interactions, persistence/history, model and print exports; commit and synchronize attributable changes and verify public delivery, without claiming physical qualification.

Status: implementation in progress. Digital qualification does not establish physical fit or magnetic retention.

## Decision review

Two independent read-only reviews (domain and adversarial), against the 17-file baseline, agree on the following bounded implementation. All baseline hashes were unchanged after review.

- Preserve the nominal 12 × 5 mm USB insertion corridor; restore only proven excess cutout volume, using the saved native CAD. Verify every case/frame and both halves. Physical fit remains unqualified.
- Use explicit drawer routes with a selected-part page and Back restoration, three mobile snap positions, and canvas resizing to the remaining space. Drag starts only on the handle.
- Keep configuration installation distinct from temporary component visibility. Parts provides explicit frame installation so saved `cover=false` designs remain recoverable.
- Locate magnets with their existing stable PartIDs; do not change frame-magnet installation semantics.
- Remove obsolete controls and dependent handlers together. Imported key shape/rotation data and curated presets remain supported.

High findings (USB obstruction, inconsistent variants, stale DOM dependencies, inaccessible omitted frames) and medium findings (actuator sweep, native refinement preservation, scroll/drag conflict, navigation restoration, magnet grouping, widget crowding) are acceptance conditions above. No unresolved material disagreement remains on this approach.

Reproducible local outputs: `python3 -m http.server 8767 --bind 127.0.0.1 --directory docs` serves the built viewer. `node viewer/build.mjs` creates online/offline pages from the source-bound scene; `python3 tools/check_stock_print.py` verifies complete print kits. Temporary baseline, browser captures and receipts live under ignored `build/interaction-redesign/` and are validated against the committed sources and checks recorded below.

## Viewer outcome

Implemented the complete navigation/visual requirement set. Direct CUA checks are recorded in [the interaction receipt](../../validation/revI-interaction.json): 320/390 px phones, 844 px landscape, 768 px portrait tablet, and 1440 px desktop. Pointer dragging, keyboard snap changes, component/list and actual canvas selection, Back, installation, visibility, presets, colors, persistence and undo/redo were exercised. No browser runtime errors were observed in those paths. These observations do not claim the adapted Playwright CLI suites ran or a physical iPhone was tested.

The review caught stale active camera/preset indicators; the corrected UI verifies Top → Magnets selects 3D, and Solo PCB/MCU do not mark Inside/Stack. A pre-existing character-range regex also erased individual part names; the corrected expression retains each named magnet and station. Camera framing now reserves the area occupied by the floating widgets. Duplicate Components headings and introductory text were removed after the first mobile screenshot showed they pushed the actual rows below the fold.

Physical keyboard acceptance remains separate from these digital UI and geometry outcomes.
