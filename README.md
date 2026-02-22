# 🌊 AquaRipple 

> **Space-age water quality monitoring for everyone.**

AquaRipple is a full-stack platform that bridges the gap between high-altitude satellite data and ground-level community insights. By combining **Sentinel-2 multispectral imagery** with crowdsourced **Ripple Reports**, we provide a transparent, real-time view of waterway health.



---

## ✨ Key Features

* **🛰️ Satellite Analysis:** Automated ingestion of Sentinel-2 data to calculate NDWI (Water Index) and Chlorophyll-a levels.
* **👥 Ripple Reports:** Social layer for community members to tag activities (swimming, fishing) and report visual water conditions.
* **✅ Cross-Verification:** A unique "Ground Truth" engine that cross-references user sightings with the latest satellite passes.
* **📊 Interactive Dashboards:** Visualized history of waterway health over time.

---

## 🛠️ The Tech Stack

AquaRipple is built using a **Polyglot Microservices Architecture**:

* **Frontend:** `React.js` + `Vite` + `Leaflet` (Mapping)
* **API Gateway:** `C# / .NET 8` (User Auth, MongoDB coordination)
* **Analytics Engine:** `Python / FastAPI` (Satellite image processing with NumPy & Rasterio)
* **Database:** `MongoDB` (Geospatial data storage)
* **Identity:** `OAuth 2.0` (Google/Facebook Social Login)

---

## 📂 Project Structure

```text
aqua-ripple/
├── client/       # React Frontend (The Dashboard)
├── server/       # .NET 8 Web API (The Brain)
├── analytics/    # Python FastAPI (The Satellite Engine)
└── docs/         # Architectural diagrams and research
```

## 🛰️ Data & Attributions

This project utilizes satellite imagery and environmental data provided by:

* **European Space Agency (ESA):** Contains modified Copernicus Sentinel data (2026).
* **Microsoft Planetary Computer:** Data hosting and API access via the [Planetary Computer](https://planetarycomputer.microsoft.com/).
* **Analysis:** Automated visual and spectral analysis powered by **Google Gemini**.

### Licensing
Sentinel-2 data is provided under the [Legal notice on the use of Copernicus Sentinel Data and Service Information](https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice).
