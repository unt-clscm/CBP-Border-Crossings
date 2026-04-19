"""
01_load_baseline.py
Validate the 2013-2024 NB crossings baseline and emit the canonical vocabulary
(Region, POE, Crossing, Modes) to config/vocab.json.

Run from the project root:
    python 02-Data-Staging/Scripts/01_load_baseline.py
"""
from __future__ import annotations
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "01-Raw-Data" / "NB-Yearly-Crossings-2013-2024.xlsx"
CONFIG_DIR = ROOT / "02-Data-Staging" / "config"
CONFIG_DIR.mkdir(parents=True, exist_ok=True)

# Canonical names are defined by 01-Raw-Data/TX-MX-Border-Crossings-Coordinates.csv.
# The 2013-2024 baseline workbook uses legacy bridge labels that predate that
# canonical list; apply this map after loading so the rest of the pipeline and
# the webapp use CSV-aligned names. See Phase-2_WebApp.md for the map layer's
# treatment of the combined 'El Paso Railroad Bridges' reporting entry.
CROSSING_RENAME_MAP = {
    "Boquillas Crossing": "Boquillas",
    "Gateway to the Americas Bridge (Laredo Bridge I)": "Gateway to the Americas Bridge",
    "Good Neighbor Bridge (Stanton)": "Good Neighbor Bridge",
    "Juárez-Lincoln International Bridge (Laredo Bridge II)": "Juárez-Lincoln International Bridge",
    "McAllen/Hidalgo International Bridge": "McAllen-Hidalgo International Bridge",
    "World Trade Bridge (Laredo Bridge IV)": "World Trade Bridge",
}


def main() -> None:
    print(f"[01] Reading {RAW}")
    df = pd.read_excel(RAW)

    expected_cols = ["ID", "Year", "Region", "POE", "Crossing", "Modes", "Northbound Crossing"]
    missing = [c for c in expected_cols if c not in df.columns]
    if missing:
        raise SystemExit(f"Missing expected columns: {missing}")
    df = df[expected_cols].copy()

    # Validation
    assert df["Year"].between(2013, 2024).all(), "Year out of expected range"
    assert (df["Northbound Crossing"].fillna(0) >= 0).all(), "Negative counts in baseline"
    dup = df["ID"].duplicated().sum()
    if dup:
        raise SystemExit(f"Baseline has {dup} duplicate IDs")

    # Normalize types
    df["Year"] = df["Year"].astype(int)
    df["Northbound Crossing"] = df["Northbound Crossing"].fillna(0).astype(int)

    # Canonicalize crossing names to match the coordinates CSV
    unknown_sources = [k for k in CROSSING_RENAME_MAP if k not in set(df["Crossing"].unique())]
    if unknown_sources:
        raise SystemExit(
            f"CROSSING_RENAME_MAP references crossings not present in baseline: {unknown_sources}"
        )
    df["Crossing"] = df["Crossing"].replace(CROSSING_RENAME_MAP)
    # Re-derive ID column to reflect the renamed Crossing values.
    # Baseline ID formula: "{Year}{Crossing}{mode_id}" (see 04_merge_and_validate.py).
    MODE_ID = {
        "Commercial Trucks": "Trucks",
        "Buses": "Buses",
        "Pedestrians/ Bicyclists": "Pedestrians",
        "Passenger Vehicles": "POVs",
        "Railcars": "Railcars",
    }
    df["ID"] = (
        df["Year"].astype(str)
        + df["Crossing"].astype(str)
        + df["Modes"].map(MODE_ID).fillna(df["Modes"])
    )
    assert df["ID"].is_unique, "ID non-unique after rename + rebuild"

    # Canonical vocabulary - preserve exact spellings (including encoding artifacts)
    vocab = {
        "Region": sorted(df["Region"].dropna().unique().tolist()),
        "POE": sorted(df["POE"].dropna().unique().tolist()),
        "Crossing": sorted(df["Crossing"].dropna().unique().tolist()),
        "Modes": sorted(df["Modes"].dropna().unique().tolist()),
        # (POE, Crossing, Mode) triples that appear with any nonzero row in 2024;
        # used downstream for gap analysis.
        "active_2024_triples": (
            df[(df["Year"] == 2024) & (df["Northbound Crossing"] > 0)][
                ["Region", "POE", "Crossing", "Modes"]
            ]
            .drop_duplicates()
            .sort_values(["Region", "POE", "Crossing", "Modes"])
            .values.tolist()
        ),
        # Full (Region, POE, Crossing) catalog from baseline
        "region_poe_crossing": (
            df[["Region", "POE", "Crossing"]]
            .drop_duplicates()
            .sort_values(["Region", "POE", "Crossing"])
            .values.tolist()
        ),
    }
    out_vocab = CONFIG_DIR / "vocab.json"
    with open(out_vocab, "w", encoding="utf-8") as fh:
        json.dump(vocab, fh, indent=2, ensure_ascii=False)
    print(f"[01] Wrote {out_vocab}")
    print(f"[01] Regions: {vocab['Region']}")
    print(f"[01] Modes:   {vocab['Modes']}")
    print(f"[01] Crossings: {len(vocab['Crossing'])}")
    print(f"[01] Active 2024 triples: {len(vocab['active_2024_triples'])}")


if __name__ == "__main__":
    main()
