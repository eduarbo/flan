# Build focus and complete package
Baseline: clean main at 0b5ed7d.

User correction: spacing and hierarchy still fall below the requested standard;
the section navigation must follow scrolling. Add one ZIP with shopping list,
each selected PCB's Gerbers, matching firmware, complete print kit, guide and
configuration. Support focusing on Build without the 3D, and responsive compact
options.

Acceptance:
- A focused Build workspace, optional 3D and preserved Design/Parts interaction.
- Deliberate spacing at rest and while sticky; an active section on scroll/click,
  keyboard-accessible navigation and useful compact layouts at narrow widths.
- Complete, configuration-consistent ZIP for both halves, independent of a
  separate print subset; verify archive entries, file bytes, hashes, quantities,
  PCB editions/colors, firmware size and complete print-kit manifest.
- Failed/mismatched downloads cannot produce a deceptively complete ZIP.
- Preserve shopping, guide/CSV, sharing, recovery and individual downloads.
- Inspect actual desktop/mobile layouts, including scroll transitions, and
  publish only after the scoped functional checks and independent review.

Failed assumption: functional list/download checks and no-overflow screenshots
were treated as sufficient UI acceptance. The previous large pill actions and
sticky background shadows joined visually, and navigation had no scroll state.
This correction changes the composition and interaction, not only box spacing.

Implemented: Build opens as a focused reading workspace, with optional 3D and an
Edit design action. A bounded content width, two-column desktop introduction,
compact controls and expandable selection/part details replace the large stacked
actions. Sticky navigation follows manual scrolling, section clicks and layout
changes, with aria-current and horizontal visibility for the active section.
The separate print controls, purchasing progress, recovery and sharing remain.

The complete-build exporter snapshots configuration and documents before async
work. It includes both selected PCB packages, size-matched UF2s (with the optional
single-display right image identified separately), a full two-half print kit,
all selected keycap meshes, fit samples, shopping CSV, a portable HTML guide with
local file links, configuration, order notes, licenses and a hash manifest.
Assets are content-addressed on the site's origin and verified against their
published lengths and SHA-256; a mismatch fails the entire export. There is no
new remote write, supplier order, printer profile or physical qualification.
The offline HTML offers the exact design online for this network-dependent ZIP;
its existing embedded individual print export is preserved.

Independent review: one read-only domain/product reviewer and one adversarial
reliability reviewer recommended publication after resolving the same HIGH issue:
`build/` also ignored the new public asset directory. A narrow .gitignore exception
makes the directory trackable; staging uses the 111 exact receipt paths, followed
by an index/tree byte check. Content-addressed assets disable Git text normalization
so every published download retains its verified bytes. The license copy uses
the repository's canonical LF bytes, eliminating a worktree-only CRLF difference. Both reviewers reported no CRITICAL issue.
The adversarial reviewer also found delayed cancellation during shared geometry
loading (MEDIUM). A cancellable wait now releases the export immediately while
shared loads may finish caching; failed exports also abort their sibling file
requests. Ten reviewed-source hashes remained unchanged during the review round.

Verification and reproduction (locked viewer runtime; Playwright module location
may be supplied through FLAN36_PLAYWRIGHT_MODULE):

    npm --prefix viewer run build
    node viewer/config-contract-check.cjs
    node viewer/build-focus-check.cjs
    node viewer/build-check.cjs
    node viewer/pcb-check.cjs

The focus check verifies 320/390/768/1440 px, both languages, active navigation for
all six sections, sticky separation, optional 3D, preserved design, 111 exact
asset sources and a real complete Flan54 ZIP with mixed PCB editions/colors and
batteries. The individual print selection deliberately contains only the right
shell; the complete ZIP must still include both halves and all 54 keycaps.
Configuration changes during download must not alter the captured build. Every
archive entry hash, source-backed file and guide-local link is checked. Corrupt
files produce no ZIP; cancellation is checked during files and geometry loading,
followed by successful retry. The offline file's exact online-design link is
also checked. Existing build checks cover all four sizes, shopping persistence,
quantities, CSV/guide, recovery and individual print; PCB checks retain independent
choices, mask/ink, sharing, undo/redo and rendering. Configuration parity has 178
fixtures. No PCB, firmware, keycap or CAD source bytes change.

Generated pages/asset copies and receipts are committed. The existing scene is
reused (its recipe remains in pcb-identity.md). Screenshots and downloaded test
archives under build/build-focus/, build/build-workflow/ and build/pcb-identity/ are
ignored, reproducible outputs of the commands above; ZIPs are validated against
source hashes and their nested manifests. Tests close browsers and local servers.
The temporary review-baseline receipt is task scratch and removed after readback.

Prevention addresses this observed recurrence: check actual composition and
scroll interaction at narrow and wide widths, then exercise real output files
and ensure the published Git tree contains every runtime asset. Passing only
text/download existence or overflow assertions is insufficient visual evidence.
Delivery remains public eduarbo/flan origin/main and its existing Pages explorer.
