# RevG review and verification scope

Two independent read-only reviews examined the same clean revF snapshot: one mechanical/domain review and one adversarial reliability review. The 12 enumerated input hashes remained unchanged during review. Both recommended a complete Choc-stem catalog with per-configuration qualification and opaque interchangeable covers using the existing mounts.

| Finding | Disposition |
|---|---|
| **High:** old solid intersection checks excluded KLP mesh bodies | Added dedicated keycap configuration checks: unchanged convex XY envelopes, frame clearance and a nominal travel/plate bound |
| **High:** a Choc stem does not imply every body fits every position | 38 files catalogued; 28 have qualified reference positions. Recheck each mixed configuration. Keep 1.5U unavailable, with the conservative test’s limits stated |
| **High:** `90deg` changes stem axis, not simply the file’s visual pose | Derive orientation from actual stem geometry; rotate the cap 90°/270° while retaining switch centers and angles |
| **Medium:** tilted caps have a different mesh origin | Align actual bottom stem tips to one nominal datum; retain physical seating as unresolved |
| **Medium:** rails might be mistaken for display supports | Preserve the independent sled; replace only outer covers with a common cavity/window/mount interface |
| **Medium:** covers could block plugs, switches or screws | Check each style against component envelopes and a 12 × 5 mm USB plug corridor; preserve switch/reset openings and recessed screw access. Real tools/cables remain untested |
| **Medium:** appearance-only swaps could diverge between viewer and CAD | One JSON schema, unchanged source meshes and a transactional FreeCAD macro; GLB carries the selected configuration |
| **Medium:** new retention/magnets or metal covers add unverified behavior | Keep polymer screw-mounted covers; no new magnets or snap-fit mechanism. RF and physical fastening remain open |

No material disagreement remained in the design review. This supports publication as a digital study, not fabrication, purchases or hardware acceptance.

## Bounded correction

The first closed-cover test detected **2.717649 mm³** of intersection with the controller’s front corners. The correction added a 0.3 mm nominal controller clearance cut next to the USB opening without increasing the bay outline. The same component/cover checks were rerun for all styles and both halves.

A visual inspection also caught side slits in the wide-bevel variant: its upper taper crossed the shared cavity before the roof began. The taper now starts at the roof underside, preserving opaque side walls. Closed solids alone would not have caught this appearance defect; the comparison render is part of the review.

The old GLB download filename still said revE. It now takes the current scene revision, and the browser test checks both filename and selected-configuration metadata. Render and viewer receipts link their current geometry inputs so stale imagery can be detected.

The Typeractive source check also found different socket/switch/button parts and a battery too wide for allowance in the existing cavity. They are documented as unqualified alternatives; the current hardware reference was not silently changed.
