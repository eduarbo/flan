# Live design address and illustrated shopping cards

Request: the address should always reopen the current design without Share;
replace full-width shopping rows with compact, responsive cards and illustrations.
Baseline: main at 50df1dcfc59d7fdaf8c333b959242eda9682975c, clean tracked/untracked tree.

Acceptance:
- Address follows edits, import and Undo/Redo; fresh browser opens that exact build.
- Preserve incoming-link precedence, unrelated query/hash, browser history length,
  local save/recovery behavior and offline viewer operation. Share remains a copy shortcut.
- Shopping cards use multiple columns when space permits. Full names, quantities,
  supplier variants, checklist and expandable technical notes remain available.
- Illustrations are embedded in the viewer and portable guide; no supplier image
  requests, external image dependency or extra WebGL context.
- Verify EN/ES at 320, 390, 768, 1024, 1440 px and the actual 280 px shared panel;
  inspect rendered cards, all four quantity variants and real guide/ZIP output.

The old link refreshed only while Build was open and removed its design parameters
on arrival. Synchronization now starts after URL restoration, encodes each edit synchronously with the already bundled fflate and replaces the
current history entry before returning from the change.
File URLs keep their local address; the copyable link targets flankbd.com.
Configuration remains in the URL itself, with local browser storage as before;
there is no server session. The address does not encode shopping checklist or camera.

Cards use an auto-fit grid based on the available panel width, not viewport size.
Component renders reuse the existing nominal CAD (nano, display, Choc switch/socket,
power and reset). Original procedural drawings identify batteries,
an open PH header, loose contacts, diode, feet, cable, tape, screws, magnets and tools. They are not
supplier photographs or manufacturing drawings. Existing CAD provenance remains in
components/README.md; standalone guides now carry illustration credits and license links.
Images are generated once with the existing preview renderer and copied as data URLs
into exports. Temporary procedural geometries are disposed after rendering.

Verification is reproducible with the existing scene:

```sh
npm --prefix viewer run build
FLAN36_PLAYWRIGHT_MODULE=/Users/eduarbo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node viewer/design-cards-check.cjs
FLAN36_PLAYWRIGHT_MODULE=/Users/eduarbo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node viewer/build-check.cjs
FLAN36_PLAYWRIGHT_MODULE=/Users/eduarbo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node viewer/build-focus-check.cjs
```

Captures and exported test artifacts under build/design-cards/, build/build-workflow/
and build/build-focus/ are ignored and reproducible with those checks. Receipts are
validation/design-cards.json, validation/build-workflow.json and validation/build-focus.json.
The focused check also checks same-task edits and reloads twice without waiting, tests denied storage, checks
all 21 embedded illustrations in the mixed-battery guide, and opens the offline viewer
without HTTP requests. Desktop, Spanish mobile and minimum shared-panel captures
were visually inspected: 3/2/1 columns, full labels, distinct component images.

Two independent read-only reviewers inspect the enumerated sources and captures
before publication, using UX/domain and adversarial/reliability lenses. Their
recorded review baseline is temporary; only attributable implementation edits may
change it. Review outcomes and final verification follow below.

Review: the UX reviewer recommends publication, with a medium accessibility note
and low PH-angle note. Details now has the component name in its accessible label;
the PH illustration now shows an open header with contacts instead of the closed
mated envelope. The adversarial reviewer identified HIGH: an edit could save locally
while the debounced URL still held the old configuration, and immediate reload
would reapply that URL. Removed debounce/asynchronous encoding; the URL is updated
synchronously on the same configuration change. A new test clicks Undo and reloads
within one browser task, then reloads again and verifies both design and storage.
The only source change during their baseline comparison was an attributable guide
credit addition by the root agent; reviewers made no mutations. No CRITICAL finding.

Final local acceptance: all 12 layout/language cases pass with no clipped labels,
all 21 embedded illustrations, unique accessible component details, and portable
images without network requests. The reset illustration was inspected from its
button side, consistent with its underside-mounted assembly pose. Immediate
same-task reload, a second reload, exact reopening in a clean browser, import,
default restore, Undo/Redo and denied storage pass. Existing four-size shopping,
CSV, guide, individual print ZIP and complete Flan54 ZIP checks pass; the complete
ZIP retains configuration snapshot, per-half files, hashes, cancellation and retry.
The built receipt matches every source hash. HIGH resolved by the functional
reload test; both reviewers' publication conditions are satisfied. No unrelated
baseline edits were present or absorbed.
