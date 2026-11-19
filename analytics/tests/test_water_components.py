import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from spectral import (
    InsufficientWaterError,
    _require_usable_target_component,
    _select_target_water_component,
)


class WaterComponentTests(unittest.TestCase):
    def test_accepts_a_narrow_connected_river_crossing_the_requested_point(self):
        water_mask = np.zeros((120, 120), dtype=bool)
        water_mask[59:62, 10:110] = True  # Three pixels wide and one hundred long.

        component = _require_usable_target_component(
            _select_target_water_component(water_mask)
        )

        self.assertEqual(component.pixel_count, 300)
        self.assertEqual(component.longest_span_pixels, 100)
        self.assertLess(component.distance_to_target_pixels, 1)

    def test_rejects_a_small_connected_patch_at_the_requested_point(self):
        water_mask = np.zeros((120, 120), dtype=bool)
        water_mask[58:63, 58:63] = True

        with self.assertRaisesRegex(InsufficientWaterError, "25 connected water pixels"):
            _require_usable_target_component(_select_target_water_component(water_mask))

    def test_rejects_a_large_water_feature_too_far_from_the_requested_point(self):
        water_mask = np.zeros((120, 120), dtype=bool)
        water_mask[5:15, 5:35] = True

        with self.assertRaisesRegex(InsufficientWaterError, "nearest connected water feature"):
            _require_usable_target_component(_select_target_water_component(water_mask))


if __name__ == "__main__":
    unittest.main()
