# 🌊 AquaRipple

> **Plain-English water quality intelligence powered by satellite imagery and AI.**

AquaRipple analyses real Sentinel-2 satellite data to deliver water quality assessments at any location — and translates the science into practical, activity-based safety guidance that anyone can act on.

---

## ✨ What It Does

Drop a pin on any water body and AquaRipple will:

- Fetch the most recent Sentinel-2 scene (within a rolling 30-day window) that clears a cloud-cover threshold
- Download raw spectral bands and compute water quality indices directly from pixel data (NDWI, MNDWI, NDCI, FAI, turbidity index, and more)
- Interpret those indices via either a **deterministic rules engine** (default — instant, free, no external calls) or **AI-assisted analysis** (opt-in, via Groq/Llama) to produce water quality indicators: chlorophyll-a, turbidity, algae bloom detection, water clarity, and cyanobacteria risk
- Translate those indicators into plain-English activity safety ratings for swimming, fishing, boating, irrigation, and animal watering
- Derive an overall water quality score — entirely in code from the indicators, not from AI guesswork
- Surface historical comparisons — show how a water body's quality has shifted across recent satellite passes, tracked separately per analysis mode

---

## 🏗️ Architecture

AquaRipple is a polyglot microservices system. Each layer has a single, well-defined responsibility.

```
┌─────────────────────────────────────────────────────────┐
│                     React Frontend                       │
│         Leaflet map · Location search · Results UI       │
└─────────────────────────┬───────────────────────────────┘
                          │ HTTP
┌─────────────────────────▼───────────────────────────────┐
│                   .NET 8 API Gateway                     │
│    Orchestration · GeoNames search · MongoDB cache       │
└──────┬──────────────────┬──────────────────┬────────────┘
       │ HTTP             │ HTTP             │ HTTP
┌──────▼──────┐  ┌────────▼────────┐  ┌─────▼──────────┐
│   GetWet    │  │  GeoNames API   │  │ Python/FastAPI  │
│  (Overture  │  │  (Place search  │  │ Analytics       │
│   water     │  │   & autocomplete│  │ Engine          │
│  detection) │  │   )             │  │                 │
└─────────────┘  └─────────────────┘  └──────┬─────────┘
                                              │
                              ┌───────────────▼──────────────┐
                              │   Microsoft Planetary Computer│
                              │   Sentinel-2 Imagery (ESA)   │
                              └───────────────┬──────────────┘
                                              │
                                   Analysis mode (client toggle)
                                     ┌────────┴────────┐
                                     ▼                 ▼
                          ┌───────────────────┐  ┌──────────────────┐
                          │   Rules Engine     │  │   Groq / Llama   │
                          │  (deterministic,   │  │  (AI-assisted,   │
                          │   default)          │  │   opt-in)        │
                          └───────────────────┘  └────────┬─────────┘
                                                            │ Groq rate-limited (429)
                                                            ▼
                                                   falls back to Rules Engine
```

### Data Flow — Water Quality Analysis

```
User drops pin
      │
      ▼
C# Gateway → MongoDB cache hit within radius?
      │
      ├─ Yes → Return cached result + historical comparison
      │
      └─ No  → GetWet → Is this a water body?
                    │
                    ├─ No  → Show "not a water body" message
                    │
                    └─ Yes → Fetch most recent Sentinel-2 scene clearing the cloud-cover
                             threshold (search window: last 30 days)
                                  │
                                  ▼
                           Download raw spectral band windows (B03·B04·B05·B08·B11)
                           Compute indices over water pixels only
                           (NDWI · MNDWI · NDVI · NDCI · FAI · turbidity index · NTR)
                                  │
                                  ▼
                    Analysis mode — client-selected, defaults to rule-based
                          │                                    │
                          ▼                                    ▼
                 Rule-based (default)                 AI-assisted (opt-in)
                 Deterministic thresholds              Groq (Llama 3.3 70B)
                 on the computed indices —              interprets computed indices —
                 instant, no external calls             falls back to rule-based on
                                                          a Groq rate limit (429)
                          │                                    │
                          └─────────────────┬──────────────────┘
                                             ▼
                           Both paths return the same indicators shape
                           (chlorophyll_a · turbidity · algae_bloom
                            water_clarity · cyanobacteria_risk)
                                  │
                                  ▼
                           Activity-safety rules engine (activity_rules.yaml)
                           Derives activity safety ratings
                           (swimming · fishing · boating
                            irrigation · animal_watering)
                                  │
                                  ▼
                           Overall quality derived in code
                           from indicator levels
                                  │
                                  ▼
                           Result stored in MongoDB, tagged with the mode that
                           actually produced it (geospatial index · 6-month TTL)
                                  │
                                  ▼
                           Results returned to client — mode shown as a badge,
                           history spans both modes rather than being filtered by
                           whichever is currently selected
```

---

## 🛠️ Tech Stack

| Layer             | Technology                                                        |
| ----------------- | ----------------------------------------------------------------- |
| Frontend          | React · Vite · TypeScript · Tailwind CSS · Leaflet — responsive across desktop and mobile |
| API Gateway       | C# · .NET 8                                                       |
| Analytics Engine  | Python · FastAPI · Rasterio · NumPy                               |
| Spectral Indices  | Computed from raw Sentinel-2 band data                            |
| Indicator Analysis| Deterministic rules engine (default) or Groq — Llama 3.3 70B (opt-in, AI-assisted) |
| Water Detection   | GetWet API (Overture Maps data)                                   |
| Place Search      | GeoNames API                                                      |
| Satellite Imagery | Sentinel-2 L2A via Microsoft Planetary Computer                   |
| Database          | MongoDB Atlas (Azure) — geospatial result caching & history       |

---

## 📂 Project Structure

```
aqua-ripple/
├── client/
│   └── aquaripple-ui/          # React frontend
├── server/                     # .NET 8 API gateway
│   ├── Controllers/
│   ├── Services/
│   └── Models/
└── analytics/                  # Python FastAPI analytics engine
    ├── main.py                 # Analysis endpoint — selects mode, orchestrates the pipeline
    ├── spectral.py             # Sentinel-2 band download & index computation
    ├── rule_quality_analysis.py # Deterministic indicator derivation (rule-based analysis mode)
    ├── rules_engine.py         # Activity safety rules — shared by both analysis modes
    ├── models.py               # Pydantic response models
    ├── config.py
    └── rulesets/
        └── activity_rules.yaml # Hot-swappable activity threshold config
```

---

## 🎯 Design Decisions

**Spectral indices computed from raw band data — not rendered images.** Rather than passing visualisation tiles to an AI model, AquaRipple downloads the raw Sentinel-2 spectral bands and computes scientifically-grounded indices (NDWI, MNDWI, NDCI, FAI, turbidity index) directly from pixel reflectance values. This gives both analysis paths below real measurements to work from, instead of asking a model to guess from a JPEG.

**Two independent analysis paths behind one interface — AI as an enhancement, not a dependency.** Every request can be served by a fully deterministic rules engine (threshold-based interpretation of the spectral indices) or by AI-assisted interpretation via Groq, chosen by a manual client-side toggle that defaults to rule-based. Both paths return the same indicator shape and feed the same downstream activity-safety engine, so nothing else in the pipeline needs to know or care which one ran. This keeps the app fully usable — and free — with zero AI calls, while still giving genuine LLM integration a deliberate place to shine rather than making it a hard dependency for every request.

**AI failures degrade gracefully, not loudly.** If AI mode is selected but Groq's rate limit is hit, the analytics service automatically falls back to the rules engine for that request instead of failing it outright — the response is explicitly flagged as a fallback so the UI never mislabels where a result actually came from.

**The LLM interprets numbers, not pictures.** When AI mode is used, Groq receives a dict of computed float values with reference ranges and returns calibrated indicator levels. Its job is cross-index reasoning and uncertainty estimation — not image analysis. This eliminates the optimism bias that comes from vision models pattern-matching against training data.

**Indicators are the only thing either analysis path produces — everything else is derived in code.** Activity safety ratings, overall quality, and friendly messages are all produced by the same rules engine from the raw indicators, regardless of whether those indicators came from Groq or the deterministic engine. This keeps AI (when used) focused on what it's good at and puts the rest of the logic where it belongs — in testable, auditable code.

**Activity rules are config-driven and hot-swappable.** `activity_rules.yaml` defines thresholds and messages for every activity. Rules can be tuned or new activities added without a code change or service restart.

**Worst indicator wins.** When multiple indicators give conflicting signals, the most cautious result always takes precedence. AquaRipple always errs on the side of safety.

**No drinking water ratings.** Surface water should never be flagged safe to drink by an automated system. Cyanotoxins aren't removed by boiling, and the liability and public safety implications of getting it wrong are too high.

**Most-recent-passing-threshold, not clearest-ever.** Satellite scene selection asks the STAC API to sort by capture date and take the first result that clears the cloud-cover filter, within a rolling 30-day window — not the single clearest scene across the whole archive. Optimising for "clearest image" over a long lookback window can silently surface multi-month-old imagery even when much fresher, still-acceptable scenes exist.

**The C# layer owns orchestration and caching.** The API gateway coordinates calls across GetWet, the analytics engine, and MongoDB — serving cache hits for previously analysed locations, storing new results with a geospatial index and the analysis mode that produced them, and keeping all service URLs and keys off the client. Cache entries expire after 6 months to account for seasonal variation.

**Geospatial caching with configurable radius matching.** MongoDB results are indexed by coordinate. Cache hits are served for any query within a configurable radius of a previously analysed point, avoiding redundant satellite pipeline calls for nearby locations — the currently-selected analysis mode doesn't need to match the cached result's mode for a hit, since a recent result is still a recent result regardless of which engine produced it.

**Historical comparison spans both analysis modes.** Because MongoDB retains prior analyses within the TTL window, the gateway can surface how a water body's indicators have shifted across passes — without any additional satellite or LLM calls. History isn't filtered by whichever mode is currently selected; each entry carries its own source so AI-assisted and rule-based results sit side by side rather than one hiding the other.

---

## 🛰️ Data & Attributions

| Source                                                                            | Usage                                        |
| --------------------------------------------------------------------------------- | -------------------------------------------- |
| [European Space Agency (ESA)](https://www.esa.int/)                               | Sentinel-2 multispectral imagery             |
| [Microsoft Planetary Computer](https://planetarycomputer.microsoft.com/)          | Imagery hosting and STAC API                 |
| [Groq](https://groq.com/)                                                         | LLM inference (Llama 3.3 70B)                |
| [Meta](https://ai.meta.com/llama/)                                                | Llama 3.3 70B model                          |
| [GetWet](https://getwet-eha7a2fufhhyenae.australiaeast-01.azurewebsites.net/docs) | Water body point detection via Overture Maps |
| [GeoNames](https://www.geonames.org/)                                             | Place and water body search                  |
| [MongoDB Atlas](https://www.mongodb.com/atlas)                                    | Geospatial result caching & historical data  |

Sentinel-2 data is provided under the [Copernicus Sentinel Data Legal Notice](https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice).

---

*AquaRipple — built as a portfolio project. Water quality indicators are derived from satellite imagery via a deterministic rules engine or, optionally, AI interpretation — and are not verified by environmental professionals. Always check official advisories before making decisions about water use.*