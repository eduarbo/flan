"""Copy a board without 3D models, for bare-PCB renders (run with KiCad's Python)."""
import sys, pcbnew
b = pcbnew.LoadBoard(sys.argv[1])
for fp in b.GetFootprints():
    fp.Models().clear()
pcbnew.SaveBoard(sys.argv[2], b)
