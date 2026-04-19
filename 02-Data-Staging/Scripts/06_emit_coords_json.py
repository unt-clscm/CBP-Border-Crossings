"""
06_emit_coords_json.py
Convert TX-MX-Border-Crossings-Coordinates.csv into crossings_coordinates.json
for the Phase-2 WebApp. Keeps the coordinates CSV as the single source of truth.

Output record shape:
    {
      "order": 4,
      "crossing_name": "BNSF Railroad Rail Bridge",
      "code": "ELP-ELP-ELPA-BNSF",
      "region": "El Paso",
      "county": "El Paso",
      "txdot_district": "El Paso",
      "port_of_entry": "El Paso",
      "city": "El Paso",
      "address": "805 S Santa Fe St, El Paso, TX 79901",
      "lat": 31.747985,
      "lon": -106.488242,
      "data_crossing_name": "El Paso Railroad Bridges"
    }

`data_crossing_name` is the join key used by the WebApp to merge coordinate rows
with the CBP monthly/yearly crossing totals. It equals `crossing_name` for 32 of
34 rows. The two El Paso rail bridges (BNSF and Union Pacific) both carry
`data_crossing_name = "El Paso Railroad Bridges"` so they join to the single
combined CBP row (CBP reports BNSF + UP combined; the split is not available).

Run from the project root:
    python 02-Data-Staging/Scripts/06_emit_coords_json.py
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
COORDS_CSV = ROOT / "01-Raw-Data" / "TX-MX-Border-Crossings-Coordinates.csv"
OUT_JSON_PROCESSED = ROOT / "03-Processed-Data" / "json" / "crossings_coordinates.json"
OUT_JSON_WEBAPP = ROOT / "WebApp" / "public" / "data" / "crossings_coordinates.json"

EL_PASO_RAIL_BRIDGES = {
    "BNSF Railroad Rail Bridge",
    "Union Pacific Railroad Rail Bridge",
}


def _normalize_address(value: str) -> str:
    # Collapse embedded newlines/commas so the JSON row is single-line.
    return " ".join(str(value).split())


def _data_crossing_name(crossing_name: str) -> str:
    if crossing_name in EL_PASO_RAIL_BRIDGES:
        return "El Paso Railroad Bridges"
    return crossing_name


def build_records(df: pd.DataFrame) -> list[dict]:
    records: list[dict] = []
    for _, row in df.iterrows():
        crossing_name = str(row["Border Crossing Name"]).strip()
        records.append({
            "order": int(row["Order"]),
            "crossing_name": crossing_name,
            "code": str(row["Code"]).strip(),
            "region": str(row["Region"]).strip(),
            "county": str(row["County"]).strip(),
            "txdot_district": str(row["TxDOT District"]).strip(),
            "port_of_entry": str(row["Port Of Entry"]).strip() if pd.notna(row["Port Of Entry"]) else "",
            "city": str(row["City"]).strip(),
            "address": _normalize_address(row["Address"]),
            "lat": float(row["Lat"]),
            "lon": float(row["Lon"]),
            "data_crossing_name": _data_crossing_name(crossing_name),
        })
    return records


def main() -> None:
    print(f"[06] Reading {COORDS_CSV}")
    df = pd.read_csv(COORDS_CSV)
    print(f"[06] {len(df)} coordinate rows")

    records = build_records(df)

    # Sanity check: both El Paso rail bridges must share the same data_crossing_name.
    rail_rows = [r for r in records if r["crossing_name"] in EL_PASO_RAIL_BRIDGES]
    assert len(rail_rows) == 2, "Expected exactly 2 El Paso rail-bridge coordinate rows"
    assert all(r["data_crossing_name"] == "El Paso Railroad Bridges" for r in rail_rows)

    OUT_JSON_PROCESSED.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON_PROCESSED.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[06] Wrote {OUT_JSON_PROCESSED}")

    if OUT_JSON_WEBAPP.parent.exists():
        OUT_JSON_WEBAPP.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"[06] Wrote {OUT_JSON_WEBAPP}")
    else:
        print(f"[06] Skipped WebApp mirror (parent dir missing): {OUT_JSON_WEBAPP.parent}")


if __name__ == "__main__":
    main()
