"""Regression checks for stroke spacing at floating-point and curved boundaries."""
import unittest
from shapely import affinity
from shapely.geometry import box
from silkscreen.patterns import spaced


class SpacingTest(unittest.TestCase):
    def test_already_clear_strokes_are_preserved(self):
        large, small = box(0, 0, 2, 1), box(2.26, 0, 3.26, 1)
        # Binary rounding reports 0.2599999999999998 for the specified 0.26 mm.
        self.assertAlmostEqual(large.distance(small), 0.26)
        result = spaced([large, small])
        self.assertAlmostEqual(result.symmetric_difference(large.union(small)).area, 0)

    def test_trimmed_corners_clear_the_target(self):
        large = box(0, 0, 2, 2)
        small = affinity.rotate(box(2.08, 1.25, 3.08, 2.25), 23, origin=(2.08, 1.25))
        result = spaced([large, small])
        self.assertGreater(len(result.geoms), 1)
        self.assertAlmostEqual(large.difference(result).area, 0)
        for i, a in enumerate(result.geoms):
            for b in list(result.geoms)[i + 1:]:
                self.assertGreaterEqual(a.distance(b), 0.26 - 1e-6)


if __name__ == "__main__":
    unittest.main()
