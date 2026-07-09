"""
rule_quality_analysis.py — deterministic water-quality indicator derivation.

Runs as a full alternative to the Groq LLM interpretation path (main.py's
llm_interpret_indices), not a supplement to it — no network calls, no external
dependency, same output shape so it can feed the existing activity-safety
rules engine (rules_engine.py) unchanged.

Thresholds mirror the reference ranges already established for the LLM prompt
in main.py (_ANALYSIS_USER_TEMPLATE) so the two modes stay comparable. They are
literature-derived starting points, not calibrated against ground truth — no
labelled water-quality data exists for this project to calibrate against.
"""

from typing import Optional

from spectral import SpectralIndices

# ── Thresholds (mirror main.py's _ANALYSIS_USER_TEMPLATE reference ranges) ────

NDCI_LOW_MAX = 0.0
NDCI_MODERATE_MAX = 0.2
NDCI_HIGH_MAX = 0.4

TURBIDITY_LOW_MAX = 0.6
TURBIDITY_MODERATE_MAX = 0.8
TURBIDITY_HIGH_MAX = 1.0

FAI_NONE_MAX = -0.02
FAI_MINOR_MAX = 0.0
FAI_MODERATE_MAX = 0.05

# Secchi depth heuristic anchor: turbidity_index at the low/moderate boundary
# maps to a plausible mid-range depth. Uncalibrated — see module docstring.
SECCHI_REFERENCE_TURBIDITY = TURBIDITY_LOW_MAX
SECCHI_REFERENCE_DEPTH_M = 2.5
SECCHI_MIN_M = 0.1
SECCHI_MAX_M = 6.0

_LEVEL_ORDER = ["low", "moderate", "high", "very_high"]
_SEVERITY_ORDER = ["none", "minor", "moderate", "severe"]


class IndicesUnavailableError(Exception):
    """A spectral index required for rule-based derivation was not computed."""


def _require(value: Optional[float], name: str) -> float:
    if value is None:
        raise IndicesUnavailableError(f"Required spectral index '{name}' is unavailable.")
    return value


def _confidence(indices: SpectralIndices) -> float:
    """
    No LLM confidence signal exists for this path, so approximate it from
    scene quality: higher water/valid pixel fractions mean the water-pixel
    mean the indices were averaged over is more trustworthy.
    """
    water_fraction = indices.water_pixel_fraction or 0.0
    valid_fraction = indices.valid_pixel_fraction or 0.0
    return round(min(0.95, max(0.4, (water_fraction + valid_fraction) / 2)), 2)


def _chlorophyll_level(ndci: float) -> str:
    if ndci < NDCI_LOW_MAX:
        return "low"
    if ndci < NDCI_MODERATE_MAX:
        return "moderate"
    if ndci < NDCI_HIGH_MAX:
        return "high"
    return "very_high"


def _turbidity_level(turbidity_index: float) -> str:
    if turbidity_index < TURBIDITY_LOW_MAX:
        return "low"
    if turbidity_index < TURBIDITY_MODERATE_MAX:
        return "moderate"
    if turbidity_index < TURBIDITY_HIGH_MAX:
        return "high"
    return "very_high"


def _algae_severity(fai: float) -> str:
    if fai < FAI_NONE_MAX:
        return "none"
    if fai < FAI_MINOR_MAX:
        return "minor"
    if fai < FAI_MODERATE_MAX:
        return "moderate"
    return "severe"


def _water_clarity(turbidity_index: float) -> tuple[str, float]:
    """Reuses the turbidity thresholds (relabelled) plus a secchi depth estimate."""
    if turbidity_index < TURBIDITY_LOW_MAX:
        level = "clear"
    elif turbidity_index < TURBIDITY_MODERATE_MAX:
        level = "moderate"
    elif turbidity_index < TURBIDITY_HIGH_MAX:
        level = "turbid"
    else:
        level = "opaque"

    secchi = SECCHI_REFERENCE_DEPTH_M * (SECCHI_REFERENCE_TURBIDITY / max(turbidity_index, 0.01))
    secchi = round(min(SECCHI_MAX_M, max(SECCHI_MIN_M, secchi)), 2)

    return level, secchi


def _cyanobacteria_level(chlorophyll_level: str, algae_severity: str) -> str:
    """
    Mirrors the LLM prompt's stated heuristic: both indicators low -> low risk;
    only one elevated -> moderate; both elevated -> scales with the worse of the two.
    """
    chl_ordinal = _LEVEL_ORDER.index(chlorophyll_level)
    algae_ordinal = _SEVERITY_ORDER.index(algae_severity)

    if chl_ordinal == 0 and algae_ordinal == 0:
        return "low"
    if chl_ordinal >= 1 and algae_ordinal >= 1:
        return _LEVEL_ORDER[max(chl_ordinal, algae_ordinal)]
    return "moderate"


def derive_indicators(indices: SpectralIndices) -> dict:
    """
    Derive the full indicators dict directly from spectral indices, with no
    LLM involvement. Output shape matches main.py's llm_interpret_indices so
    both feed the same downstream activity-safety rules engine.

    Raises IndicesUnavailableError if a required index wasn't computed.
    """
    ndci = _require(indices.ndci, "ndci")
    turbidity_index = _require(indices.turbidity_index, "turbidity_index")
    fai = _require(indices.fai, "fai")

    confidence = _confidence(indices)

    chlorophyll_level = _chlorophyll_level(ndci)
    turbidity_level = _turbidity_level(turbidity_index)
    algae_severity = _algae_severity(fai)
    clarity_level, secchi_depth = _water_clarity(turbidity_index)
    cyanobacteria_level = _cyanobacteria_level(chlorophyll_level, algae_severity)

    return {
        "chlorophyll_a": {"level": chlorophyll_level, "confidence": confidence},
        "turbidity": {"level": turbidity_level, "confidence": confidence},
        "algae_bloom": {
            "detected": algae_severity != "none",
            "severity": algae_severity,
            "confidence": confidence,
        },
        "water_clarity": {
            "level": clarity_level,
            "secchi_depth_estimate": secchi_depth,
            "confidence": confidence,
        },
        "cyanobacteria_risk": {"level": cyanobacteria_level, "confidence": confidence},
    }
