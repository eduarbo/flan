"""Generate the Flan preset index from an official Bambu Studio Resources/profiles folder."""
# SPDX-License-Identifier: GPL-3.0-or-later
import argparse
import json
from pathlib import Path

# These models use a rectangular, square bed and the existing Flan plate layout.
MODELS = ('A1 mini', 'A1', 'P1P', 'P1S', 'P2S', 'X1', 'X1 Carbon', 'X1E', 'X2D')
MATERIALS = ('Bambu PLA Basic', 'Bambu PLA Matte', 'Generic PLA')


def build(root):
    manifest = json.loads((root / 'BBL.json').read_text())

    def load(kind):
        return {entry['name']: json.loads((root / 'BBL' / entry['sub_path']).read_text())
                for entry in manifest[kind + '_list'] if ' template ' not in entry['name']}

    def inherited(settings, name):
        profile = settings[name]
        parent = profile.get('inherits')
        return {**(inherited(settings, parent) if parent else {}), **profile}

    machines, processes, filaments = (load(k) for k in ('machine', 'process', 'filament'))
    filaments = {name: inherited(filaments, name) for name, profile in filaments.items()
                 if profile.get('instantiation') == 'true' and name.split(' @')[0] in MATERIALS}
    result = {}
    for model in MODELS:
        nozzles = {}
        for diameter in ('0.2', '0.4', '0.6', '0.8'):
            name = f'Bambu Lab {model} {diameter} nozzle'
            machine = inherited(machines, name)
            process = machine['default_print_profile']
            assert name in inherited(processes, process)['compatible_printers'], (name, process)
            materials = {}
            for material in MATERIALS:
                matches = [key for key, p in filaments.items() if key.split(' @')[0] == material
                           and name in p.get('compatible_printers', [])]
                assert len(matches) == 1, (name, material, matches)
                materials[material] = matches[0]
            points = [tuple(map(float, p.strip().split('x'))) for p in machine['printable_area']]
            bed = int(points[2][0])
            assert points == [(0, 0), (bed, 0), (bed, bed), (0, bed)]
            nozzles[diameter] = {'machine': name, 'process': process, 'materials': materials}
        # Keep dual-extruder parts reachable by either extruder, including AMS remapping.
        areas = machine.get('extruder_printable_area', [])
        left = max((min(float(p.split('x')[0]) for p in area.split(',')) for area in areas), default=0)
        result[model] = {'bed': bed, 'height': int(machine['printable_height']),
                         'extruders': len(machine['nozzle_diameter']), 'leftInset': left,
                         'headRadius': float(machine['extruder_clearance_max_radius']),
                         'gantryHeight': float(machine['extruder_clearance_height_to_rod']),
                         'nozzles': nozzles}
    ids = {material: next(p['filament_id'] for name, p in filaments.items() if name.split(' @')[0] == material)
           for material in MATERIALS}
    return {'vendorVersion': manifest['version'], 'filamentIds': ids, 'models': result}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('profiles', type=Path)
    args = parser.parse_args()
    target = Path(__file__).resolve().parents[1] / 'design/bambu-presets.json'
    target.write_text(json.dumps(build(args.profiles), indent=2) + '\n')
