"""
02_ingest_lrd_rvg_2025.py
Parse the Laredo + Rio Grande Valley 2025 monthly workbook into the canonical
long format (Year, Region, POE, Crossing, Modes, Northbound Crossing).

The workbook layout is a single sheet 'CY 2025' with stacked mode blocks. Each
block has a mode header in col 0 (Trucks, Buses, POVs, Trains, Rail Containers
Empty, Rail Containers Full, Pedestrians Arriving). Then rows of
(POE, Bridge, Jan, Feb, ..., Dec).

We:
  1. Scan for mode-section headers.
  2. For each section, melt the month columns and aggregate to CY 2025 annual.
  3. Sum 'Rail Containers Empty' + 'Rail Containers Full' -> canonical 'Railcars'.
     Drop the 'Trains' locomotive-count section (not compatible with baseline).
  4. Apply the bridge-name and POE crosswalk to canonical labels.
  5. Redirect rail volume to the rail-crossing of each POE.
  6. Emit cleaned/lrd_rvg_2025.csv and log unmapped bridges.
"""
from __future__ import annotations
import json
from pathlib import Path
from typing import Optional

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "01-Raw-Data" / "LRD-RVG-2025.xlsx"
CONFIG = ROOT / "02-Data-Staging" / "config"
CLEAN = ROOT / "02-Data-Staging" / "cleaned"
DOCS = ROOT / "02-Data-Staging" / "docs"
DOCS.mkdir(parents=True, exist_ok=True)
CLEAN.mkdir(parents=True, exist_ok=True)


def load_crosswalk() -> dict:
    with open(CONFIG / "crossing_crosswalk.json", "r", encoding="utf-8") as fh:
        return json.load(fh)


def parse_sheet() -> pd.DataFrame:
    raw = pd.read_excel(RAW, sheet_name="CY 2025", header=None)
    # locate section headers: rows where col0 is str and col1 is NaN
    section_rows: list[tuple[int, str]] = []
    for i, row in raw.iterrows():
        v0, v1 = row[0], row[1]
        if isinstance(v0, str) and (pd.isna(v1) or v1 is None):
            section_rows.append((i, v0.strip()))

    # frames keyed by section name -> long rows (one row per section/POE/bridge/month)
    records: list[dict] = []
    for idx, (start, name) in enumerate(section_rows):
        end = section_rows[idx + 1][0] if idx + 1 < len(section_rows) else len(raw)
        block = raw.iloc[start + 1: end].copy()
        block = block.dropna(subset=[0, 1], how="all")
        for _, r in block.iterrows():
            poe = r[0]
            bridge = r[1]
            if pd.isna(poe) or pd.isna(bridge):
                continue
            for month_idx, col in enumerate(range(2, 14), start=1):
                v = r[col]
                try:
                    val = int(v) if pd.notna(v) else 0
                except (TypeError, ValueError):
                    val = 0
                records.append(
                    {
                        "section": name,
                        "raw_POE": str(poe).strip(),
                        "raw_Bridge": str(bridge).strip(),
                        "Month": month_idx,
                        "Northbound Crossing": val,
                    }
                )
    return pd.DataFrame.from_records(records)


def main() -> None:
    cw = load_crosswalk()["lrd_rvg"]
    poe_map = cw["_poe_map"]
    region_for_poe = cw["_region_for_poe"]
    crossing_map = cw["_crossing_map"]
    mode_map = cw["_mode_section_map"]
    rail_redirect = cw["_rail_aggregation"]

    parsed = parse_sheet()
    print(f"[02] Parsed {len(parsed)} raw (section, POE, bridge) rows")

    unmapped: list[str] = []

    out_rows: list[dict] = []
    for _, r in parsed.iterrows():
        section = r["section"]
        raw_poe = r["raw_POE"]
        raw_bridge = r["raw_Bridge"]
        month = int(r["Month"])
        value = int(r["Northbound Crossing"])

        mode = mode_map.get(section, "UNMAPPED_SECTION")
        if mode is None:
            # explicitly-dropped section (e.g., "Trains" locomotive count)
            continue
        if mode == "UNMAPPED_SECTION":
            unmapped.append(f"UNMAPPED SECTION: {section!r} (POE={raw_poe}, Bridge={raw_bridge}, value={value})")
            continue

        poe = poe_map.get(raw_poe)
        crossing = crossing_map.get(raw_bridge)
        if poe is None:
            unmapped.append(f"UNMAPPED POE: {raw_poe!r} (section={section}, bridge={raw_bridge}, value={value})")
            continue
        if crossing is None:
            unmapped.append(f"UNMAPPED BRIDGE: {raw_bridge!r} (section={section}, POE={raw_poe}, value={value})")
            continue
        region = region_for_poe.get(poe)
        if region is None:
            unmapped.append(f"UNMAPPED REGION for POE: {poe!r}")
            continue

        # For rail components, apply redirect to the rail crossing
        if mode == "__railcars_component__":
            key = f"{raw_poe}|{raw_bridge}"
            target = rail_redirect.get(key)
            if target is None:
                if value > 0:
                    unmapped.append(
                        f"Unexpected rail container volume at non-rail bridge "
                        f"(section={section}, POE={raw_poe}, bridge={raw_bridge}, value={value})"
                    )
                continue
            crossing = target
            mode = "Railcars"

        out_rows.append(
            {
                "Year": 2025,
                "Month": int(r["Month"]),
                "Region": region,
                "POE": poe,
                "Crossing": crossing,
                "Modes": mode,
                "Northbound Crossing": value,
                "source": "LRD_RVG_xlsx",
            }
        )

    df = pd.DataFrame(out_rows)
    # Aggregate (Empty + Full rail containers fall onto the same rail crossing + mode + month)
    df = (
        df.groupby(
            ["Year", "Month", "Region", "POE", "Crossing", "Modes", "source"], as_index=False
        )["Northbound Crossing"]
        .sum()
    )
    # Drop zeros? baseline keeps zeros (e.g. 0 buses at some bridges) — keep them
    out = CLEAN / "lrd_rvg_2025.csv"
    df.to_csv(out, index=False, encoding="utf-8")
    print(f"[02] Wrote {out} ({len(df)} rows)")

    # Log unmapped — script 02 always rewrites the whole file (it runs first)
    unmapped_file = DOCS / "unmapped_2025.md"
    lrd_section = "## LRD + RVG (02_ingest_lrd_rvg_2025.py)\n" + (
        "\n".join(f"- {x}" for x in unmapped) if unmapped else "- (none)"
    ) + "\n"
    unmapped_file.write_text(
        "# Unmapped 2025 rows\n\nEntries dropped or flagged during 2025 ingestion.\n\n"
        + lrd_section,
        encoding="utf-8",
    )
    print(f"[02] Logged {len(unmapped)} unmapped rows to {unmapped_file}")


if __name__ == "__main__":
    main()
