"""Build a Flan variant's case from the revI document: same stack, bay, frames, magnets,
batteries and fasteners; the variant's outline, switch cuts and added fasteners.

Opens mechanical/revI/Flan36.FCStd (never saved back) and, per half:
1. replaces every outline sketch with the variant's profile, after checking that the sketch
   holds exactly the revI profile it stands for (outer, cavity, plate, rim, terrace, PCB);
   the profiles follow build_revI_profiles.py, which this runtime must reproduce for revI;
2. copies each added key's switch cut, switch, hot-swap and keycap from its template key
   (same row of column 1 for the outer column; same column of row 0 for the number row) and
   splices the cut into the plate chain;
3. adds each added fastener as a translated copy of H1's pillar, pilot, washer seat, board
   drill, plate hole, washer, screw and Level driver access, spliced into the same chains;
4. regenerates the Level cap openings for the variant's keys with level_stack's rule.
Then recomputes, checks every case part (one valid solid, closed mesh, no base/plate overlap,
caps clear of the Level shell) and exports them like export_revI.py.

Writes build/variants/<id>/<Title>.FCStd, mechanical/<id>/<side>-case-<style>-<base|plate>
.{step,stl} and validation/<id>-case.json. Physical fit is untested.
Run: python3 tools/freecad/run_macos.py tools/freecad/build_variant_case.py --variant flan42
SPDX-License-Identifier: GPL-3.0-or-later
"""
import argparse, hashlib, json, math, os, sys, time
from pathlib import Path

import FreeCAD as A
import Part
import MeshPart

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
sys.path.insert(0, str(ROOT / "tools/freecad"))
from outline import rounded                     # noqa: E402
from shapely.geometry import Point, Polygon     # noqa: E402
from shapely.ops import unary_union             # noqa: E402

V = A.Vector
MIRROR_X = 160
SKETCHES = {"OuterPadSketch": "outer", "CavitySketch": "inner", "PlatePadSketch": "outer",   # the frame cut comes later
            "RimOuterSketch": "outer", "RimInnerSketch": "rim_inner", "InsetPlateEnvelopeSketch": "rim_inset",
            "TerraceOuter0Sketch": "outer", "TerraceOuter1Sketch": "outer",
            "TerraceInner0Sketch": "terrace_inset", "TerraceInner1Sketch": "terrace_inset",
            "PCBPadSketch": "pcb_outline"}
KEY_PARTS = ("SwitchCut_{}Sketch", "SwitchCut_{}", "Switch_{}", "{}", "Hotswap_{}")
FASTENER_PRIMITIVES = ("Pillar", "Pilot", "WasherSeatTool", "BoardDrill", "PlateHole", "Spacer", "SpacerHole", "Shaft", "Head", "LevelDriverAccess")

def say(*a):
    sys.__stdout__.write(" ".join(map(str, a)) + "\n"); sys.__stdout__.flush()

def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()

# ---------------------------------------------------------------- profiles (build_revI_profiles.py rule)
def derived(controls, radii, frame_outer):
    outer, arcs = rounded(controls, radii)
    shell = Polygon(outer)
    assert shell.is_valid
    coords = lambda p: [list(v) for v in p.exterior.coords][:-1]
    return {"outer": outer, "outer_arcs": arcs,
            "inner": coords(shell.buffer(-1.3, join_style=2)),
            "pcb_outline": coords(shell.buffer(-1.65, join_style=2).difference(Point(133, 52.8).buffer(2.05, quad_segs=32))),
            "plate": coords(shell.difference(Polygon(frame_outer).buffer(.18, join_style=2))),
            "rim_inset": coords(shell.buffer(-1.1, join_style=2)), "rim_inner": coords(shell.buffer(-.9, join_style=2)),
            "terrace_inset": coords(shell.buffer(-.25, join_style=2))}

def mirrored(p):
    out = {}
    for k, v in p.items():
        if k == "outer_arcs":
            out[k] = [{n: [MIRROR_X - q[0], q[1]] for n, q in a.items()} for a in v]
        else:
            out[k] = [[MIRROR_X - x, y] for x, y in v]
    return out

def sketch_face(sk):
    return Part.makeFace(sk.Shape.Wires, "Part::FaceMakerBullseye")

def write_sketch(sk, family, prof):
    vec = lambda p: V(p[0], -p[1], 0)
    sk.deleteAllGeometry()
    geo = []
    if family == "outer":
        arcs = prof["outer_arcs"]
        for i, a in enumerate(arcs):
            geo.append(Part.Arc(vec(a["start"]), vec(a["mid"]), vec(a["end"])))
            nxt = arcs[(i + 1) % len(arcs)]["start"]
            if math.dist(a["end"], nxt) > 1e-9:
                geo.append(Part.LineSegment(vec(a["end"]), vec(nxt)))
    else:
        pts = prof[family]
        geo = [Part.LineSegment(vec(a), vec(b)) for a, b in zip(pts, pts[1:] + pts[:1]) if math.dist(a, b) > 1e-9]
    sk.addGeometry(geo, False)

# ---------------------------------------------------------------- document surgery
def containers(doc, obj):
    return [g for g in obj.InList if g.TypeId in ("App::DocumentObjectGroup", "App::Part") and obj in g.Group]

def clone(doc, obj, name, move):
    c = doc.copyObject(obj, False)
    c.Label = name
    for g in containers(doc, obj):
        g.addObject(c)
    if obj.TypeId == "Sketcher::SketchObject":
        geo = [g.copy() for g in obj.Geometry]
        for g in geo:
            g.translate(move)
        c.deleteAllGeometry(); c.addGeometry(geo, False)
    elif obj.TypeId == "Mesh::Feature":
        m = obj.Mesh.copy(); m.translate(move.x, move.y, move.z); c.Mesh = m
    elif obj.TypeId == "Part::Feature":
        s = obj.Shape.copy(); s.translate(move); c.Shape = s
    elif obj.TypeId == "Part::Extrusion":
        pass                      # follows its (translated) sketch; its own Placement only lifts it
    else:
        c.Placement.Base = obj.Placement.Base + move
    return c

def rewire(doc, old, new, skip=()):
    """Point every consumer of old (except new and skip) at new."""
    for user in list(old.InList):
        if user is new or user.Name in skip or user.TypeId in ("App::DocumentObjectGroup", "App::Part"):
            continue
        for prop in user.PropertiesList:
            t = user.getTypeIdOfProperty(prop)
            if t in ("App::PropertyLink", "App::PropertyLinkGlobal"):
                if getattr(user, prop) is old:
                    setattr(user, prop, new)
            elif t in ("App::PropertyLinkList", "App::PropertyLinkListGlobal", "App::PropertyXLinkList"):
                v = getattr(user, prop)
                if old in v:
                    setattr(user, prop, [new if x is old else x for x in v])

def add_keys(doc, p, keys, added, report):
    by = {k["ref"]: k for k in keys}
    chain_end = doc.getObject(p + "PlateDrill1").Base
    for ref in added:
        k = by[ref]
        tref = "K01" if ref == "K40" else (f"K{k['row']}1" if k["col"] == 0 else f"K0{k['col']}")
        t = by[tref]
        assert k["angle"] == 0 and t["angle"] == 0, ref
        move = V(k["x"] - t["x"], -(k["y"] - t["y"]), 0)
        made = {}
        for pattern in KEY_PARTS:
            src = doc.getObject(p + pattern.format(tref))
            assert src is not None, (p, pattern, tref)
            made[pattern] = clone(doc, src, p + pattern.format(ref), move)
        made["SwitchCut_{}"].Base = made["SwitchCut_{}Sketch"]
        cut = doc.addObject("Part::Cut", p + "Plate_" + ref)
        for g in containers(doc, doc.getObject(p + "Plate_" + tref)):
            g.addObject(cut)
        cut.Base, cut.Tool = chain_end, made["SwitchCut_{}"]
        chain_end = cut
        report.setdefault("keys", {})[ref] = {"template": tref, "move_mm": [round(move.x, 4), round(-move.y, 4)]}
    if added:
        doc.getObject(p + "PlateDrill1").Base = chain_end

def add_fastener(doc, p, n, xy, src, report):
    """Fastener n at board (x, y): a translated copy of fastener src's parts, spliced into the chains."""
    h = doc.getObject(f"{p}Pillar{src}").Placement.Base
    move = V(xy[0] - h.x, -xy[1] - h.y, 0)
    prim = {f: clone(doc, doc.getObject(f"{p}{f}{src}"), f"{p}{f}{n}", move) for f in FASTENER_PRIMITIVES}
    def op(kind, name, like, **props):
        o = doc.addObject(kind, p + name)
        for g in containers(doc, doc.getObject(p + like)):
            g.addObject(o)
        for k, v in props.items():
            setattr(o, k, v)
        return o
    # tray: ... WasherSeat5 -> TrayPillar6 -> TrayDrill6 -> WasherSeat6 -> (magnet posts)
    last = doc.getObject(p + "TrayMagnetPost0").Shapes[0]
    pillar = op("Part::MultiFuse", f"TrayPillar{n}", "TrayPillar1", Shapes=[last, prim["Pillar"]])
    drill = op("Part::Cut", f"TrayDrill{n}", "TrayDrill1", Base=pillar, Tool=prim["Pilot"])
    seat = op("Part::Cut", f"WasherSeat{n}", "WasherSeat1", Base=drill, Tool=prim["WasherSeatTool"])
    rewire(doc, last, seat, skip=(pillar.Name,))
    # PCB: ... PCBMount8 -> PCBMount(n+3)
    mount_last = next(u for u in doc.Objects if u.Name.startswith(p + "PCBMount") and any(c.Name == p + "PCBAllDrills" for c in u.InList))
    mount = op("Part::Cut", f"PCBMount{n + 3}", "PCBMount1", Base=mount_last, Tool=prim["BoardDrill"])
    rewire(doc, mount_last, mount)
    # plate: ... PlateHeadRelief5 -> PlateDrill(n) -> case plates and the Level shell
    relief = doc.getObject(p + "PlateHeadRelief5")
    hole = op("Part::Cut", f"PlateDrill{n}", "PlateDrill1", Base=relief, Tool=prim["PlateHole"])
    rewire(doc, relief, hole)
    # loose hardware and the Level shell's driver access
    op("Part::Cut", f"Washer{n}", "Washer1", Base=prim["Spacer"], Tool=prim["SpacerHole"])
    op("Part::MultiFuse", f"Screw{n}", "Screw1", Shapes=[prim["Shaft"], prim["Head"]])
    openings = doc.getObject(p + "LevelUpperOpenings")
    openings.Shapes = list(openings.Shapes) + [prim["LevelDriverAccess"]]
    report.setdefault("fasteners", {})[f"H{n}"] = {"xy_mm": xy, "copy_of": f"H{src}"}

def cap_polygons(keys):
    """Every admitted keycap variant and orientation at every key (level_stack.cap_openings)."""
    from keycap_config import polygon
    catalog = json.loads((ROOT / "keycaps/catalog.json").read_text())
    variants = [v for v in catalog["variants"] if v["qualified_reference_positions"]]
    return [Polygon(polygon(v["hull_xy_mm"], key, turn)) for key in keys for v in variants for turn in v["rotations_deg"]], len(variants)

def cap_sweeps(doc, p, keys, report):
    """level_stack.cap_openings for this half's keys."""
    polys, nvariants = cap_polygons(keys)
    exact = unary_union(polys)
    opening = exact.buffer(.25, quad_segs=8).buffer(.6, quad_segs=8).buffer(-.6, quad_segs=8)
    pieces = list(opening.geoms) if hasattr(opening, "geoms") else [opening]
    pieces = [Polygon(q.exterior).simplify(.015, preserve_topology=True).buffer(.02, quad_segs=4) for q in pieces]
    merged = unary_union(pieces)
    assert merged.covers(exact.buffer(.2, quad_segs=4))
    pieces = list(merged.geoms) if hasattr(merged, "geoms") else [merged]
    openings = doc.getObject(p + "LevelUpperOpenings")
    old = [o for o in openings.Shapes if o.Name.startswith(p + "LevelCapSweep")]
    rest = [o for o in openings.Shapes if o not in old]
    new = []
    for i, poly in enumerate(pieces):
        face = Part.Face(Part.Wire(Part.makePolygon([V(x, -y, 0) for x, y in poly.exterior.coords]).Edges))
        o = doc.getObject(f"{p}LevelCapSweep{i}") or doc.addObject("Part::Feature", f"{p}LevelCapSweep{i}")
        if o not in old:
            for g in containers(doc, old[0]):
                g.addObject(o)
        o.Shape = face.extrude(V(0, 0, 25)); o.Placement.Base.z = 7.6
        new.append(o)
    for o in old:
        if o not in new:
            doc.removeObject(o.Name)
    openings.Shapes = new + rest
    report["level_cap_openings"] = {"pieces": len(new), "poses": len(polys), "admitted_variants": nvariants}

# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--variant", required=True)
    ap.add_argument("--reuse", action="store_true", help="check and export the saved, already recomputed document")
    argv = sys.argv[1:]
    while argv and not argv[0].startswith("--"):      # run_macos.py passes its lib path and this script first
        argv.pop(0)
    a, _ = ap.parse_known_args(argv)            # e.g. -NSAppSleepDisabled YES, read by macOS for this run only
    vid = a.variant
    t0 = time.time()
    variants = json.loads((ROOT / "design/variants.json").read_text())["variants"]
    v = variants[vid]
    revI = json.loads((ROOT / "design/revI-profiles.json").read_text())
    frames = json.loads((ROOT / "design/revI-frame-profiles.json").read_text())
    pcbprof_path = ROOT / f"design/{vid}-profiles.json"
    pcbprof = json.loads(pcbprof_path.read_text()) if pcbprof_path.exists() else None
    # this runtime must reproduce revI's derived profiles before it may derive a variant's
    ref = derived(revI["left"]["control_vertices"], variants["flan36"]["outline"]["radii"], frames["left"]["outer"])
    for fam in ("inner", "pcb_outline", "plate", "rim_inset", "rim_inner", "terrace_inset"):
        got, want = Polygon(ref[fam]), Polygon(revI["left"][fam])
        assert got.symmetric_difference(want).area < 1e-6, ("revI profile not reproduced", fam)
    left = derived(v["outline"]["control_vertices"], v["outline"]["radii"], frames["left"]["outer"])
    if pcbprof:
        assert Polygon(left["pcb_outline"]).symmetric_difference(Polygon(pcbprof["left"]["pcb_outline"])).area < 1e-3, "PCB outline differs from the variant PCB"
    prof = {"left": left, "right": mirrored(left)}
    fasteners = [m for m in (pcbprof or {}).get("left", {}).get("added_mounts", [])]
    out_dir = ROOT / "mechanical" / vid
    out_dir.mkdir(parents=True, exist_ok=True)
    build = ROOT / "build/variants" / vid
    build.mkdir(parents=True, exist_ok=True)
    source = ROOT / "mechanical/revI/Flan36.FCStd"
    saved = build / f"{v['title']}.FCStd"
    report = {"schema": "flan-variant-case-1", "variant": vid, "title": v["title"], "physical_acceptance": False,
              "source": {"path": "mechanical/revI/Flan36.FCStd", "sha256": sha(source)}, "halves": {}}
    if a.reuse:
        doc = A.openDocument(str(saved))
        report = json.loads((build / "edit-report.json").read_text())
        say("reopened", saved.name, round(time.time() - t0), "s")
    else:
        doc = A.openDocument(str(source))
        say("opened", source.name, len(doc.Objects), "objects", round(time.time() - t0), "s")
    for side, p in (() if a.reuse else (("left", "L_"), ("right", "R_"))):
        rep = {}
        found = {name: sketch_face(doc.getObject(p + name)).Area for name in SKETCHES}
        fams = {f: Polygon(revI[side][f]).area for f in ("outer", "inner", "plate", "rim_inset", "rim_inner", "terrace_inset", "pcb_outline")}
        wrong = {n: (SKETCHES[n], round(a, 2), {f: round(w, 2) for f, w in fams.items() if abs(a - w) < 1e-3 * w})
                 for n, a in found.items() if abs(a - fams[SKETCHES[n]]) >= 1e-3 * fams[SKETCHES[n]]}
        assert not wrong, (side, "sketch does not hold the expected revI profile", wrong)
        for name, fam in SKETCHES.items():
            write_sketch(doc.getObject(p + name), fam, prof[side])
        keys = v["keys"][side]
        add_keys(doc, p, keys, v["added_per_half"], rep)
        for m in fasteners:
            xy = m["xy"] if side == "left" else [MIRROR_X - m["xy"][0], m["xy"][1]]
            add_fastener(doc, p, int(m["id"][1:]), xy, int(m["from"][1:]), rep)
        cap_sweeps(doc, p, keys, rep)
        report["halves"][side] = rep
    if not a.reuse:
        say("edited", round(time.time() - t0), "s; recomputing")
        doc.recompute()
        bad = [o.Name for o in doc.Objects if "Invalid" in o.State or "Error" in o.State]
        assert not bad, ("recompute errors", bad[:20])
        say("recomputed", round(time.time() - t0), "s")
        doc.saveAs(str(saved))
        (build / "edit-report.json").write_text(json.dumps(report, indent=2) + "\n")
    styles = json.loads((ROOT / "design/cases.json").read_text())["styles"]
    for side, p in (("left", "L_"), ("right", "R_")):
        rep = report["halves"][side]
        keys = v["keys"][side]
        shell = Polygon(prof[side]["outer"])
        # every admitted cap envelope, merged in plan first so the solid check stays a few prisms
        merged = unary_union(cap_polygons(keys)[0])
        merged = list(merged.geoms) if hasattr(merged, "geoms") else [merged]
        sweeps = Part.makeCompound([Part.makeFace([Part.makePolygon([V(x, -y, 7.6) for x, y in ring.coords]) for ring in [poly.exterior, *poly.interiors]],
                                                  "Part::FaceMakerBullseye").extrude(V(0, 0, 12)) for poly in merged])
        rep["cases"] = {}
        for style in styles:
            pair = {g: doc.getObject(f"{p}Case_{style}_{g}").Shape for g in ("base", "plate")}
            entry = {}
            for g, shape in pair.items():
                assert shape.isValid() and len(shape.Solids) == 1, (side, style, g, "invalid case")
                bb = shape.BoundBox
                span = (shell.bounds[2] - shell.bounds[0], shell.bounds[3] - shell.bounds[1])
                slack = .05 if g == "base" else 2.3          # the rim plate is inset 1.1 mm per side
                assert all(-.05 < s - l < slack for s, l in zip(span, (bb.XLength, bb.YLength))), (side, style, g, "case does not span the variant outline", span, bb)
                mesh = MeshPart.meshFromShape(Shape=shape, LinearDeflection=.03, AngularDeflection=.12, Relative=False)
                assert mesh.isSolid(), (side, style, g, "open mesh")
                name = f"{side}-case-{style}-{g}"
                mesh.write(str(out_dir / (name + ".stl"))); shape.exportStep(str(out_dir / (name + ".step")))
                entry[g] = {"volume_mm3": round(shape.Volume, 2), "size_mm": [round(bb.XLength, 2), round(bb.YLength, 2), round(bb.ZLength, 2)],
                            "stl_sha256": sha(out_dir / (name + ".stl"))}
            overlap = pair["base"].common(pair["plate"]).Volume
            assert overlap < .001, (side, style, "base/plate overlap", overlap)
            # every key, the added ones included, has its switch opening through the key plate
            for k in keys:
                assert not pair["plate"].isInside(V(k["x"], -k["y"], 6.95), .001, True), (side, style, k["ref"], "no switch opening")
            if style == "level":
                hit = pair["plate"].common(sweeps).Volume
                assert hit < .001, (side, "Level shell meets a cap envelope", hit)
                entry["cap_envelope_overlap_mm3"] = round(hit, 4)
            entry["base_plate_overlap_mm3"] = round(overlap, 4)
            rep["cases"][style] = entry
            say(side, style, "ok", round(time.time() - t0), "s")
        # the variant PCB for the viewer, from the same object revI exports as <side>-pcb
        pcb = doc.getObject(p + "SlimPCBLeadNotch").Shape
        assert pcb.isValid(), (side, "PCB")
        mesh = MeshPart.meshFromShape(Shape=pcb, LinearDeflection=.03, AngularDeflection=.12, Relative=False)
        mesh.write(str(out_dir / f"{side}-pcb.stl"))
        rep["pcb"] = {"size_mm": [round(pcb.BoundBox.XLength, 2), round(pcb.BoundBox.YLength, 2)], "stl_sha256": sha(out_dir / f"{side}-pcb.stl")}
        for n, f in rep.get("fasteners", {}).items():
            x, y = f["xy_mm"]
            base = doc.getObject(f"{p}Case_solid_base").Shape
            assert base.isInside(V(x + 1.6, -y, 2.5), .001, True) and not base.isInside(V(x, -y, 2.5), .001, True), (side, n, "pillar or pilot missing")
    doc.save() if a.reuse else doc.saveAs(str(saved))
    report["fcstd"] = str(saved.relative_to(ROOT))
    report["seconds"] = round(time.time() - t0)
    (ROOT / f"validation/{vid}-case.json").write_text(json.dumps(report, indent=2) + "\n")
    say("PASS", vid, "case parts exported", report["seconds"], "s")
    os._exit(0)

if __name__ == "__main__":
    try:
        main()
    except BaseException as e:
        import traceback; traceback.print_exc(file=sys.__stderr__); sys.__stderr__.flush(); os._exit(1)
