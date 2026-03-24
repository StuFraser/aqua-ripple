# 🌊 AquaRipple

> **Plain-English water quality intelligence powered by satellite imagery and AI.**

AquaRipple analyses real Sentinel-2 satellite data using Google Gemini to deliver water quality assessments at any location — and translates the science into practical, activity-based safety guidance that anyone can act on.

---

## ✨ What It Does

Drop a pin on any water body and AquaRipple will:

- Fetch the clearest available Sentinel-2 satellite image from the past 12 months
- Analyse four spectral views (true colour, false colour, NDWI water mask, NDCI chlorophyll index)
- Return water quality indicators including chlorophyll-a, turbidity, algae bloom detection, water clarity, and cyanobacteria risk
- Translate those indicators into plain-English activity safety ratings for swimming, fishing, boating, irrigation, and animal watering
- Derive an overall water quality score — entirely in code from the indicators, not from AI guesswork

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
│     Proxy · GeoNames search · (MongoDB cache — planned)  │
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
                                     ┌────────▼────────┐
                                     │  Google Gemini  │
                                     │  Vision AI      │
                                     └─────────────────┘
```

### Data Flow — Water Quality Analysis

```
User drops pin
      │
      ▼
GetWet → Is this a water body?
      │
      ├─ No  → Show "not a water body" message
      │
      └─ Yes → Fetch best Sentinel-2 image (lowest cloud cover, last 12 months)
                    │
                    ▼
             Generate 4 spectral views
             (True colour · False colour · NDWI · NDCI)
                    │
                    ▼
             Gemini analyses all 4 images
             Returns raw indicators only
             (chlorophyll_a · turbidity · algae_bloom
              water_clarity · cyanobacteria_risk)
                    │
                    ▼
             Rules engine (activity_rules.yaml)
             Derives activity safety ratings
             (swimming · fishing · boating
              irrigation · animal_watering)
                    │
                    ▼
             Overall quality derived in code
             from indicator levels
                    │
                    ▼
             Results returned to client
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React · Vite · TypeScript · Tailwind CSS · Leaflet |
| API Gateway | C# · .NET 8 |
| Analytics Engine | Python · FastAPI · pystac · Planetary Computer |
| AI Analysis | Google Gemini (vision) |
| Water Detection | GetWet API (Overture Maps data) |
| Place Search | GeoNames API |
| Satellite Imagery | Sentinel-2 L2A via Microsoft Planetary Computer |
| Database | MongoDB (planned — geospatial result caching) |

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
    ├── main.py                 # Analysis & location lookup endpoints
    ├── rules_engine.py         # Config-driven activity safety rules
    ├── models.py               # Pydantic response models
    ├── config.py
    └── rulesets/
        └── activity_rules.yaml # Hot-swappable activity threshold config
```

---

## 🎯 Design Decisions

**Gemini returns indicators only — everything else is derived in code.**
Activity safety ratings, overall quality, and friendly messages are all produced by the rules engine from the raw indicators. This keeps the AI focused on what it's good at (reading imagery) and puts the logic where it belongs — in testable, auditable code.

**Activity rules are config-driven and hot-swappable.**
`activity_rules.yaml` defines thresholds and messages for every activity. Rules can be tuned or new activities added without a code change or service restart.

**Worst indicator wins.**
When multiple indicators give conflicting signals, the most cautious result always takes precedence. AquaRipple always errs on the side of safety.

**No drinking water ratings.**
Surface water should never be flagged safe to drink by an automated system. Cyanotoxins aren't removed by boiling, and the liability and public safety implications of getting it wrong are too high.

**The C# layer is intentionally thin.**
Until MongoDB caching is implemented, the API gateway is a proxy — keeping service URLs and keys off the client, and providing a single entry point that the frontend never needs to know changed when caching lands.

---

## 🔮 Planned

- **MongoDB geospatial caching** — store analysis results indexed by coordinate, expire after 6 months to cover seasonal variation, serve cache hits within configurable radius without hitting the satellite pipeline
- **Historical comparison** — surface how a water body's quality has changed over recent satellite passes

---

## 🛰️ Data & Attributions

| Source | Usage |
|---|---|
| [European Space Agency (ESA)](https://www.esa.int/) | Sentinel-2 multispectral imagery |
| [Microsoft Planetary Computer](https://planetarycomputer.microsoft.com/) | Imagery hosting and STAC API |
| [Google Gemini](https://deepmind.google/technologies/gemini/) | AI vision analysis |
| [GetWet](https://getwet-eha7a2fufhhyenae.australiaeast-01.azurewebsites.net/docs) | Water body point detection via Overture Maps |
| [GeoNames](https://www.geonames.org/) | Place and water body search |

Sentinel-2 data is provided under the [Copernicus Sentinel Data Legal Notice](https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice).

---

*AquaRipple — built as a portfolio project. Water quality indicators are AI-generated from satellite imagery and are not verified by environmental professionals. Always check official advisories before making decisions about water use.*