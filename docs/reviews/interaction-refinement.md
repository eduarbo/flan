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

Status: digital implementation and local verification complete. Public readback is generated after synchronization using the command below. Digital qualification does not establish physical fit or magnetic retention.

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

Files also uses direct segmented choices for halves and kit contents. At 390 × 844,
the page has no horizontal overflow and no remaining select elements. Actual
downloaded left-shell and both-complete ZIPs contained 3 and 20 printed parts,
respectively; ZIP CRC and every STL matched their sources. CUA's download-event
wait did not report the file, so the check inspected the actual newly created
Downloads files instead. Those test copies were moved to ignored
`build/interaction-redesign/download-smoke/` after hash verification. Reproduce
with Files → Left → Shells + frame, then Both → Complete kit; these copies verify
the UI path before port replacement, while the final kit check binds new geometry.

Physical keyboard acceptance remains separate from these digital UI and geometry outcomes.

The mechanical checks exposed two verifier assumptions before native replacement:
the switch's colored library object is a collection of faces, so the moving-tab
envelope must come from its closed source solid; and a zero-volume Boolean delta
can be a null shape, which must be handled as an empty set. The corrected guards
retain the complete conservative actuator sweep and bounded-volume proof. A hashed
native checkpoint avoids repeating recomputation after a validation failure. An invalid
metadata node type also failed before save; its replacement was preflighted through
create, property writes, compression, archive CRC and reopen before installation.

## Mechanical result

The saved native file passed reopen checks for both halves, all 24 decorated
frame variants and all eight case components per half. The USB aperture is
12.4 × 5.4 mm around the retained 12 × 5 mm insertion corridor. The controller
relief stops 0.3 mm before the modeled PCB front. The power opening retains its
8.5 mm length and reduces its height from 4.1 to 2.2 mm; the conservative actuator
sweep and finger/nail approach remain unobstructed in the model.

The ten bounded comparisons show approximately 64.524 mm³ restored to each frame
blank, no removed material and no added material outside the port zones. The case
variants in those comparisons have no geometric delta. All 62 unrelated part
shapes and all twelve magnet shapes match the starting native document. Physical
cable insertion, switch operation and printed tolerances remain unqualified.

Three magnet pairs form a triangle around the electronics bay of each half.
The six base magnets are Ø2 × 3 mm and the six mating frame magnets are Ø2 × 4 mm,
captive inside the printed plastic. The Parts → Magnets route separates the
layers and uses screen-sized blue location markers so these tiny parts remain
visible on a phone without changing their geometry.

## Mechanical reproduction and delivery

The bounded installer refines the saved native document; it does not regenerate the
keyboard from the original builder. Its source revision is pinned to the baseline
above. The source backup under ignored `build/port-refinement/` is reproducible from
`git show b86574ae5366a4d0ee397d3c3683c709b899a67d:mechanical/revI/Flan36.FCStd`;
its SHA-256 must be
`4d24734a8da5b14317b6d0f3a42778844883d71b53f25994ed19dfd3f575fc30`.

From the repository root, using the installed FreeCAD Python environment:

```sh
python3 tools/freecad/run_macos.py tools/freecad/refine_ports.py
python3 tools/freecad/run_macos.py tools/freecad/check_ports.py
python3 tools/freecad/run_macos.py tools/freecad/export_revI.py
python3 tools/preserve_export_bytes.py --apply
/Applications/FreeCAD.app/Contents/Resources/bin/python tools/render_port_refinement.py
/Applications/FreeCAD.app/Contents/Resources/bin/python tools/build_viewer_revI.py
node viewer/build.mjs
/Applications/FreeCAD.app/Contents/Resources/bin/python tools/render_revI.py
python3 tools/check_stock_print.py
python3 tools/check_interaction_delivery.py
```

The installer validates an already-refined native file without applying the
modification twice. The current delivery check binds CAD, native reopen, mesh
exports, scene, online/offline viewer, renders and all six complete Level print
kits by hashes. Older all-magnet receipts remain evidence of their original
revision; they are not rewritten to claim unchanged port geometry.

The export preservation step retains baseline STEP bytes only when the sole
difference is the `FILE_NAME` timestamp. Binary STL bytes are retained only after
exact equality of every complete facet record, including normals, winding,
attributes and duplicate counts. The current model and mechanical manifest bind
the final bytes and the preservation receipt. This avoids timestamp-only churn
and keeps unchanged key-plate checksums valid without altering historic evidence.

After ordinary Git synchronization, run `python3 tools/check_public_delivery.py`
with the full published commit. Its ignored `build/revI/public-readback.json`
checks every anonymous source-archive entry and the exact public viewer,
offline page and printing payload against that commit. The downloaded source ZIP
is disposable after its hash and all entries pass.

## Final local verification

The saved native/reopen checks, both mechanical exports, seven CAD renders, port
comparison and all six Level print kits passed. The kits preserve exact STL bytes
and every registered color 3MF triangle. The checksum policy passed all 78
exception/detection controls. Ninety-four of 448 exports retained baseline bytes
after exact equality proof; the preservation checker rejects concurrent changes
to noncandidate exports or bound source files before certifying a result. Twelve
additional STEP files retain regenerated metadata: exact comparison found only the
FILE_NAME timestamp and Open CASCADE PRODUCT export counter changed; geometry
bytes remain identical.

After the final build, a 390 × 844 CUA reload verified the twelve blue magnet
markers, Show all returning 220 components and zero separation, and segmented
Files choices without selects or document overflow. No browser errors appeared.
The interaction receipt retains the preceding source snapshot and identifies the
marker-only change and final smoke check, separately from the earlier viewport
matrix. Port comparison: [before and after](../images/revI-port-refinement.png).

Publication scanning initially classified eight geometry checksums under key-plate
filename keys as possible credentials. The receipt now uses explicit `file` and
`sha256` records, keeping every before/after digest and preservation proof. The
bound receipt upgrade revalidated all 448 exports and retained its preceding
receipt/executor hashes. The secret scanner then accepted that receipt without
changing scanner rules or allowlists. Dependent metadata, scene, viewer and
verification receipts were rebuilt; no native or exported geometry changed.


## Camera selector follow-up · 2026-10-12

The reported cramped Bottom button came from seven minimum-width buttons plus
tray padding exceeding the available mobile width. The selector now uses original
SVG cube-face icons with visible labels, equal44×48px targets,2px gaps and4px
tray padding. Below354px of actual stage width, it uses four columns with3D
spanning two rows. No view is hidden in a horizontally scrolling strip. Adjacent
tools move to keep clear of the tray; a very short/narrow stage hides tools that
cannot fit. Keyboard names, focus and selected state remain explicit.

The scoped CUA regression in `validation/revI-interaction.json` covers320/375/390px
phones,844px landscape including a240px-wide stage,1440px desktop, and the
240×168px edge caught by independent review. All seven buttons were reachable,
Bottom activated with Enter and Space, and no camera/tool overlap or horizontal
overflow was observed. Prior CAD, printing and interaction evidence is retained
under its original snapshot; it is not claimed as rerun for this markup/CSS fix.
Rebuild with `node viewer/build.mjs`, serve using the local command above, and
repeat those camera/drawer cases. The existing delivery checker binds the final
source and page hashes without regenerating unchanged CAD or print kits.
For this UI-only follow-up, verify the anonymous public index/offline SHA-256
against `validation/revI-viewer.json`; the unchanged source archive and printing
payload do not need another download.
