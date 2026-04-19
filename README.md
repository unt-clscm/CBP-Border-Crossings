# CBP Border Crossings — Texas-Mexico Northbound Crossings

Companion to [`../BTS-TransBorder`](../BTS-TransBorder). Tracks **U.S. Customs and Border Protection** northbound crossing counts (vehicles, pedestrians, containers) at Texas–Mexico ports of entry, 2008 to 2025.

Unlike BTS (freight trade value), CBP data is a count of physical crossings.

## Quick start

```bash
# Data pipeline (pandas only — no DB)
cd 02-Data-Staging/Scripts
pip install -r requirements.txt
python 01_load_baseline.py
python 02_ingest_lrd_rvg_2025.py
python 03_ingest_elp_2025.py
python 00_load_master.py
python 04_merge_and_validate.py
python 05_test_processed_data.py
python 06_emit_coords_json.py

# Dashboard
cd ../../WebApp
npm install
npm run dev
```

## Directory structure

```
CBP-Border-Corssings/
├── 00-Project-Management/       Phase plans, data requests
├── 01-Raw-Data/                 Frozen inputs (NB-Crossings-2013-2024.xlsx,
│                                LRD-RVG-2025.xlsx, ELP-2025/*.pdf)
├── 02-Data-Staging/             Scripts, cleaned intermediates, config
├── 03-Processed-Data/           Final CSV + JSON (monthly/yearly 2008–2025 + crossings_coordinates)
└── WebApp/                      Vite + React dashboard
```

## Data sources

- **2013–2024:** pre-aggregated CBP northbound crossings (`NB-Crossings-2013-2024.xlsx`)
- **2025 — Laredo + Rio Grande Valley field offices:** `LRD-RVG-2025.xlsx` (monthly by bridge)
- **2025 — El Paso field office:** 3 PDF traffic summary reports in `01-Raw-Data/ELP-2025/`

## Status

| Phase | Status |
|-------|--------|
| Phase 1 — Data Processing | **Complete** — 34,090 monthly + 2,850 yearly rows; 35/36 invariant checks passing |
| Phase 2 — WebApp | In progress |

See [`00-Project-Management/Main-Plans/`](00-Project-Management/Main-Plans/) for plan documents.
