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
    """Derive overall quality label from indicators rather than relying on Gemini."""
    scores = []

    level_score = {"low": 100, "moderate": 70, "high": 40, "very_high": 10}
    clarity_score = {"clear": 100, "moderate": 70, "turbid": 40, "opaque": 10}
    severity_score = {"none": 100, "minor": 70, "moderate": 40, "severe": 10}

    if chl := indicators.get("chlorophyll_a"):
        scores.append(level_score.get(chl.get("level"), 50))

    if turb := indicators.get("turbidity"):
        scores.append(level_score.get(turb.get("level"), 50))

    if bloom := indicators.get("algae_bloom"):
        scores.append(severity_score.get(bloom.get("severity"), 50))

    if clarity := indicators.get("water_clarity"):
        scores.append(clarity_score.get(clarity.get("level"), 50))

    if cyano := indicators.get("cyanobacteria_risk"):
        scores.append(level_score.get(cyano.get("level"), 50))

    if not scores:
        return "unknown"

    average = sum(scores) / len(scores)

    if average >= 90:
        return "excellent"
    elif average >= 70:
        return "good"
    elif average >= 50:
        return "fair"
    elif average >= 30:
        return "poor"
    else:
        return "critical"