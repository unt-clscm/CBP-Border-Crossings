"""
03_ingest_elp_2025.py
Parse the three El Paso Field Office Traffic Summary Report PDFs into the
canonical long-format schema and emit cleaned/elp_2025.csv.

Each page is a SINGLE-MONTH summary. The parser uses pdfplumber.Page.
extract_tables() to pull the traffic table directly (the fallback text
reconstruction was brittle due to labels that wrap onto separate lines and
interleave with data lines in text-order extraction).

See docs/elp_pdf_notes.md for the full decoding strategy.
"""
from __future__ import annotations
import json
import re
from pathlib import Path
from typing import Optional

import pandas as pd
import pdfplumber

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "01-Raw-Data" / "ELP-2025"
CONFIG = ROOT / "02-Data-Staging" / "config"
CLEAN = ROOT / "02-Data-Staging" / "cleaned"
DOCS = ROOT / "02-Data-Staging" / "docs"
CLEAN.mkdir(parents=True, exist_ok=True)
DOCS.mkdir(parents=True, exist_ok=True)

SEP_PDF = RAW_DIR / "El Paso Field Office Traffic Summary Report - September 2025.pdf"
NOV_PDF = RAW_DIR / "El Paso Field Office Traffic Summary Report - November 2025.pdf"
DEC_PDF = RAW_DIR / "Traffic Summary Report- December 25-January 26.pdf"

# Which pages of which PDF supply which (Year, Month)
PAGE_PLAN = [
    # September PDF (FY25 = Oct 2024 .. Sep 2025) - one month per page
    (SEP_PDF, 3,  2025, 1),
    (SEP_PDF, 4,  2025, 2),
    (SEP_PDF, 5,  2025, 3),
    (SEP_PDF, 6,  2025, 4),
    (SEP_PDF, 7,  2025, 5),
    (SEP_PDF, 8,  2025, 6),
    (SEP_PDF, 9,  2025, 7),
    (SEP_PDF, 10, 2025, 8),
    (SEP_PDF, 11, 2025, 9),
    # November PDF (FY26) - Oct, Nov 2025
    (NOV_PDF, 0,  2025, 10),
    (NOV_PDF, 1,  2025, 11),
    # Dec/Jan PDF (FY26) - Dec 2025 only. Jan 2026 is dropped as partial.
    (DEC_PDF, 0,  2025, 12),
]

# Canonical set of row labels that may appear in column 1 (or column 0/2 in
# the Dec/Jan report). Values in this dict map to the "bridge key" used in
# the crosswalk (crossing_crosswalk.json > elp._crossing_for_row).
LABEL_MAP = {
    # Legacy reports (September, November PDFs)
    "Paso Del Norte": "Paso Del Norte",
    "Paso del Norte": "Paso Del Norte",
    "Paso Del Norte DCL": "Paso Del Norte DCL",
    "Paso del Norte DCL": "Paso Del Norte DCL",
    "Bridge of the Americas": "Bridge of the Americas",
    "Bridge of Americas": "Bridge of the Americas",
    "Stanton DCL": "Stanton DCL",
    "Stanton St DCL": "Stanton DCL",
    # In the Dec/Jan PDF the label sometimes arrives split as just 'Stanton St'
    # because the ' DCL' line is in a separate cell that collapses away when
    # the row has only the first line of the label. Treat it as the Stanton
    # DCL row (there is no Stanton-without-DCL row in this report family).
    "Stanton St": "Stanton DCL",
    # Dec/Jan PDF extract_tables splits labels so the data row may show just
    # the first line of the label. Add truncated aliases for each parent row.
    "Paso del": "Paso Del Norte",            # truncated 'Paso del Norte'
    "Antelope": "__drop__",                  # truncated 'Antelope Wells' (NM)
    "Wells": "__drop__",                     # lone 'Wells' continuation
    # The Dec/Jan 'El Paso Aircraft' row arrives with just 'El Paso' label
    # when its label row is consumed elsewhere; we already drop aircraft rows
    # so treat standalone 'El Paso' as drop. Real Texas 'El Paso' POE rows
    # never have label == 'El Paso' by itself (they're 'Paso Del Norte',
    # 'Bridge of the Americas', etc.).
    "El Paso": "__drop__",
    "Ysleta": "Ysleta",
    "Ysleta Bridge": "Ysleta",
    "Ysleta DCL": "Ysleta DCL",
    "Presidio": "Presidio",
    "Boquillas": "Boquillas",
    "Tornillo": "Tornillo",
    "Ft. Hancock": "Ft. Hancock",
    # Non-Texas rows we drop silently:
    "Columbus": "__drop__",
    "Antelope Wells": "__drop__",
    "Santa Teresa": "__drop__",
    "El Paso Aircraft": "__drop__",
    "Aircraft": "__drop__",
    "Albuquerque Aircraft": "__drop__",
}


def _norm_label(raw: str) -> Optional[str]:
    if raw is None:
        return None
    s = re.sub(r"\s+", " ", str(raw).replace("\n", " ")).strip()
    if not s:
        return None
    # direct + case-insensitive
    if s in LABEL_MAP:
        return LABEL_MAP[s]
    for k, v in LABEL_MAP.items():
        if k.lower() == s.lower():
            return v
    return None


def _num(v) -> int:
    if v is None:
        return 0
    t = str(v).replace(",", "").strip()
    if not t:
        return 0
    # remove stray internal whitespace that survived extraction (e.g. '1 014')
    t = re.sub(r"\s+", "", t)
    try:
        return int(t)
    except ValueError:
        try:
            return int(float(t))
        except ValueError:
            return 0


def _collapse_row(row: list[Optional[str]]) -> list[str]:
    """Drop None and empty cells, return non-empty cell strings in order."""
    return [c for c in row if c is not None and str(c).strip() != ""]


def _iter_records_legacy(table: list[list[Optional[str]]]):
    """
    Legacy layout (September, November PDFs). extract_tables() returns rows
    like:
      ['El Paso', 'Paso Del\\nNorte', '196,469', '252,515', '324', '0', '0', '0', '0']
      [None,      'Ft.\\nHancock',   '9,488',   '124',     '0',   '0', '0', '0', '0']
      ['Santa Teresa', None, '56,645', '11,044', '44', '13,193', '0', '0', '0']

    Column semantics (9 cols): Region, BridgeLabel, POVs, Peds, Buses, Trucks,
    Trains, Full, Empty. If BridgeLabel is None, the Region cell carries the
    label (e.g. 'Santa Teresa').
    """
    for row in table:
        if not row or len(row) < 9:
            continue
        a, b, *nums = row[:9]
        # filter out header-ish rows
        joined = " ".join(str(x) for x in row if x is not None)
        if any(
            tok in joined
            for tok in (
                "POVs",
                "Passenger",
                "Fiscal Year",
                "Traffic Summary",
                "October 2",
                "November 2",
                "Pedestrians",
                "Containers",
            )
        ):
            continue
        if not any(isinstance(n, str) and re.fullmatch(r"[\d,]+", str(n).strip()) for n in nums):
            continue
        # label = b if present else a
        label_raw = b if (b is not None and str(b).strip()) else a
        if not label_raw:
            continue
        # skip totals
        lr = str(label_raw).strip()
        if lr.lower().startswith("totals") or str(a).strip().lower() == "totals":
            continue
        yield {
            "raw_label": lr,
            "POVs": _num(nums[0]),
            "Peds": _num(nums[1]),
            "Buses": _num(nums[2]),
            "Trucks": _num(nums[3]),
            "Trains": _num(nums[4]),
            "FullC": _num(nums[5]),
            "EmptyC": _num(nums[6]),
        }


def _iter_records_new(table: list[list[Optional[str]]]):
    """
    New layout (Dec/Jan PDF). Extracted rows carry many None cells due to a
    wider column template; the meaningful cells are the first non-empty string
    (label, possibly in col 0-3) followed by the 9 numeric values in a 31-col
    row:
      [Region, ..., Label, ..., POVs, ..., Peds, ..., Buses, ..., CommAC,
       ..., PrivateAC, ..., Trucks, ..., Trains, ..., Full, ..., Empty, ...]
    We simply keep non-None cells. When a row has at least 9 numeric tokens
    at the end, the first non-numeric non-None cell(s) become the label.
    """
    for row in table:
        nonnull = _collapse_row(row)
        if not nonnull:
            continue
        # Skip headers
        if any(
            tok in c
            for c in nonnull
            for tok in (
                "POV",
                "PED",
                "Buses",
                "Comm",
                "Private",
                "Trucks",
                "Trains",
                "Containers",
                "Passenger",
                "Traffic Summary",
                "Fiscal Year",
                "Rail",
            )
        ):
            continue
        # Find trailing numeric tokens
        nums_rev: list[int] = []
        i = len(nonnull) - 1
        while i >= 0:
            t = nonnull[i].replace(",", "").replace(" ", "")
            if re.fullmatch(r"-?\d+", t):
                nums_rev.append(int(t))
                i -= 1
            else:
                break
        if len(nums_rev) < 9:
            continue
        nums = list(reversed(nums_rev))[:9]
        label_parts = nonnull[: len(nonnull) - len(nums_rev)]
        if not label_parts:
            continue
        # Drop the leading region col if present (e.g. 'El Paso', 'Presidio',
        # 'Columbus', 'Fabens', 'Albuquerque'). If only one part remains, it's
        # the label.
        REGION_COL_VALUES = {"El Paso", "Presidio", "Columbus", "Fabens", "Albuquerque"}
        # Remove any purely-region-column entries that are NOT the label itself
        # Heuristic: if first part is a region col and there is at least one more
        # part, strip it. Exception: 'Presidio Presidio' row (region==label).
        if len(label_parts) >= 2 and label_parts[0] in REGION_COL_VALUES:
            label_parts = label_parts[1:]
        label = " ".join(label_parts).strip()
        if label.lower().startswith("totals"):
            continue
        yield {
            "raw_label": label,
            "POVs": nums[0],
            "Peds": nums[1],
            "Buses": nums[2],
            "Trucks": nums[5],       # skip CommAC (3) and PrivateAC (4)
            "Trains": nums[6],
            "FullC": nums[7],
            "EmptyC": nums[8],
        }


def parse_page(pdf_path: Path, page_idx: int) -> list[dict]:
    with pdfplumber.open(str(pdf_path)) as pdf:
        page = pdf.pages[page_idx]
        text = page.extract_text() or ""
        tables = page.extract_tables() or []

    # Pick the widest table (the traffic one)
    if not tables:
        return []
    main_table = max(tables, key=lambda t: len(t) * max((len(r) for r in t), default=0))
    layout = "new" if "A/C" in text else "legacy"
    if layout == "legacy":
        return list(_iter_records_legacy(main_table))
    return list(_iter_records_new(main_table))


def load_crosswalk() -> dict:
    with open(CONFIG / "crossing_crosswalk.json", "r", encoding="utf-8") as fh:
        return json.load(fh)


def main() -> None:
    cw = load_crosswalk()["elp"]
    poe_for_row = cw["_poe_for_row"]
    crossing_for_row = cw["_crossing_for_row"]
    rail_cfg = cw["_rail_aggregation"]

    all_rows: list[dict] = []
    unmapped: list[str] = []

    for pdf_path, page_idx, year, month in PAGE_PLAN:
        recs = parse_page(pdf_path, page_idx)
        if not recs:
            unmapped.append(
                f"No rows parsed from {pdf_path.name} page {page_idx} ({year}-{month:02d})"
            )
            continue
        for rec in recs:
            key = _norm_label(rec["raw_label"])
            if key is None:
                unmapped.append(
                    f"Unrecognized row label in {pdf_path.name} page {page_idx} "
                    f"({year}-{month:02d}): raw={rec['raw_label']!r}"
                )
                continue
            if key == "__drop__":
                continue

            poe = poe_for_row.get(key)
            crossing = crossing_for_row.get(key)
            if poe is None or crossing is None:
                unmapped.append(
                    f"Missing crosswalk for key {key!r} in {pdf_path.name} p{page_idx}"
                )
                continue
            region = "El Paso"

            all_rows.append(dict(Year=year, Month=month, Region=region, POE=poe, Crossing=crossing,
                                 Modes="Passenger Vehicles", val=rec["POVs"],
                                 source_pdf=pdf_path.name, page=page_idx))
            all_rows.append(dict(Year=year, Month=month, Region=region, POE=poe, Crossing=crossing,
                                 Modes="Pedestrians/ Bicyclists", val=rec["Peds"],
                                 source_pdf=pdf_path.name, page=page_idx))
            all_rows.append(dict(Year=year, Month=month, Region=region, POE=poe, Crossing=crossing,
                                 Modes="Buses", val=rec["Buses"],
                                 source_pdf=pdf_path.name, page=page_idx))
            all_rows.append(dict(Year=year, Month=month, Region=region, POE=poe, Crossing=crossing,
                                 Modes="Commercial Trucks", val=rec["Trucks"],
                                 source_pdf=pdf_path.name, page=page_idx))

            if key == rail_cfg["source_row"]:
                rail_val = int(rec["FullC"]) + int(rec["EmptyC"])
                all_rows.append(dict(
                    Year=year, Month=month,
                    Region=rail_cfg["target_region"],
                    POE=rail_cfg["target_poe"],
                    Crossing=rail_cfg["target_crossing"],
                    Modes="Railcars",
                    val=rail_val,
                    source_pdf=pdf_path.name, page=page_idx,
                ))

    df = pd.DataFrame(all_rows)

    agg = (
        df.groupby(["Year", "Month", "Region", "POE", "Crossing", "Modes"], as_index=False)["val"]
        .sum()
        .rename(columns={"val": "Northbound Crossing"})
    )
    agg["source"] = "ELP_pdf"

    out = CLEAN / "elp_2025.csv"
    agg.to_csv(out, index=False, encoding="utf-8")
    print(f"[03] Wrote {out} ({len(agg)} rows)")

    # Update unmapped log — append/replace only the ELP section
    unmapped_file = DOCS / "unmapped_2025.md"
    if unmapped_file.exists() and "LRD + RVG" not in unmapped_file.read_text(encoding="utf-8"):
        print("[03] WARNING: unmapped_2025.md has no LRD section — run 02_ingest_lrd_rvg_2025.py first")
    elp_section = "## El Paso PDFs (03_ingest_elp_2025.py)\n" + (
        "\n".join(f"- {x}" for x in unmapped) if unmapped else "- (none)"
    ) + "\n"
    existing = unmapped_file.read_text(encoding="utf-8") if unmapped_file.exists() else ""
    if "## El Paso PDFs" in existing:
        pre = existing.split("## El Paso PDFs")[0]
        unmapped_file.write_text(pre + elp_section, encoding="utf-8")
    else:
        unmapped_file.write_text(existing.rstrip("\n") + "\n\n" + elp_section, encoding="utf-8")
    print(f"[03] Logged {len(unmapped)} unmapped rows to {unmapped_file}")

    # Emit (or refresh) the PDF decoding notes
    notes = DOCS / "elp_pdf_notes.md"
    notes.write_text(
        (
            "# El Paso PDF decoding notes\n\n"
            "## Source files\n"
            f"- `{SEP_PDF.name}`: FY2025, 12 pages, one month per page (Oct 2024 - Sep 2025).\n"
            f"- `{NOV_PDF.name}`: FY2026, 2 pages - Oct 2025 (p0), Nov 2025 (p1).\n"
            f"- `{DEC_PDF.name}`: FY2026, 2 pages - Dec 2025 (p0), Jan 2026 (p1, dropped as partial).\n\n"
            "## Monthly vs YTD\n"
            "Each page is a SINGLE-MONTH summary, not cumulative. The month label is\n"
            "printed in the header block beneath the `Fiscal Year` title. Cross-page\n"
            "row magnitudes are stable (not monotonically growing) which confirms the\n"
            "monthly interpretation.\n\n"
            "## Page plan for CY 2025\n"
            "- Jan-Sep 2025: pages 3..11 of the September PDF\n"
            "- Oct 2025:     page 0 of the November PDF\n"
            "- Nov 2025:     page 1 of the November PDF\n"
            "- Dec 2025:     page 0 of the Dec/Jan PDF\n"
            "- Jan 2026:     intentionally dropped - single month is not useful until\n"
            "  CY 2026 is complete and would misrepresent annual totals.\n\n"
            "## Extraction method\n"
            "We use `pdfplumber.Page.extract_tables()` (not raw text reconstruction).\n"
            "The PDFs embed true tables, so the tabular extractor returns clean\n"
            "row-column structures. Label columns that wrap (e.g., `Paso Del\\nNorte`)\n"
            "are handled with `_norm_label` which normalizes whitespace and applies a\n"
            "label alias dictionary (`LABEL_MAP`).\n\n"
            "## Column set\n"
            "Legacy reports (September, November PDFs) have columns:\n"
            "    Region | Bridge | POVs | Peds | Buses | Trucks | Trains | Full | Empty\n"
            "Dec/Jan PDF adds Comm A/C and Private A/C aircraft columns:\n"
            "    ... POVs Peds Buses CommAC PrivateAC Trucks Trains Full Empty\n"
            "The parser detects 'A/C' in the page text and switches to the 9-value\n"
            "layout, extracting positions 0,1,2,5,6,7,8 and dropping aircraft.\n\n"
            "## Mode mapping\n"
            "- POVs                -> `Passenger Vehicles`\n"
            "- Pedestrians         -> `Pedestrians/ Bicyclists`\n"
            "- Buses               -> `Buses`\n"
            "- Trucks              -> `Commercial Trucks`\n"
            "- Trains              -> DROPPED (locomotive count, not railcars)\n"
            "- Full + Empty        -> `Railcars` on `El Paso Railroad Bridges`\n\n"
            "## Rail aggregation\n"
            "All rail values appear on the `Bridge of the Americas` row. The baseline\n"
            "books all El Paso railcars to a dedicated `El Paso Railroad Bridges`\n"
            "crossing. We redirect the PDF rail value to that canonical crossing and\n"
            "define Railcars = Full Containers + Empty Containers. This is validated\n"
            "against the LRD-RVG file where the same aggregation reproduces the\n"
            "baseline 2024 railcar totals within a few percent.\n\n"
            "## Row -> Crossing crosswalk\n"
            "See `02-Data-Staging/config/crossing_crosswalk.json` > `elp._crossing_for_row`.\n\n"
            "## Dropped rows (non-Texas)\n"
            "Columbus, Antelope Wells, Santa Teresa (New Mexico ports under the El Paso\n"
            "field office), El Paso Aircraft, Albuquerque Aircraft.\n\n"
            "## Known quirks\n"
            "- The September PDF's May/June pages (pages 7 and 8) report identical\n"
            "  totals - this appears to be an error in the source report. Flagged in\n"
            "  the validation report; totals are kept as-is.\n"
            "- The Dec/Jan PDF's `extract_tables()` emits a 31-column-wide table with\n"
            "  many blank cells. The `_iter_records_new` helper compacts the row\n"
            "  before matching label + numerics.\n"
        ),
        encoding="utf-8",
    )
    print(f"[03] Wrote {notes}")


if __name__ == "__main__":
    main()
