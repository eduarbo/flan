# Historical revF editable-study review

**Scope: revF editable CAD and visualization, not manufacturing approval.**
Two independent reviews examined geometry, the CAD/ECAD workflow and risks; a second round compared the recessed battery and open frame proposal.

| Finding | Resolution / remaining state at revF |
|---|---|
| Moving the controller without lowering the battery intersects USB and cell | Cradle lowered through a real PCB opening; nominal cell/USB separation 1.4 mm |
| Display, header, JST and supports can overlap after alignment | Supports rebuilt from PCB level; JST/reset/power switch relocated; modeled solids separated |
| STEP import does not deliver parametric case editing | Native FCStd with sketches, operations and parameters; edit/save/reopen tested |
| Small opening and copper margins | 0.15 mm cradle/opening; 0.22 mm pad/edge. DRC fails the configured 0.5 mm rule; retained as unresolved |
| Shorter frame does not imply smaller total width | Width ≈126.2 mm; depth ≈94.5 mm; frame top 16.6 mm |
| Zero overhang lacks tolerance allowance | USB only 0.045 mm behind the neighboring cap in plan; nominal alignment, not physical guarantee |
| Retainer and removable parts lack service tests | Fastening, wiring, removal paths and fit remain open |

Both reviewers supported publishing the study with digital evidence and explicit limits. Manufacturing objections remained unresolved. Eight baseline files retained their hashes during both review rounds before attributable edits began.

The previous STEP assembly allowed inspection but lacked the needed parametric editing. RevF added FCStd source and edit/reopen checks. Images and viewer inputs were linked by hashes to detect stale representations. PCB/CAD comparison used real import and separate readback; a failed DRC was not relabeled as hardware approval.

RevG subsequently adds separate keycap-envelope checks: revF solid intersection checks did not cover the KLP meshes. [Current review](revG-review.md).
