# Phase 1 — Data Processing

**Status:** complete — 34,090 monthly rows + 2,850 yearly rows (2008–2025), 28/28 invariant checks passing.

**Goal:** produce two long-format tables with monthly and yearly granularity, extending the original 2013–2024 NB-crossings baseline back to 2008 (via the CBP Master workbook) and forward to 2025 (via the Laredo/RVG spreadsheet and El Paso PDFs), with crossing names aligned to the project's authoritative coordinates CSV.

**Final outputs:**

| File | Rows | Grain |
|---|---|---|
| `03-Processed-Data/csv/monthly_crossings_2008_2025.csv` | 34,090 | Year × Month × Crossing × Mode |
| `03-Processed-Data/csv/yearly_crossings_2008_2025.csv` | 2,850 | Year × Crossing × Mode |
| `03-Processed-Data/json/monthly_crossings_2008_2025.json` | 34,090 | same |
| `03-Processed-Data/json/yearly_crossings_2008_2025.json` | 2,850 | same |

**Monthly schema** (one row per Year × Month × Crossing × Mode):

| Column | Example |
|--------|---------|
| `ID` | `202501Del Rio International BridgeTrucks` — formula: `str(Year) + MM + Crossing + mode_id_abbrev` |
| `Year` | `2025` |
| `Month` | `1` (1–12) |
| `Region` | `Laredo` (CBP field office: `El Paso` / `Laredo` / `Pharr`) |
| `POE` | `Del Rio` (12 total — see `02-Data-Staging/config/vocab.json`) |
| `Crossing` | `Del Rio International Bridge` (33 canonical names — see §Canonical names) |
| `Modes` | `Commercial Trucks` / `Buses` / `Pedestrians/ Bicyclists` / `Passenger Vehicles` / `Railcars` |
| `Northbound Crossing` | non-negative integer |

**Yearly schema** — same as monthly but without `Month`; values are annual sums.

## Canonical names

The project's authoritative bridge/crossing name list is `01-Raw-Data/TX-MX-Border-Crossings-Coordinates.csv` (34 rows). The 2013–2024 baseline workbook uses six older spellings that are renamed on load:

| Legacy baseline name | Canonical (coordinates CSV) |
|---|---|
| Boquillas Crossing | Boquillas |
| Gateway to the Americas Bridge (Laredo Bridge I) | Gateway to the Americas Bridge |
| Good Neighbor Bridge (Stanton) | Good Neighbor Bridge |
| Juárez-Lincoln International Bridge (Laredo Bridge II) | Juárez-Lincoln International Bridge |
| McAllen/Hidalgo International Bridge | McAllen-Hidalgo International Bridge |
| World Trade Bridge (Laredo Bridge IV) | World Trade Bridge |

The rename is implemented in `01_load_baseline.py > CROSSING_RENAME_MAP`, applied before `vocab.json` is written, so every downstream script sees canonical names. The 2025 ingest crosswalk (`02-Data-Staging/config/crossing_crosswalk.json`) maps raw 2025 labels directly to canonical names. The Master workbook crosswalk (`00_load_master.py > CROSSING_MAP`) also maps directly to canonical names.

**El Paso Railroad Bridges** is the one entry that differs from the coordinates CSV by design: CBP reports combined railcar volume for the two El Paso rail bridges (BNSF + Union Pacific) as a single row. The processed data keeps the combined row as `El Paso Railroad Bridges`; the split into two bridges happens only in the map layer (see `Phase-2_WebApp.md`).

## Mode vocabulary note (Railcars)

The `Modes` column has 5 values. Source workbooks report `Rail Containers Full` and `Rail Containers Empty` separately; these are **summed** into the canonical `Railcars` mode. The `Trains` column in source reports (locomotive count) is dropped. See `02-Data-Staging/config/crossing_crosswalk.json > lrd_rvg._railcars_definition`.

Rail volume is redirected to a dedicated rail crossing per POE, not the freight bridge where the source places it:
- Laredo: `World Trade` row → `Canadian Pacific Kansas City Laredo Railroad Bridge`
- Eagle Pass: `Eagle Pass II` row → `Union Pacific Eagle Pass Railroad Bridge`
- Brownsville: `B&M Bridge` row → `West Rail Bridge`
- El Paso: `Bridge of the Americas` row → `El Paso Railroad Bridges` (combined, see above)

## Pipeline steps

### 00 — Load + transform Master workbook, append 2025
Script: `02-Data-Staging/Scripts/00_load_master.py`

- Read `01-Raw-Data/2008-2024 Master_CBP Border Crossings.xlsx` (sheet `Data`), wide format.
- Drop Santa Teresa (NM) — not a Texas crossing.
- Drop Year ≥ 2025 from the Master — 2025 is sourced from dedicated ELP/LRD files instead.
- Compute `Railcars = EmptyRC + LoadedRC`.
- **Data fixes applied before melt:**
  - Anzalduas 2010: all 12 monthly rows were tagged Month=1 in the source workbook; reassigned to months 1–12 in sequential order.
  - Paso del Norte and Ysleta each have a main-bridge row and a DCL (Dedicated Commuter Lane) row per month in the source; these are summed into a single row per month before melting.
- Melt 5 mode columns (Trucks, Buses, POVs, Pedestrians, Railcars) wide → long.
- Apply `CROSSING_MAP` (34 entries) and `REGION_MAP` to canonicalize names.
- Build `ID = str(Year) + MM + Crossing + mode_abbrev`.
- Append 2025 from `02-Data-Staging/cleaned/elp_2025.csv` and `lrd_rvg_2025.csv`.
- Emit `03-Processed-Data/csv/monthly_crossings_2008_2025.csv` (34,090 rows).
- Emit `03-Processed-Data/csv/yearly_crossings_2008_2025.csv` (2,850 rows) — grouped sum of monthly, yearly `ID = str(Year) + Crossing + mode_abbrev`.

### 01 — Load + normalize 2013–2024 baseline (vocab only)
Script: `02-Data-Staging/Scripts/01_load_baseline.py`

- Read `01-Raw-Data/NB-Crossings-2013-2024.xlsx`.
- Validate: years in [2013, 2024], no negative counts, no duplicate IDs.
- Apply `CROSSING_RENAME_MAP` to canonicalize six legacy crossing names.
- Record distinct vocabularies (Region, POE, Crossing, Modes) and `active_2024_triples` → `02-Data-Staging/config/vocab.json`. This is the **canonical vocabulary** used for conformance checks downstream.

### 02 — Ingest LRD + RVG 2025 workbook
Script: `02-Data-Staging/Scripts/02_ingest_lrd_rvg_2025.py`

- Read `01-Raw-Data/LRD-RVG-2025.xlsx` (sheet `CY 2025`, month columns Jan–Dec).
- Scan for mode section headers; melt month columns to long format (1 row per section/POE/bridge/month).
- Apply `crossing_crosswalk.json > lrd_rvg` mappings.
- Drop `Trains` section; sum `Rail Containers Empty + Full` → `Railcars`, redirect to rail crossing.
- Emit `02-Data-Staging/cleaned/lrd_rvg_2025.csv` (1,044 rows, 12 months × ~87 crossing-mode combos).
- Log unmapped rows to `02-Data-Staging/docs/unmapped_2025.md` (LRD section).

### 03 — Ingest El Paso 2025 PDFs
Script: `02-Data-Staging/Scripts/03_ingest_elp_2025.py` — full decoding notes in `02-Data-Staging/docs/elp_pdf_notes.md`.

- Parse 3 PDFs in `01-Raw-Data/ELP-2025/` using `pdfplumber.Page.extract_tables()`.
- Each page is a **single-month** summary. Page plan for CY 2025:
  - Sept PDF, pages 3–11: Jan–Sep 2025
  - Nov PDF, page 0: Oct 2025; page 1: Nov 2025
  - Dec/Jan PDF, page 0: Dec 2025 (Jan 2026 on page 1 is dropped)
- Two table layouts: legacy 9-col (Sep, Nov PDFs) and new 11-col with aircraft columns (Dec/Jan PDF).
- Non-Texas rows dropped: Columbus, Antelope Wells, Santa Teresa, Albuquerque.
- Emit `02-Data-Staging/cleaned/elp_2025.csv` (396 rows, 12 months × 33 crossing-mode combos).
- Log unmapped rows to `02-Data-Staging/docs/unmapped_2025.md` (ELP section).

### 04 — Validate + export JSON
Script: `02-Data-Staging/Scripts/04_merge_and_validate.py`

- Read `monthly_crossings_2008_2025.csv` and `yearly_crossings_2008_2025.csv`.
- Export both to JSON (`03-Processed-Data/json/`).
- Hard-fail on any duplicate IDs, null values, or negative counts.
- Emit `02-Data-Staging/docs/validation_report.md` (row counts by year, 2024→2025 gap analysis, YoY outliers, coverage summary).

### 05 — Test invariants
Script: `02-Data-Staging/Scripts/05_test_processed_data.py`

Standalone pass/fail regression suite — exit 0 on all-pass, 1 on any failure. **28 checks, all passing.**

1. File presence (monthly/yearly CSV/JSON, coordinates CSV, vocab.json).
2. Monthly CSV ↔ JSON and yearly CSV ↔ JSON row-count parity.
3. Schema: monthly = 8 cols (includes Month), yearly = 7 cols; no nulls, no negatives, integer counts.
4. Year range 2008–2025; months 1–12; 2008–2024 each have 12 months.
5. Exactly 5 canonical modes.
6. Vocabulary conformance: Region and Modes match `vocab.json`.
7. Coordinates-CSV name alignment: every `Crossing` in coordinates CSV (exception: `El Paso Railroad Bridges`); BNSF and UP rail bridges absent as expected (combined).
8. ID formula: monthly `ID == str(Year) + MM + Crossing + mode_abbrev`; yearly `ID == str(Year) + Crossing + mode_abbrev`; both unique.
9. No duplicate (Year, Month, Crossing, Modes) rows in monthly file.
10. Cross-source check: 2025 Laredo+Pharr Commercial Trucks equals raw sum from LRD-RVG workbook.
11. Yearly totals exactly match the sum of monthly totals for every (Year, Crossing, Mode).

## Resolved decisions (for historical reference)

- **Source for 2008–2024:** `2008-2024 Master_CBP Border Crossings.xlsx` (total-flow NB+SB). The column `Northbound Crossing` is retained for schema compatibility, but values for 2008–2024 are total-flow counts. 2025 values (from ELP PDFs and LRD-RVG workbook) are northbound only.
- **Bridge-name mismatches** — resolved via `CROSSING_MAP` in `00_load_master.py` and crosswalks in `config/crossing_crosswalk.json`.
- **Anzalduas 2010 data entry error** — all 12 monthly rows had Month=1 in the source. Reassigned sequentially (confirmed by magnitude alignment with adjacent years).
- **DCL rows (Paso del Norte, Ysleta)** — dedicated commuter lane rows present as separate rows per month in the Master workbook; summed into main bridge row before melt. Annual totals confirmed to match `NB-Crossings-2013-2024.xlsx` exactly (100% match across 2013–2024).
- **Container mode vocabulary** — baseline has no separate loaded/empty modes; `Full + Empty` collapses into `Railcars`; `Trains` (locomotives) is dropped.
- **El Paso PDF cadence** — each page is a single month, not YTD (confirmed empirically).
- **BNSF vs Union Pacific (El Paso rail)** — CBP reports combined; data stays single-row as `El Paso Railroad Bridges`, split handled only in the Phase 2 map layer.
- **Old pipeline retired** — `nb_crossings_2013_2025.csv` (annual NB, 2013–2025 only) has been superseded by the monthly and yearly files above and deleted.

## Reproducing the pipeline

From the project root (`CBP-Border-Corssings/`):

```
python 02-Data-Staging/Scripts/01_load_baseline.py
python 02-Data-Staging/Scripts/02_ingest_lrd_rvg_2025.py
python 02-Data-Staging/Scripts/03_ingest_elp_2025.py
python 02-Data-Staging/Scripts/00_load_master.py
python 02-Data-Staging/Scripts/04_merge_and_validate.py
python 02-Data-Staging/Scripts/05_test_processed_data.py
```

Dependencies (`02-Data-Staging/Scripts/requirements.txt`): pandas, openpyxl, pdfplumber.
