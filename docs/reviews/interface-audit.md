# Interface and current-design audit

Request: review the site for obsolete interface/design patterns and update them.
Baseline: clean main at ae27529a51c0db90c546548a32d25a27573fae84.

Acceptance covers the home configurator; Design, Parts, Build, About and recovery;
active branding/frame galleries; and the public verification path. Preserve all
configuration choices, saved data, Undo/Redo, exact exports, physical-validation
limits, approved artwork and historical source evidence. Current workflows should
lead to the integrated Build with the chosen design. Desktop, phone and the minimum
shared 3D panel must show complete actionable labels.

Observed discrepancies before edits:
- Home Build/Parts/PCB/Firmware links still leave for Markdown; its header Explore
  link also drops the current look. Home address does not encode its own selections.
- General editor segmented controls retain shrinking/ellipsis. The real 280 px
  panel clips Both halves (63/82 px), Columna (47/65), and battery choices. Build's
  corrected controls did not fix this shared implementation. Case labels and the
  selected battery summary also clip.
- The active frame gallery and its generator call the old Z13.59 datum current.
  docs/level-stack.md establishes Z14.50 with the supplied display connector.
  Approval drawings must remain frozen and be identified as approval references.
- About links the historical slim-flush stack instead of the current connector stack.
- Public readback uses removed controls and the old offline route; home regression
  still requires stripping design parameters, contrary to the live-address request.

The six approved frame IDs and current Flan branding remain present. Retired-frame
migration and protected saved-data recovery are preserved. Historic proposals are
not active configuration choices; original geometry/artwork is not altered by this audit.

Before captures under build/interface-audit/ are generated with
`node viewer/interface-audit-check.cjs --before`. The initial desktop captures
incorrectly reset to the top of the stacked panel; the audit now scrolls each
section into view. Home captures wait for actual loaded previews, not button count.
This corrects evidence collection rather than treating empty previews as a product defect.

Two independent read-only reviews use UX/domain and adversarial/reliability lenses.
Their baseline hashes are temporary; no reviewed source may change except through
attributable implementation by the root. Review dispositions and verification follow.

Review disposition: both reviewers recommend updating these active surfaces without
changing geometry, approval history or recovery. HIGH current-height discrepancy is
corrected in generator and output: 14.50 mm current, 13.59 mm explicitly earlier R8.
HIGH evidence gaps are corrected with strict assertions, section-specific captures,
loaded-preview waits and current public UI selectors/routes. The compatibility
/offline.html page is retained and verified as its own redirect document.

Home now encodes its look and restores incoming look parameters. All active buying
and building entries carry that look to the correct integrated step, after design
restoration. The primary action explicitly customizes the displayed selection;
returning users also have Continue my saved design, which opens the full saved
configuration without reconstructing it from the simpler home controls. A mixed
battery/PCB/frame roundtrip checks exact preservation.

Shared editor selectors wrap without eliding actionable labels. Long battery
choices and case names remain complete. Mobile theme options use enough width for
Monochrome, found by the expanded content-overflow check. Wide docks keep preview
cards compact and arrange color fields and left/right key maps in two columns.
The existing Print controls and recovery actions remain separate patterns.

A first local public-path run reached all new routes and preservation checks, then
measured the camera before deferred Flan42 geometry finished loading. The test now
waits for the existing geometry-ready status before comparing camera state; no
camera behavior or assertion was removed. The other test failure was an unquoted
numeric CSS attribute selector in the new keyboard check; corrected in the test.

Verification completed on Chromium 151.0.7922.34:
- 70 editor combinations: EN/ES, 1440 px with minimum and expanded docks,
  768, 390 and 320 px; no overflowing control labels.
- Visual inspection: narrow battery controls, expanded case fields and key maps,
  mobile keycaps, loaded home previews and the illustrated Build cards.
- Home regression: live model, hover/apply, per-half frames, language, phone/tablet
  layouts and the selected look carried into the explorer.
- 12 Print layouts: complete labels, compact actions, keyboard activation,
  actual selected-half ZIP and portable illustrated guide.
- Local end-to-end: six byte-exact pages, live home address and fresh-context
  restoration, all six Build destinations, exact advanced saved-design roundtrip,
  actual guide and print-kit downloads, STL hashes, camera and Undo preservation.
  The local report identifies the working-tree baseline; the public report uses
  the published commit and repeats the journey against flankbd.com.

Reproduce from this commit (Playwright must resolve through the environment):
```sh
npm --prefix viewer run build
python3 tools/build_frame_review_page.py
node viewer/interface-audit-check.cjs
FLAN36_BROWSER_ANGLE=metal node viewer/home-check.cjs
node viewer/build-controls-check.cjs
node viewer/public-check.cjs --local "$(git rev-parse HEAD)"
node viewer/public-check.cjs "$(git rev-parse HEAD)"
```
Set `FLAN36_PLAYWRIGHT_MODULE` to the installed Playwright module when it is not
in Node's lookup path. Captures, downloaded test configurations, guides, kits and
browser reports remain ignored/reproducible in `build/interface-audit/`,
`build/home-check/` and `build/build-controls/`. Their commands above validate the
regenerated artifacts. Historical before captures correspond to baseline ae27529;
rerunning `--before` on a newer revision inventories that newer state instead.
The temporary reviewer-baseline hash inventory is removed after review.
