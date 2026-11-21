# Glue-in magnet sockets

The [Flan configurator](https://flankbd.com/explore/#build-print) uses these meshes in its 3MF and STL downloads. Each base takes three axial Ø2 × 3 mm magnets from above. Each frame takes three axial Ø2 × 4 mm magnets from the underside. The artwork and exterior case floor stay closed.

The two [fit coupons](revI/) reproduce one base and frame station. Enable thin-wall detection when slicing the base coupon as a standalone STL. The combined project enables it on each base. Check attraction in the assembled position and let the adhesive cure with base and frame separated. See the [assembly guide](../../docs/build.md#magnetic-frame-and-service).

The unchanged editable STEP and FreeCAD reference models under `mechanical/revI` have enclosed pockets. From the repository root, run `python3 tools/glue_pockets.py` to regenerate these printable derivatives and `python3 tools/check_glue_pockets.py` to verify full-diameter insertion, blind seats and oriented seams.
