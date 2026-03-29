import yaml
from pathlib import Path
from typing import Any

RULES_PATH = Path(__file__).parent / "rulesets/activity_rules.yaml"

STATUS_PRIORITY = {"safe": 0, "caution": 1, "unsafe": 2}


def load_rules() -> dict:
    with open(RULES_PATH, "r") as f:
        return yaml.safe_load(f)


def resolve_indicator_status(indicator_name: str, indicator_data: dict, rules: dict) -> str | None:
    """Resolve a single indicator against its rules, returning safe|caution|unsafe or None if not applicable."""

    if indicator_name == "algae_bloom":
        severity = indicator_data.get("severity", "none")
        return rules.get("severity", {}).get(severity)

    level = indicator_data.get("level")
    if level is None:
        return None

    return rules.get(level)


def resolve_biosecurity(indicators: dict, biosecurity_rules: dict) -> bool:
    """Resolve biosecurity advisory — any triggering indicator sets advisory to true."""
    advisory = False

    for indicator_name, indicator_rules in biosecurity_rules.items():
        indicator_data = indicators.get(indicator_name, {})

        if indicator_name == "algae_bloom":
            severity = indicator_data.get("severity", "none")
            result = indicator_rules.get("severity", {}).get(severity, False)
        else:
            level = indicator_data.get("level")
            result = indicator_rules.get(level, False) if level else False

        if result:
            advisory = True
            break

    return advisory


def resolve_activity_status(indicators: dict, activity_indicator_rules: dict) -> str:
    """Resolve overall activity status using worst indicator wins strategy."""
    worst = "safe"

    for indicator_name, indicator_rules in activity_indicator_rules.items():
        indicator_data = indicators.get(indicator_name, {})
        status = resolve_indicator_status(indicator_name, indicator_data, indicator_rules)

        if status and STATUS_PRIORITY.get(status, 0) > STATUS_PRIORITY.get(worst, 0):
            worst = status

    return worst


def build_simple_activity(indicators: dict, activity_rules: dict) -> dict:
    """Build a simple safe|caution|unsafe activity result with message."""
    status = resolve_activity_status(indicators, activity_rules["indicators"])
    message = activity_rules["messages"][status]
    return {"status": status, "reason": message}


def build_activity_safety(indicators: dict) -> dict:
    """Build the full activity_safety block from indicators and rules."""
    rules = load_rules()
    activities = rules["activities"]
    result = {}

    # Swimming
    result["swimming"] = build_simple_activity(indicators, activities["swimming"])

    # Fishing — two sub-activities
    result["fishing"] = {
        "activity": build_simple_activity(indicators, activities["fishing"]["activity"]),
        "consumption": build_simple_activity(indicators, activities["fishing"]["consumption"]),
    }

    # Boating — safety + biosecurity
    boating_status = resolve_activity_status(indicators, activities["boating"]["safety"]["indicators"])
    boating_message = activities["boating"]["safety"]["messages"][boating_status]

    biosecurity = resolve_biosecurity(indicators, activities["boating"]["biosecurity"]["indicators"])
    biosecurity_message = activities["boating"]["biosecurity"]["messages"][biosecurity]

    result["boating"] = {
        "safety": {"status": boating_status, "reason": boating_message},
        "biosecurity_advisory": biosecurity,
        "biosecurity_reason": biosecurity_message,
    }

    # Irrigation
    result["irrigation"] = build_simple_activity(indicators, activities["irrigation"])

    # Animal watering
    result["animal_watering"] = build_simple_activity(indicators, activities["animal_watering"])

    return result


def derive_overall_quality(indicators: dict) -> str:
    """Derive overall quality label from indicators rather than relying on Gemini.

    Uses a weighted average across all indicators, with cyanobacteria and algae bloom
    carrying extra weight as the health-critical indicators. A worst-case floor then
    prevents a single clean indicator from masking a serious concern.
    """
    level_score    = {"low": 100, "moderate": 60, "high": 30, "very_high": 5}
    clarity_score  = {"clear": 100, "moderate": 60, "turbid": 30, "opaque": 5}
    severity_score = {"none": 100, "minor": 60, "moderate": 30, "severe": 5}

    # (score, weight) pairs — health-critical indicators weighted 2x
    weighted = []

    if chl := indicators.get("chlorophyll_a"):
        weighted.append((level_score.get(chl.get("level"), 50), 1.0))

    if turb := indicators.get("turbidity"):
        weighted.append((level_score.get(turb.get("level"), 50), 1.0))

    if bloom := indicators.get("algae_bloom"):
        weighted.append((severity_score.get(bloom.get("severity"), 50), 2.0))

    if clarity := indicators.get("water_clarity"):
        weighted.append((clarity_score.get(clarity.get("level"), 50), 1.0))

    if cyano := indicators.get("cyanobacteria_risk"):
        weighted.append((level_score.get(cyano.get("level"), 50), 2.0))

    if not weighted:
        return "unknown"

    total_score  = sum(s * w for s, w in weighted)
    total_weight = sum(w for _, w in weighted)
    average = total_score / total_weight

    # Worst-case floor: the single lowest score caps the ceiling
    # so a serious indicator cannot be washed out by clean ones
    worst = min(s for s, _ in weighted)
    if worst >= 100:
        ceiling = "excellent"
    elif worst >= 60:
        ceiling = "good"
    elif worst >= 30:
        ceiling = "fair"
    else:
        ceiling = "poor"

    quality_order = ["excellent", "good", "fair", "poor", "very_poor"]

    if average >= 90:
        derived = "excellent"
    elif average >= 72:
        derived = "good"
    elif average >= 50:
        derived = "fair"
    elif average >= 25:
        derived = "poor"
    else:
        derived = "very_poor"

    # Return whichever is worse: derived average or worst-case ceiling
    return derived if quality_order.index(derived) >= quality_order.index(ceiling) else ceiling