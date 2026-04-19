# El Paso PDF decoding notes

## Source files
- `El Paso Field Office Traffic Summary Report - September 2025.pdf`: FY2025, 12 pages, one month per page (Oct 2024 - Sep 2025).
- `El Paso Field Office Traffic Summary Report - November 2025.pdf`: FY2026, 2 pages - Oct 2025 (p0), Nov 2025 (p1).
- `Traffic Summary Report- December 25-January 26.pdf`: FY2026, 2 pages - Dec 2025 (p0), Jan 2026 (p1, dropped as partial).

## Monthly vs YTD
Each page is a SINGLE-MONTH summary, not cumulative. The month label is
printed in the header block beneath the `Fiscal Year` title. Cross-page
row magnitudes are stable (not monotonically growing) which confirms the
monthly interpretation.

## Page plan for CY 2025
- Jan-Sep 2025: pages 3..11 of the September PDF
- Oct 2025:     page 0 of the November PDF
- Nov 2025:     page 1 of the November PDF
- Dec 2025:     page 0 of the Dec/Jan PDF
- Jan 2026:     intentionally dropped - single month is not useful until
  CY 2026 is complete and would misrepresent annual totals.

## Extraction method
We use `pdfplumber.Page.extract_tables()` (not raw text reconstruction).
The PDFs embed true tables, so the tabular extractor returns clean
row-column structures. Label columns that wrap (e.g., `Paso Del\nNorte`)
are handled with `_norm_label` which normalizes whitespace and applies a
label alias dictionary (`LABEL_MAP`).

## Column set
Legacy reports (September, November PDFs) have columns:
    Region | Bridge | POVs | Peds | Buses | Trucks | Trains | Full | Empty
Dec/Jan PDF adds Comm A/C and Private A/C aircraft columns:
    ... POVs Peds Buses CommAC PrivateAC Trucks Trains Full Empty
The parser detects 'A/C' in the page text and switches to the 9-value
layout, extracting positions 0,1,2,5,6,7,8 and dropping aircraft.

## Mode mapping
- POVs                -> `Passenger Vehicles`
- Pedestrians         -> `Pedestrians/ Bicyclists`
- Buses               -> `Buses`
- Trucks              -> `Commercial Trucks`
- Trains              -> DROPPED (locomotive count, not railcars)
- Full + Empty        -> `Railcars` on `El Paso Railroad Bridges`

## Rail aggregation
All rail values appear on the `Bridge of the Americas` row. The baseline
books all El Paso railcars to a dedicated `El Paso Railroad Bridges`
crossing. We redirect the PDF rail value to that canonical crossing and
define Railcars = Full Containers + Empty Containers. This is validated
against the LRD-RVG file where the same aggregation reproduces the
baseline 2024 railcar totals within a few percent.

## Row -> Crossing crosswalk
See `02-Data-Staging/config/crossing_crosswalk.json` > `elp._crossing_for_row`.

## Dropped rows (non-Texas)
Columbus, Antelope Wells, Santa Teresa (New Mexico ports under the El Paso
field office), El Paso Aircraft, Albuquerque Aircraft.

## Known quirks
- The September PDF's May/June pages (pages 7 and 8) report identical
  totals - this appears to be an error in the source report. Flagged in
  the validation report; totals are kept as-is.
- The Dec/Jan PDF's `extract_tables()` emits a 31-column-wide table with
  many blank cells. The `_iter_records_new` helper compacts the row
  before matching label + numerics.
