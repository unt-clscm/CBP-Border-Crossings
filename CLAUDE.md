# CBP Border Crossings — CLAUDE.md

## What this project is

CBP northbound crossing counts (vehicles, pedestrians, containers) at Texas–Mexico ports of entry, 2008–2025. Companion to `../BTS-TransBorder`. Scope: Texas–Mexico only, northbound only, no downloads (raw data is frozen).

## Stack

**Data pipeline:** Python 3, pandas, openpyxl, pdfplumber. No database — in-memory pandas only.

**WebApp:** Vite 7 + React 19 (JSX, no TypeScript), React Router DOM 7 (HashRouter), Zustand 5, Tailwind CSS 4, D3 7 (custom SVG chart primitives), Leaflet 1.9 + React-Leaflet 5, Lucide React. Scripts: `dev`, `build`, `preview`, `test`, `check:all`.

## Directory layout

```
CBP-Border-Corssings/
├── 00-Project-Management/       Phase plans, data requests
│   └── Main-Plans/              Phase-1_Data-Processing.md, Phase-2_WebApp.md, project_instructions.md
├── 01-Raw-Data/                 Frozen inputs — do NOT modify
│   ├── NB-Crossings-2013-2024.xlsx
│   ├── LRD-RVG-2025.xlsx
│   ├── ELP-2025/*.pdf           (3 PDF traffic summaries)
│   └── TX-MX-Border-Crossings-Coordinates.csv   ← authoritative crossing name list
├── 02-Data-Staging/
│   ├── Scripts/                 Numbered pipeline: 00–05
│   ├── config/                  vocab.json, crossing_crosswalk.json
│   ├── cleaned/                 Intermediate CSVs
│   └── docs/                    Validation notes (elp_pdf_notes.md, etc.)
├── 03-Processed-Data/
│   ├── csv/                     monthly_crossings_2008_2025.csv, yearly_crossings_2008_2025.csv
│   └── json/                    Same files as JSON
└── WebApp/                      Vite + React dashboard (Phase 2)
```

## Data pipeline

Run in order from `02-Data-Staging/Scripts/`:

```bash
python 00_load_master.py        # CBP Master workbook → 2008-2012 extension
python 01_load_baseline.py      # NB-Crossings-2013-2024.xlsx
python 02_ingest_lrd_rvg_2025.py
python 03_ingest_elp_2025.py
python 04_merge_and_validate.py # produces final outputs in 03-Processed-Data/
python 05_test_processed_data.py
```

Dependencies: `pip install -r 02-Data-Staging/Scripts/requirements.txt`

## Outputs (Phase 1 — complete)

| File | Rows | Grain |
|------|------|-------|
| `03-Processed-Data/csv/monthly_crossings_2008_2025.csv` | 34,090 | Year × Month × Crossing × Mode |
| `03-Processed-Data/csv/yearly_crossings_2008_2025.csv` | 2,850 | Year × Crossing × Mode |

28/28 invariant checks passing.

## Canonical crossing names

Authoritative source: `01-Raw-Data/TX-MX-Border-Crossings-Coordinates.csv` (34 rows). Six legacy spellings from the 2013–2024 baseline are renamed in `01_load_baseline.py > CROSSING_RENAME_MAP`. The `crossing_crosswalk.json` maps 2025 raw labels to canonical names.

**El Paso Railroad Bridges rule:** CBP reports BNSF + Union Pacific rail crossings as one combined row. Keep it single-row in processed data; split to two map pins only in the WebApp map layer.

## Mode vocabulary

Five canonical modes: `Commercial Trucks`, `Buses`, `Pedestrians/ Bicyclists`, `Passenger Vehicles`, `Railcars`. Source workbooks report `Rail Containers Full` + `Rail Containers Empty` separately — these are **summed** to `Railcars`. The `Trains` (locomotive count) column is dropped.

## Key config files

- `02-Data-Staging/config/vocab.json` — POE list, region list, mode abbreviations
- `02-Data-Staging/config/crossing_crosswalk.json` — raw 2025 label → canonical name map; also documents railcar sum definition under `lrd_rvg._railcars_definition`
- `02-Data-Staging/Scripts/crossing_crosswalk.json` — (symlink/copy used by scripts directly)

## Phase status

| Phase | Status |
|-------|--------|
| Phase 1 — Data Processing | **Complete** |
| Phase 2 — WebApp | Planned — see `00-Project-Management/Main-Plans/Phase-2_WebApp.md` |

## WebApp notes (Phase 2)

Clone the BTS-TransBorder WebApp scaffold at `../BTS-TransBorder/WebApp/`. The CBP app is narrower: one dataset, no commodity/HS-code dimension. Most work is deletion of BTS-specific pages/charts, not new construction. Data contract: two JSON files in `WebApp/public/data/` — `nb_crossings_2013_2025.json` and `crossings_coordinates.json`.

## Known data issues

- May/June 2025 duplicate totals from CBP El Paso field office — pending confirmation with field office. See `02-Data-Staging/docs/elp_pdf_notes.md`.
