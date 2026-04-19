# Raw Data Gaps and Anomalies

**Last updated:** 2026-04-19  
**Sources analyzed:**
- `01-Raw-Data/2008-2024 Master_CBP Border Crossings.xlsx` — Master workbook (gaps section)
- `03-Processed-Data/csv/monthly_crossings_2008_2025.csv` — processed monthly output (anomalies section)

---

## Part 1 — Gaps in the Master Workbook (2008–2024)

### 1.1 Missing crossings by year (structural gaps)

Five crossings are absent from the Master workbook in early years because they did not yet exist or were not yet reported by CBP:

| Crossing | First year reported | Missing from |
|---|---|---|
| Anzalduas International Bridge | 2010 | 2008–2009 |
| Donna-Rio Bravo International Bridge | 2010 | 2008–2009 |
| El Paso Railroad Bridges | 2010 | 2008–2009 |
| Marcelino Serna Bridge | 2011 | 2008–2010 |
| Boquillas | 2014 | 2008–2013 |

**Action taken:** No zero-fill applied. Rows for these crossings are simply absent prior to their opening year. The pipeline's yearly row count per year reflects these differences (28 crossings in 2008–2009, growing to 33 by 2015).

### 1.2 NB vs total-flow data (systematic difference)

The Master workbook reports **total-flow** (northbound + southbound combined), not northbound-only. The column `Northbound Crossing` is retained in the output for schema compatibility, but values for 2008–2024 represent bidirectional totals.

The 2025 data sourced from ELP PDFs and the LRD-RVG workbook is **northbound only**.

**Impact:** Year-over-year comparisons between 2024 and 2025 are not strictly comparable on an NB basis. Users should apply caution when interpreting 2024→2025 trend analysis. The YoY outlier analysis in `02-Data-Staging/docs/validation_report.md` reflects this limitation.

**Action taken:** No adjustment made to 2008–2024 values. The distinction is documented here and in `Data-Pipeline-Documentation.md`.

### 1.3 Anzalduas Bridge 2010 — data entry error

All 12 monthly rows for Anzalduas Bridge in 2010 were assigned `Month = 1` in the source workbook, creating 12 duplicate-month rows. The 12 rows were in chronological order with magnitudes consistent with expected monthly traffic (first row ≈ 74,000 POVs, aligning with adjacent Jan 2011 ≈ 76,000).

**Action taken:** Rows reassigned to months 1–12 in sequential order by `00_load_master.py`. A warning is printed if the expected 12 rows are not found. See script line: `df.loc[anz_2010, "Month"] = list(range(1, 13))`.

### 1.4 DCL (Dedicated Commuter Lane) rows

The Master workbook includes separate DCL rows for Paso del Norte and Ysleta:
- **Ysleta:** DCL rows present for all years 2008–2024.
- **Paso del Norte:** DCL row added starting May 2024.

These DCL rows represent the same physical crossing reported as a sub-category, not a separate bridge. Leaving them unsummed would produce duplicate (Year, Month, Crossing, Mode) combinations.

**Action taken:** DCL and main-bridge rows are summed per (Year, Month, Crossing) before melting. Annual totals validated against `NB-Crossings-2013-2024.xlsx` — 100% match across all 1,980 year/crossing/mode combinations for 2013–2024.

### 1.5 Santa Teresa (NM) — out of scope

The Master workbook includes Santa Teresa (New Mexico), a non-Texas crossing. It appears under Region = `NM`.

**Action taken:** Dropped entirely. The `CROSSING_MAP` in `00_load_master.py` intentionally omits Santa Teresa; any row with an unmapped crossing raises a hard error.

---

## Part 2 — Anomalies in monthly_crossings_2008_2025.csv

Anomalies identified by z-score analysis (|z| > 4 across all months for a given crossing/mode) and zero-value detection (high-traffic crossing/mode combinations with unexpected zero months). Analysis was run 2026-04-19 on the final processed output.

### 2.1 Statistical spike anomalies (|z| > 4)

Rows where the monthly value is more than 4 standard deviations from the crossing/mode mean. High-z entries likely reflect real operational events (bridge openings, COVID policy, seasonal peaks) rather than data errors, but are flagged for awareness.

**Selected high-priority spikes (|z| > 6):**

| Crossing | Mode | Year-Month | Value | Mean | Z | Likely explanation |
|---|---|---|---|---|---:|---:|---|
| Del Rio International Bridge | Buses | 2008-01 | 218 | 1 | 14.7 | Bus operations began 2008; subsequent months near zero suggest service ended |
| Pharr International Bridge | Buses | 2010-07 | 226 | 3 | 13.8 | Isolated spike; surrounding months near zero |
| Marcelino Serna Bridge | Buses | 2019-05 | 118 | 1 | 13.4 | Bridge opened 2011; buses rare; single-month anomaly |
| Donna-Rio Bravo International Bridge | Pedestrians | 2025-11 | 8,365 | 79 | 13.3 | 2025 NB-only data at a bridge with historically low pedestrian counts; possible new operations |
| Anzalduas International Bridge | Buses | 2010-07 | 276 | 9 | 10.5 | First year in data (opened 2010); early operational pattern |
| Del Rio International Bridge | Pedestrians | 2015-10 | 90,002 | 12,082 | 9.5 | Single-month spike ~7× mean; no obvious operational event identified in source |
| Free Trade International Bridge (Los Indios) | Buses | 2008-02, 2008-03 | 18–19 | 0 | ~9 | Early-period bus service; near-zero otherwise |
| Free Trade International Bridge (Los Indios) | Pedestrians | 2024-01, 2025-02 | ~21,944 / ~21,644 | 1,883 | ~8.5 | Sustained high values Jan 2024 + Feb 2025; may reflect improved counting or pedestrian infrastructure change |
| Roma-Ciudad Miguel Alemán International Bridge | Pedestrians | 2021-01, 2021-02 | 72,821 / 60,158 | 20,121 | ~7–8 | Post-COVID rebound; consistent with border reopening patterns |
| Bridge of the Americas | Pedestrians | 2023-12 | 261,043 | 83,948 | 6.4 | Holiday/December seasonal peak; highest recorded month for this crossing |
| Colombia Solidarity Bridge | Buses | 2017-07–09 | 200–296 | 13 | ~4–6 | Multi-month elevated bus counts; possible charter or program activity |
| Fort Hancock-El Porvenir Bridge | Pedestrians | 2021-04 to 2022-01 | 3,679–4,310 | 403 | ~4–5 | Sustained ~10× elevation Sep 2021–Jan 2022; possibly asylum-related pedestrian crossings |
| McAllen-Hidalgo International Bridge | Pedestrians | 2024-12 | 384,415 | 172,746 | 5.4 | Holiday peak; highest on record for this crossing |
| Juárez-Lincoln International Bridge | Buses | 2014-03 | 5,692 | 3,060 | 4.1 | Moderate spike; within plausible operational range |

**Negative spikes (unusually low values, |z| > 4):**

| Crossing | Mode | Year-Month | Value | Mean | Z | Likely explanation |
|---|---|---|---|---|---:|---:|---|
| Veterans International Bridge at Los Tomates | Passenger Vehicles | 2020-04 | 43,547 | 115,943 | -4.0 | COVID-19 border restrictions (April 2020) |
| Eagle Pass International Bridge | Passenger Vehicles | 2023-12 | 551 | 93,196 | -4.2 | Anomalously low; possible data entry error or temporary closure |
| Presidio-Ojinaga International Bridge | Passenger Vehicles | 2020-04 | 23,376 | 54,348 | -4.5 | COVID-19 border restrictions |

### 2.2 Zero-value gaps in high-traffic crossings

The following crossing/mode combinations have one or more months reporting zero in years prior to 2025, where the average non-zero monthly value exceeds 1,000. Zeros may reflect closures, policy changes, data entry omissions, or seasonal suspensions.

**Boquillas / Pedestrians — 7 zero months**
- Nov 2014: crossing opened in May 2013; Nov 2014 zero likely a reporting gap
- Apr–May 2020, Oct 2020, Dec 2020, Jan 2021, Oct 2021: COVID-19 closure (Boquillas was closed to international visitors)

**Camino Real International Bridge / Pedestrians — 1 zero month**
- Feb 2023: isolated gap; surrounding months normal (~17,000/month average)

**El Paso Railroad Bridges / Railcars — 1 zero month**
- Oct 2013: single month zero in first full year of reporting; possible data entry omission

**Fort Hancock-El Porvenir Bridge / Passenger Vehicles — 9 zero months**
- May–Dec 2021, Jan 2022: prolonged closure or suspension; consistent with the same period showing a pedestrian spike (asylum-related crossings diverted from vehicles?)

**Free Trade International Bridge (Los Indios) / Pedestrians — 2 zero months**
- Feb 2009, Aug 2009: early-period data gaps; surrounding months have pedestrian counts

**Gateway to the Americas Bridge / Passenger Vehicles — 22 zero months**
- Jun 2016 – Mar 2018 (22 consecutive months): prolonged reporting suspension or bridge lane reconfiguration. Commercial truck volumes at this crossing remained normal throughout, suggesting the bridge was open but POV lane reporting was interrupted.

**Lake Amistad Dam Crossing / Passenger Vehicles — 32 zero months**
- Mar–Sep 2015 (7 months): possible seasonal closure or low-water access issue
- May 2020 – Feb 2022 (22 months): extended COVID-related closure for this remote crossing
- Scattered months 2023–2024: possible seasonal access gaps

**Los Ebanos Ferry / Passenger Vehicles and Pedestrians — 22 zero months each**
- Apr–May 2008, Oct 2008; Apr 2009; various 2010 months: early operational gaps; ferry service is seasonal and weather-dependent
- Apr 2017, Apr 2018: April closures consistent with low-water or maintenance
- Apr–Sep 2020: COVID closure
- Jul 2023; Feb–Apr 2024: recent operational gaps

**Pharr International Bridge / Pedestrians — 99 zero months (Oct 2016 – Dec 2024)**
- Sustained reporting of zero pedestrians for over 8 years. This is almost certainly a policy or infrastructure change — pedestrian access was likely closed or reclassified. The crossing continues to report normal Commercial Trucks and Passenger Vehicles.

**Union Pacific Eagle Pass Railroad Bridge / Railcars — 2 zero months**
- Sep 2017, Sep 2018: same month in consecutive years; possibly an annual reporting gap or maintenance period

**World Trade Bridge / Pedestrians — 67 zero months (Jun 2019 – Dec 2024)**
- Zero pedestrian crossings reported for 5.5 consecutive years. World Trade Bridge is a dedicated commercial truck bridge; pedestrian access appears to have been formally ended around mid-2019. The non-zero values 2008–2019 likely reflect limited pre-closure pedestrian activity.

---

## Summary Table — Anomaly Classification

| Anomaly | Type | Root cause | Action |
|---|---|---|---|
| Anzalduas 2010 month=1 for all rows | Data entry error | Source workbook | Fixed: months reassigned 1–12 in `00_load_master.py` |
| DCL rows for Paso del Norte / Ysleta | Duplicate rows | Reporting structure | Fixed: summed before melt in `00_load_master.py` |
| 5 crossings absent pre-opening | Structural gap | Bridges not yet built/opened | Accepted: no rows created for missing periods |
| NB vs total-flow (2008–2024) | Systematic difference | Different CBP reporting methodology | Documented: column named for compatibility; users must be aware |
| Pharr International Bridge Pedestrians (2016–2024) | Sustained zeros | Infrastructure/policy change — pedestrian access closed | Accepted as accurate |
| World Trade Bridge Pedestrians (2019–2024) | Sustained zeros | Dedicated commercial bridge; pedestrian access ended | Accepted as accurate |
| Gateway to the Americas Bridge POVs (2016–2018) | Sustained zeros | Likely reporting gap or lane reconfiguration | Flagged; source data unchanged |
| Fort Hancock POVs (mid-2021 to early 2022) | Sustained zeros | Possible closure or access restriction | Flagged; consistent with pedestrian spike |
| Lake Amistad POVs (2020–2022) | Sustained zeros | COVID-related remote crossing closure | Accepted as accurate |
| COVID dips (Apr 2020 across multiple crossings) | Negative spike | Border restrictions during pandemic | Accepted as accurate |
| Del Rio Pedestrians 2015-10 (90,002) | Positive spike | Unknown; ~7× monthly mean; no source event identified | Flagged; source data retained unchanged |
| Eagle Pass POVs 2023-12 (551 vs ~93k mean) | Negative spike | Possible data entry error or temporary closure | Flagged; source data retained unchanged |
| Fort Hancock Pedestrians (Sep–Dec 2021) | Positive spike | Possible asylum-related crossings | Flagged; accepted as plausible real event |
