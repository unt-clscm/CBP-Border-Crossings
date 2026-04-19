# Data Pipeline Documentation

**Last updated:** 2026-04-19  
**Project:** TxDOT IAC 2025-26 — Task 1.3 Texas-Mexico Border Database  
**Working directory:** `CBP-Border-Corssings/`

---

## Overview

The pipeline ingests three CBP data sources, normalizes them to a common schema, and produces monthly and yearly long-format tables. The authoritative coordinates CSV lists 34 Texas-Mexico border crossings; the processed-data `Crossing` column has 33 distinct values because CBP reports the two El Paso rail bridges (BNSF + Union Pacific) as a single combined row. Coverage is 2008 through 2025.

```
01-Raw-Data/                          → cleaned intermediates → 03-Processed-Data/
  2008-2024 Master_CBP ...xlsx  ─┐
  LRD-RVG-2025.xlsx             ─┼──▶ 00_load_master.py ──▶ monthly_crossings_2008_2025.csv
  ELP-2025/*.pdf                ─┘                           yearly_crossings_2008_2025.csv
  NB-Crossings-2013-2024.xlsx   ────▶ 01_load_baseline.py ──▶ vocab.json (config only)
  TX-MX-Border-Crossings-       ────▶ 06_emit_coords_json.py ──▶ crossings_coordinates.json
    Coordinates.csv                                              (+ WebApp mirror)
```

---

## Raw Data Sources

| File | Coverage | Notes |
|---|---|---|
| `01-Raw-Data/2008-2024 Master_CBP Border Crossings.xlsx` | 2008–2024, all TX crossings, monthly | Northbound only. Wide format: one row per crossing per month, mode columns. |
| `01-Raw-Data/NB-Crossings-2013-2024.xlsx` | 2013–2024, all TX crossings, annual | Northbound only. Used exclusively to extract canonical vocabulary (`vocab.json`). |
| `01-Raw-Data/LRD-RVG-2025.xlsx` | 2025, Laredo + Rio Grande Valley, monthly | Northbound only. Stacked mode-block layout. |
| `01-Raw-Data/ELP-2025/*.pdf` (3 files) | 2025, El Paso field office, monthly | Northbound only. One page per month. |
| `01-Raw-Data/TX-MX-Border-Crossings-Coordinates.csv` | — | Authoritative crossing name and coordinate list (34 entries). |

---

## Scripts

All scripts live in `02-Data-Staging/Scripts/`. Run from the project root.

### Execution order

```
01_load_baseline.py          → vocab.json
02_ingest_lrd_rvg_2025.py    → cleaned/lrd_rvg_2025.csv
03_ingest_elp_2025.py        → cleaned/elp_2025.csv
00_load_master.py            → monthly_crossings_2008_2025.csv
                               yearly_crossings_2008_2025.csv
04_merge_and_validate.py     → JSON exports + validation_report.md
05_test_processed_data.py    → pass/fail (exit 0 or 1)
06_emit_coords_json.py       → crossings_coordinates.json (+ WebApp mirror)
```

### Script summaries

| Script | Reads | Writes | Purpose |
|---|---|---|---|
| `01_load_baseline.py` | `NB-Crossings-2013-2024.xlsx` | `config/vocab.json` | Validate baseline; extract canonical vocabulary |
| `02_ingest_lrd_rvg_2025.py` | `LRD-RVG-2025.xlsx`, `crossing_crosswalk.json` | `cleaned/lrd_rvg_2025.csv`, `docs/unmapped_2025.md` | Parse 2025 Laredo/RVG workbook into long format |
| `03_ingest_elp_2025.py` | `ELP-2025/*.pdf`, `crossing_crosswalk.json` | `cleaned/elp_2025.csv`, `docs/unmapped_2025.md`, `docs/elp_pdf_notes.md` | Parse 2025 El Paso PDFs into long format |
| `00_load_master.py` | Master xlsx, `cleaned/elp_2025.csv`, `cleaned/lrd_rvg_2025.csv` | `monthly_crossings_2008_2025.csv`, `yearly_crossings_2008_2025.csv` | Transform Master wide→long; append 2025; emit both outputs |
| `04_merge_and_validate.py` | `monthly_crossings_2008_2025.csv`, `yearly_crossings_2008_2025.csv` | JSON exports, `docs/validation_report.md` | Export JSON; hard-fail on structural errors; write report |
| `05_test_processed_data.py` | Both CSV/JSON outputs, coordinates CSV, `vocab.json`, `LRD-RVG-2025.xlsx` | Exit code 0/1 | 36-check regression suite (35 passing; 1 known failure: ELP 2025 May/June POVs identical) |
| `06_emit_coords_json.py` | `TX-MX-Border-Crossings-Coordinates.csv` | `03-Processed-Data/json/crossings_coordinates.json`, `WebApp/public/data/crossings_coordinates.json` | Emit 34-row coordinates JSON with `data_crossing_name` join key (BNSF + UP both map to `El Paso Railroad Bridges`) |

---

## Output Schema

### monthly_crossings_2008_2025.csv — 34,090 rows

| Column | Type | Description |
|---|---|---|
| `ID` | string | `str(Year) + MM + Crossing + mode_abbrev` — unique key |
| `Year` | int | 2008–2025 |
| `Month` | int | 1–12 |
| `Region` | string | CBP field office: `El Paso` / `Laredo` / `Pharr` |
| `POE` | string | Port of entry city (12 distinct values) |
| `Crossing` | string | Canonical bridge name (33 distinct values) |
| `Modes` | string | `Commercial Trucks` / `Buses` / `Passenger Vehicles` / `Pedestrians/ Bicyclists` / `Railcars` |
| `Northbound Crossing` | int | Non-negative count. Northbound only across all years. |

### yearly_crossings_2008_2025.csv — 2,850 rows

Same schema as monthly but without `Month`. Values are annual sums of the monthly file. `ID = str(Year) + Crossing + mode_abbrev`.

---

## Configuration Files

### `02-Data-Staging/config/crossing_crosswalk.json`

Central mapping config for the 2025 ingest scripts. Structure:

```
{
  "lrd_rvg": {
    "_poe_map":          { raw POE label → canonical POE }
    "_region_for_poe":   { canonical POE → Region }
    "_crossing_map":     { raw bridge label → canonical Crossing }
    "_mode_section_map": { section header → canonical Mode (null = drop) }
    "_rail_aggregation": { "raw_POE|raw_bridge" → rail crossing target }
  },
  "elp": {
    "_poe_for_row":           { PDF row label → canonical POE }
    "_crossing_for_row":      { PDF row label → canonical Crossing }
    "_rail_aggregation":      { rail redirect config }
    "_non_texas_rows_ignored": [ list of dropped row labels ]
  }
}
```

### `02-Data-Staging/config/vocab.json`

Generated by `01_load_baseline.py` from the 2013–2024 NB baseline. Contains the canonical lists of Region (3), POE (12), Crossing (33), Modes (5), and `active_2024_triples`. Used by `05_test_processed_data.py` for vocabulary conformance checks.

---

## Key Design Decisions

### Northbound consistency across all years
The Master workbook (2008–2024) matches the NB baseline (`NB-Yearly-Crossings-2013-2024.xlsx`) exactly for all overlapping years — confirmed by cross-checking annual totals per crossing and mode. All values in `Northbound Crossing` are northbound counts throughout the full 2008–2025 range.

### Crossing name authority
`TX-MX-Border-Crossings-Coordinates.csv` is the authoritative name source. All raw labels from every source are mapped to these names before any row enters the pipeline. The only exception is `El Paso Railroad Bridges` — CBP combines BNSF and Union Pacific into one reporting row; the pipeline preserves this combination, and the map layer (Phase 2) handles the split to two coordinate pins.

### Rail mode aggregation
Source files report `Rail Containers Full` and `Rail Containers Empty` as separate columns/sections. The pipeline sums them into the single canonical `Railcars` mode. The `Trains` section (locomotive counts) is dropped — incompatible with the railcar semantics of the baseline.

### Crossing coverage by year
Not all 33 crossings exist throughout the full 2008–2025 period. Five crossings were added progressively:

| Crossing | First month in data |
|---|---|
| Anzalduas International Bridge | Jan 2010 |
| El Paso Railroad Bridges | Jan 2010 |
| Donna-Rio Bravo International Bridge | Dec 2010 |
| Marcelino Serna Bridge | Jan 2011 |
| Boquillas | Sep 2014 |

Prior to these dates, the crossings simply do not appear in the source data. No zero-fill is applied for missing years — rows are absent.

---

## Intermediate Files (02-Data-Staging/cleaned/)

| File | Rows | Producer | Consumer |
|---|---|---|---|
| `lrd_rvg_2025.csv` | 1,044 | `02_ingest_lrd_rvg_2025.py` | `00_load_master.py` |
| `elp_2025.csv` | 396 | `03_ingest_elp_2025.py` | `00_load_master.py` |

These are intermediate staging files — do not edit manually.

---

## QA and Validation Documents (02-Data-Staging/docs/)

| File | Contents | Regenerated by |
|---|---|---|
| `validation_report.md` | Row counts by year, gap analysis, YoY outliers, coverage summary | `04_merge_and_validate.py` |
| `unmapped_2025.md` | Rows dropped during 2025 ingestion (LRD and ELP sections) | `02_ingest_lrd_rvg_2025.py`, `03_ingest_elp_2025.py` |
| `elp_pdf_notes.md` | Full PDF decoding strategy and layout notes | `03_ingest_elp_2025.py` |

---

## Adding Future Year Data

When 2026 data becomes available:

1. **LRD-RVG:** Update `01-Raw-Data/LRD-RVG-2025.xlsx` or add a `LRD-RVG-2026.xlsx`. Update script `02` and crosswalk accordingly.
2. **ELP:** Add new PDF(s) to `01-Raw-Data/ELP-2025/` (or a new `ELP-2026/` directory). Update `PAGE_PLAN` in script `03`.
3. **Master workbook:** If CBP releases an updated Master (2008-2025), replace the raw file and re-run script `00`. Remove the 2026 rows from the `cleaned/` appends.
4. Re-run the full pipeline and verify `05_test_processed_data.py` exits 0.
5. Update output file names and path constants in scripts `00`, `04`, `05` to reflect the new year range.
