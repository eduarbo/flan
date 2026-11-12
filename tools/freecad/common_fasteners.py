"""Editable clearance for ordinary M2 heads; keep all fastening datums.

SPDX-License-Identifier: GPL-3.0-or-later
"""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = ROOT / 'design/common-fasteners.json'


def apply(doc):
    spec = json.loads(SPEC.read_text())
    head, pocket = spec['head_envelope_mm'], spec['short_head_pocket_mm']
    changes = {}
    receipt = doc.getObject('CommonFasteners')
    if receipt is None:
        receipt = doc.addObject('App::DocumentObjectGroup', 'CommonFasteners')
        receipt.addProperty('App::PropertyString', 'RecipeJSON')
    for prefix in ('L_', 'R_'):
        for i in range(1, 6):
            obj = doc.getObject(prefix + 'Head' + str(i))
            if obj is None:
                raise ValueError('Missing native screw head: ' + prefix + str(i))
            obj.Radius = head['diameter'] / 2
            obj.Height = head['height']
        # The plate and shared blank drive every current case/frame variant.
        for stem in ('PlateHeadTool', 'Frame_smooth_HeadTool'):
            for i in (4, 5):
                obj = doc.getObject(prefix + stem + str(i))
                if obj is None or abs(obj.Placement.Base.z - pocket['bottom']) > 1e-7:
                    raise ValueError('Unexpected head pocket datum: ' + prefix + stem + str(i))
                obj.Radius = pocket['radius']
                obj.Height = pocket['top'] - pocket['bottom']
                changes[obj.Name] = {'radius_mm': float(obj.Radius), 'height_mm': float(obj.Height)}
        # Level adds a wall above the original plate. Extend the same pockets
        # through its first 0.1 mm too, keeping the common 0.3 mm head clearance.
        level = doc.getObject(prefix + 'Case_level_plate')
        relief = doc.getObject(prefix + 'CommonLevelHeadRelief')
        if relief is None:
            tools = doc.addObject('Part::MultiFuse', prefix + 'CommonLevelHeadTools')
            tools.Shapes = [doc.getObject(prefix + 'PlateHeadTool' + str(i)) for i in (4, 5)]
            relief = doc.addObject('Part::Cut', prefix + 'CommonLevelHeadRelief')
            relief.Base = level.Links[0]
            relief.Tool = tools
            relief.Refine = True
            history = doc.getObject(prefix + 'Construction')
            history.addObject(tools); history.addObject(relief)
            level.Links = [relief]
            tools.Visibility = False; relief.Visibility = False
    doc.recompute()
    receipt.RecipeJSON = json.dumps({'spec_sha256': hashlib.sha256(SPEC.read_bytes()).hexdigest(),
                                    'spec': spec, 'pockets': changes}, sort_keys=True)
    return json.loads(receipt.RecipeJSON)
