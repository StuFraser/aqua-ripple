import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from rule_quality_analysis import derive_indicators
from rules_engine import build_activity_safety


def indices(**overrides):
    values = {
        "ndci": None,
        "fai": None,
        "turbidity_index": None,
        "water_pixel_fraction": None,
        "valid_pixel_fraction": None,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


class DeterministicRulesTests(unittest.TestCase):
    def test_background_signal_does_not_create_cyanobacteria_warning(self):
        indicators = derive_indicators(
            indices(
                ndci=0.05,
                fai=-0.03,
                turbidity_index=0.5,
                water_pixel_fraction=0.8,
                valid_pixel_fraction=0.9,
            )
        )

        self.assertEqual(indicators["chlorophyll_a"]["level"], "low")
        self.assertEqual(indicators["cyanobacteria_risk"]["level"], "low")
        self.assertEqual(build_activity_safety(indicators)["swimming"]["status"], "safe")

    def test_high_turbidity_is_a_swimming_caution_not_automatic_unsafe(self):
        indicators = derive_indicators(
            indices(
                ndci=-0.05,
                fai=-0.03,
                turbidity_index=0.9,
                water_pixel_fraction=0.8,
                valid_pixel_fraction=0.9,
            )
        )

        self.assertEqual(build_activity_safety(indicators)["swimming"]["status"], "caution")

    def test_strong_cyanobacteria_evidence_remains_unsafe(self):
        indicators = derive_indicators(
            indices(
                ndci=0.45,
                fai=0.06,
                turbidity_index=0.5,
                water_pixel_fraction=0.8,
                valid_pixel_fraction=0.9,
            )
        )

        activity_safety = build_activity_safety(indicators)
        self.assertEqual(indicators["cyanobacteria_risk"]["level"], "very_high")
        self.assertEqual(activity_safety["swimming"]["status"], "unsafe")
        self.assertEqual(activity_safety["animal_watering"]["status"], "unsafe")


if __name__ == "__main__":
    unittest.main()
