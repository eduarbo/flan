"""Copy a board without its installed "silkscreen-art" group (run with KiCad's Python).

Usage: kicad_strip_art.py BOARD OUT [GROUP...]. Removes the named groups (default
"silkscreen-art") and every item in them; everything else is saved exactly as loaded.
"""
import sys
import pcbnew

b = pcbnew.LoadBoard(sys.argv[1])
names = set(sys.argv[3:]) or {"silkscreen-art"}
groups = [g for g in b.Groups() if g.GetName() in names]
removed = 0
for g in groups:
    for item in list(g.GetItems()):
        g.RemoveItem(item)
        b.Remove(item)
        removed += 1
    b.Remove(g)
pcbnew.SaveBoard(sys.argv[2], b)
print("removed", len(groups), "group(s),", removed, "items")
