# Raw Data Gaps and Anomalies

**Last updated:** 2026-04-19  
**Sources analyzed:**
- `01-Raw-Data/2008-2024 Master_CBP Border Crossings.xlsx` — Master workbook (gaps section)
- `03-Processed-Data/csv/monthly_crossings_2008_2025.csv` — processed monthly output (anomalies section)

---

## Part 1 — Gaps in the Master Workbook (2008–2024)

### 1.1 Missing crossings by year (structural gaps)

Five crossings are absent from the Master workbook in early years because they did not yet exist or were not yet reported by CBP:

| Crossing | First month in data | Missing from |
|---|---|---|
| Anzalduas International Bridge | Jan 2010 | 2008–2009 |
| El Paso Railroad Bridges | Jan 2010 | 2008–2009 |
| Donna-Rio Bravo International Bridge | Dec 2010 | Jan 2008–Nov 2010 |
| Marcelino Serna Bridge | Jan 2011 | 2008–2010 |
| Boquillas | Sep 2014 | Jan 2008–Aug 2014 |

**Action taken:** No zero-fill applied. Rows for these crossings are simply absent prior to their opening year. The pipeline's yearly row count per year reflects these differences (28 crossings in 2008–2009, growing to 33 by 2015).

### 1.2 Anzalduas Bridge 2010 — data entry error

All 12 monthly rows for Anzalduas Bridge in 2010 were assigned `Month = 1` in the source workbook, creating 12 duplicate-month rows. The 12 rows were in chronological order with magnitudes consistent with expected monthly traffic (first row ≈ 74,000 POVs, aligning with adjacent Jan 2011 ≈ 76,000).

**Action taken:** Rows reassigned to months 1–12 in sequential order by `00_load_master.py`. A warning is printed if the expected 12 rows are not found. See script line: `df.loc[anz_2010, "Month"] = list(range(1, 13))`.

The fix assumes rows arrive in Excel row order (Jan–Dec); an adjacent-month duplicate-POV guard was added in `00_load_master.py` to detect if this assumption is violated.

### 1.3 DCL (Dedicated Commuter Lane) rows

The Master workbook includes separate DCL rows for Paso del Norte and Ysleta:
- **Ysleta:** DCL rows present for all years 2008–2024.
- **Paso del Norte:** DCL row added starting May 2024.

These DCL rows represent the same physical crossing reported as a sub-category, not a separate bridge. Leaving them unsummed would produce duplicate (Year, Month, Crossing, Mode) combinations.

**Action taken:** DCL and main-bridge rows are summed per (Year, Month, Crossing) before melting. Annual totals validated against `NB-Yearly-Crossings-2013-2024.xlsx` — 100% match across all 1,980 year/crossing/mode combinations for 2013–2024.

**2025 note:** The ELP PDFs do not provide a DCL breakdown. Paso del Norte and Ysleta 2025 values in `elp_2025.csv` are reported as single combined totals (main bridge + DCL already merged by CBP). The pipeline treats them consistently with 2008–2024 (combined total), but the DCL sub-split is not available for 2025.

### 1.4 Santa Teresa (NM) — out of scope

The Master workbook includes Santa Teresa (New Mexico), a non-Texas crossing. It appears under Region = `NM`.

**Action taken:** Dropped entirely. The `CROSSING_MAP` in `00_load_master.py` intentionally omits Santa Teresa; any row with an unmapped crossing raises a hard error.

---

## Part 2 — Anomalies in monthly_crossings_2008_2025.csv

Anomalies identified by z-score analysis (|z| > 4 across all months for a given crossing/mode) and zero-value detection (high-traffic crossing/mode combinations with unexpected zero months). Analysis was run 2026-04-19 on the final processed output.

### 2.1 Statistical spike anomalies (|z| > 4)

Rows where the monthly value is more than 4 standard deviations from the crossing/mode mean. High-z entries likely reflect real operational events (bridge openings, COVID policy, seasonal peaks) rather than data errors, but are flagged for awareness.

**Selected high-priority spikes (|z| > 6):**

| Crossing | Mode | Year-Month | Value | Mean | Z | Likely explanation |
|---|---|---|---|---|---:|---|
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
|---|---|---|---|---|---:|---|
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
| Pharr International Bridge Pedestrians (2016–2024) | Sustained zeros | Infrastructure/policy change — pedestrian access closed | Accepted as accurate |
| World Trade Bridge Pedestrians (2019–2024) | Sustained zeros | Dedicated commercial bridge; pedestrian access ended | Accepted as accurate |
| Gateway to the Americas Bridge POVs (2016–2018) | Sustained zeros | Likely reporting gap or lane reconfiguration | Flagged; source data unchanged |
| Fort Hancock POVs (mid-2021 to early 2022) | Sustained zeros | Possible closure or access restriction | Flagged; consistent with pedestrian spike |
| Lake Amistad POVs (2020–2022) | Sustained zeros | COVID-related remote crossing closure | Accepted as accurate |
| COVID dips (Apr 2020 across multiple crossings) | Negative spike | Border restrictions during pandemic | Accepted as accurate |
| Del Rio Pedestrians 2015-10 (90,002) | Positive spike | Unknown; ~7× monthly mean; no source event identified | Flagged; source data retained unchanged |
| Eagle Pass POVs 2023-12 (551 vs ~93k mean) | Negative spike | Possible data entry error or temporary closure | Flagged; source data retained unchanged |
| Fort Hancock Pedestrians (Sep–Dec 2021) | Positive spike | Possible asylum-related crossings | Flagged; accepted as plausible real event |

---

## Part 3 — YoY Outlier Report: 2024 → 2025 Monthly Breakdown

Outliers defined as |Δ| ≥ 50% on a ≥ 1,000 annual base. All six confirmed on updated pipeline (35/36 invariant checks passing, 2026-04-19; 1 known failure: ELP 2025 May vs June POVs identical — pending CBP El Paso field office confirmation). Full 12-month detail below.

### 3.1 Donna-Rio Bravo International Bridge — Pedestrians/Bicyclists (+336.8%)
**Annual: 2,315 → 10,112 (+7,797)**

| Month | 2024 | 2025 | Chg | Chg% |
|---|---:|---:|---:|---:|
| Jan | 169 | 204 | +35 | +20.7% |
| Feb | 236 | 115 | -121 | -51.3% |
| Mar | 164 | 81 | -83 | -50.6% |
| Apr | 142 | 104 | -38 | -26.8% |
| May | 196 | 500 | +304 | +155.1% |
| Jun | 204 | 158 | -46 | -22.5% |
| Jul | 151 | 158 | +7 | +4.6% |
| Aug | 304 | 71 | -233 | -76.6% |
| Sep | 219 | 84 | -135 | -61.6% |
| Oct | 145 | 121 | -24 | -16.6% |
| **Nov** | **238** | **8,365** | **+8,127** | **+3,415%** |
| Dec | 147 | 151 | +4 | +2.7% |

**Note:** November 2025 alone (8,365) accounts for the entire annual gain. The rest of the year is flat or slightly down. This is also flagged in the z-score anomaly table above (|z| = 13.3). **Recommend verification with CBP field office.**

### 3.2 Marcelino Serna Bridge — Commercial Trucks (+79.5%)
**Annual: 20,795 → 37,337 (+16,542)**

| Month | 2024 | 2025 | Chg | Chg% |
|---|---:|---:|---:|---:|
| Jan | 533 | 1,966 | +1,433 | +268.9% |
| Feb | 712 | 2,625 | +1,913 | +268.7% |
| Mar | 644 | 2,241 | +1,597 | +248.0% |
| Apr | 2,368 | 1,974 | -394 | -16.6% |
| May | 3,662 | 4,027 | +365 | +10.0% |
| Jun | 1,121 | 4,027 | +2,906 | +259.2% |
| Jul | 1,750 | 3,487 | +1,737 | +99.3% |
| Aug | 2,233 | 3,169 | +936 | +41.9% |
| Sep | 2,246 | 4,022 | +1,776 | +79.1% |
| Oct | 2,071 | 3,880 | +1,809 | +87.3% |
| Nov | 1,816 | 2,928 | +1,112 | +61.2% |
| Dec | 1,639 | 2,991 | +1,352 | +82.5% |

**Note:** Broad-based increase — 11 of 12 months are higher. Jan–Mar and Jun show the largest jumps (+250–270%). Consistent with continued ramp-up of a newer crossing; likely genuine.

### 3.3 Starr-Camargo Bridge — Pedestrians/Bicyclists (+77.6%)
**Annual: 27,385 → 48,632 (+21,247)**

| Month | 2024 | 2025 | Chg | Chg% |
|---|---:|---:|---:|---:|
| Jan | 2,166 | 3,247 | +1,081 | +49.9% |
| Feb | 2,762 | 4,500 | +1,738 | +62.9% |
| Mar | 2,276 | 4,043 | +1,767 | +77.6% |
| Apr | 2,705 | 4,509 | +1,804 | +66.7% |
| May | 1,977 | 3,596 | +1,619 | +81.9% |
| Jun | 1,234 | 2,119 | +885 | +71.7% |
| Jul | 1,339 | 2,269 | +930 | +69.5% |
| Aug | 2,462 | 4,234 | +1,772 | +72.0% |
| Sep | 2,981 | 5,106 | +2,125 | +71.3% |
| Oct | 3,357 | 5,335 | +1,978 | +58.9% |
| Nov | 2,429 | 4,689 | +2,260 | +93.0% |
| Dec | 1,697 | 4,985 | +3,288 | +193.8% |

**Note:** All 12 months are higher. Consistent broad-based growth; likely a genuine sustained increase.

### 3.4 Los Ebanos Ferry — Pedestrians/Bicyclists (+69.8%)
**Annual: 21,228 → 36,051 (+14,823)**

| Month | 2024 | 2025 | Chg | Chg% |
|---|---:|---:|---:|---:|
| Jan | 1,702 | 2,365 | +663 | +39.0% |
| Feb | 0 | 2,641 | +2,641 | — |
| Mar | 0 | 3,328 | +3,328 | — |
| Apr | 0 | 3,288 | +3,288 | — |
| May | 695 | 3,340 | +2,645 | +380.6% |
| Jun | 1,933 | 2,058 | +125 | +6.5% |
| Jul | 1,925 | 2,322 | +397 | +20.6% |
| Aug | 2,724 | 3,032 | +308 | +11.3% |
| Sep | 2,449 | 3,217 | +768 | +31.4% |
| Oct | 3,074 | 3,177 | +103 | +3.4% |
| Nov | 3,175 | 3,538 | +363 | +11.4% |
| Dec | 3,551 | 3,745 | +194 | +5.5% |

**Note:** Feb–Apr 2024 are zero (ferry closed — see §2.2). The 2024 closure drives the bulk of the annual gap; months where both years have data show modest +3–39% gains.

### 3.5 Presidio-Ojinaga International Bridge — Buses (+56.1%)
**Annual: 1,471 → 2,296 (+825)**

| Month | 2024 | 2025 | Chg | Chg% |
|---|---:|---:|---:|---:|
| Jan | 90 | 162 | +72 | +80.0% |
| Feb | 92 | 163 | +71 | +77.2% |
| Mar | 119 | 243 | +124 | +104.2% |
| Apr | 114 | 179 | +65 | +57.0% |
| May | 123 | 190 | +67 | +54.5% |
| Jun | 140 | 190 | +50 | +35.7% |
| Jul | 120 | 196 | +76 | +63.3% |
| Aug | 121 | 251 | +130 | +107.4% |
| Sep | 94 | 201 | +107 | +113.8% |
| Oct | 143 | 158 | +15 | +10.5% |
| Nov | 150 | 177 | +27 | +18.0% |
| Dec | 165 | 186 | +21 | +12.7% |

**Note:** Steady increase across all 12 months on low absolute volumes. Likely a genuine trend.

### 3.6 Los Ebanos Ferry — Passenger Vehicles (+54.0%)
**Annual: 28,398 → 43,732 (+15,334)**

| Month | 2024 | 2025 | Chg | Chg% |
|---|---:|---:|---:|---:|
| Jan | 1,929 | 2,529 | +600 | +31.1% |
| Feb | 0 | 3,225 | +3,225 | — |
| Mar | 0 | 3,172 | +3,172 | — |
| Apr | 0 | 3,726 | +3,726 | — |
| May | 1,119 | 4,150 | +3,031 | +270.9% |
| Jun | 3,050 | 3,448 | +398 | +13.0% |
| Jul | 3,665 | 4,009 | +344 | +9.4% |
| Aug | 3,930 | 4,141 | +211 | +5.4% |
| Sep | 3,278 | 3,733 | +455 | +13.9% |
| Oct | 3,695 | 3,758 | +63 | +1.7% |
| Nov | 3,780 | 3,977 | +197 | +5.2% |
| Dec | 3,952 | 3,864 | -88 | -2.2% |

**Note:** Same ferry closure explanation as §3.4. Feb–Apr 2024 zeros drive the annual gap; operating months are essentially flat (+1–13%).

---

### Part 3 Summary

| # | Crossing | Mode | Annual Chg% | Root cause |
|---|---|---|---:|---|
| 1 | Donna-Rio Bravo International Bridge | Pedestrians/Bicyclists | +337% | **Single-month spike (Nov 2025)** — recommend CBP verification |
| 2 | Marcelino Serna Bridge | Commercial Trucks | +80% | Broad ramp-up across 11 months; likely genuine |
| 3 | Starr-Camargo Bridge | Pedestrians/Bicyclists | +78% | Consistent monthly growth across all 12 months |
| 4 | Los Ebanos Ferry | Pedestrians/Bicyclists | +70% | Feb–Apr 2024 ferry closure zeros (see §2.2) |
| 5 | Presidio-Ojinaga International Bridge | Buses | +56% | Steady trend on small volumes |
| 6 | Los Ebanos Ferry | Passenger Vehicles | +54% | Feb–Apr 2024 ferry closure zeros (see §2.2) |
