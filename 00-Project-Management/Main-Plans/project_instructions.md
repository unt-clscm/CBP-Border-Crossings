# CBP Border Crossings — Project Instructions

## What this project is

A companion dataset + dashboard to `BTS-TransBorder`, covering **CBP (U.S. Customs and Border Protection) northbound crossing counts** at Texas–Mexico ports of entry. Unlike BTS (freight dollars/kg), CBP counts **vehicles, pedestrians, and containers** crossing into the U.S.

Scope is intentionally narrower than BTS:
- **Texas–Mexico ports only** (no Canada, no non-Texas).
- **Northbound only** (matches the source spreadsheet).
- **No downloads** — all raw inputs are already staged under `01-Raw-Data/`.

## Raw inputs (frozen)

| File | Coverage | Format |
|------|----------|--------|
| `01-Raw-Data/NB-Crossings-2013-2024.xlsx` | 2013–2024, all TX ports, annual by mode | Long table, 7 cols: ID, Year, Region, POE, Crossing, Modes, Northbound Crossing |
| `01-Raw-Data/LRD-RVG-2025.xlsx` | CY 2025, Laredo + Rio Grande Valley (RVG) field offices, monthly by bridge × mode | Wide table, month columns |
| `01-Raw-Data/ELP-2025/*.pdf` | CY 2025, El Paso field office, monthly traffic summary | PDF tables (3 reports covering Sept, Nov, Dec 2025 + Jan 2026) |

## Target output

A single enriched long-format table equivalent in shape to `NB-Crossings-2013-2024.xlsx` but extended through **2025** (and potentially partial 2026 from the Dec 25–Jan 26 PDF).

Columns: `ID, Year, Region, POE, Crossing, Modes, Northbound Crossing`.

## Folder layout (mirrors BTS-TransBorder)

```
CBP-Border-Corssings/
├── 00-Project-Management/
│   ├── Main-Plans/              Phase plans + these instructions
│   ├── Data-Requests/           Any follow-up asks to CBP/field offices
│   └── GitHub-Research-.../     Reference dashboards
├── 01-Raw-Data/                 Frozen inputs (do not modify)
├── 02-Data-Staging/
│   ├── Scripts/                 Numbered pipeline scripts
│   ├── config/                  POE/Region/Mode lookup tables
│   ├── cleaned/                 Intermediate CSVs
│   └── docs/                    Validation reports
├── 03-Processed-Data/
│   ├── csv/                     Final analysis-ready CSVs
│   └── json/                    Dashboard-ready JSON
└── WebApp/                      Vite + React dashboard
```

## Differences from BTS-TransBorder

- **No Phase 1 (Data Acquisition).** Raw data is already present; nothing to download.
- **No SQLite step.** Dataset is small (~2k rows through 2024, ~2.2k through 2025). In-memory pandas is sufficient — skip `04_create_db.py`-style stage.
- **Pipeline is 3 scripts, not 7.**
- **Dashboard scope is smaller** — one port-level dataset, not 19.
