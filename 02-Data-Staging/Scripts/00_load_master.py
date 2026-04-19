"""
00_load_master.py
Transform the wide monthly Master workbook (2008-2024) into long format and
append 2025 data from the dedicated ELP and LRD-RVG cleaned sources.

Output: 03-Processed-Data/csv/monthly_crossings_2008_2025.csv
Columns: ID, Year, Month, Region, POE, Crossing, Modes, Northbound Crossing
ID format: "{YYYY}-{MM}-{CROSSING_SLUG}-{ModeAbbr}"  e.g. "2008-01-BRID-Buses"

Notes:
- Santa Teresa (NM) is dropped — not a Texas crossing.
- El Paso RR is mapped to 'El Paso Railroad Bridges' (CBP combined row; see
  el_paso_rail_bridges_rule.md for map-layer split treatment).
- The Master is northbound only; the 'Northbound Crossing' column name is
  kept for schema compatibility and values are consistent with the NB baseline.
- Rail is reported as EmptyRC + LoadedRC in the Master; these are summed into
  the 'Railcars' mode. The 'Trains' column is dropped (no equivalent in NB file).

Run from the project root:
    python 02-Data-Staging/Scripts/00_load_master.py
"""
from __future__ import annotations
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "01-Raw-Data" / "2008-2024 Master_CBP Border Crossings.xlsx"
OUT_DIR = ROOT / "03-Processed-Data" / "csv"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT_CSV = OUT_DIR / "monthly_crossings_2008_2025.csv"
OUT_CSV_YEARLY = OUT_DIR / "yearly_crossings_2008_2025.csv"
ELP_2025 = ROOT / "02-Data-Staging" / "cleaned" / "elp_2025.csv"
LRD_2025 = ROOT / "02-Data-Staging" / "cleaned" / "lrd_rvg_2025.csv"

# Map Master BrdgNameCommon → canonical name from TX-MX-Border-Crossings-Coordinates.csv
# Santa Teresa is intentionally absent (dropped).
CROSSING_MAP = {
    "Amistad":           "Lake Amistad Dam Crossing",
    "Anzalduas Bridge":  "Anzalduas International Bridge",
    "B&M Bridge":        "Brownsville & Matamoros Express Bridge",
    "BOTA":              "Bridge of the Americas",
    "Boquillas Crossing":"Boquillas",
    "Camino Real":       "Camino Real International Bridge",
    "Colombia":          "Colombia Solidarity Bridge",
    "Del Rio":           "Del Rio International Bridge",
    "Donna Bridge":      "Donna-Rio Bravo International Bridge",
    "Eagle Pass":        "Eagle Pass International Bridge",
    "Eagle Pass RR":     "Union Pacific Eagle Pass Railroad Bridge",
    "El Paso RR":        "El Paso Railroad Bridges",
    "Fort Hancock":      "Fort Hancock-El Porvenir Bridge",
    "Free Trade Bridge": "Free Trade International Bridge (Los Indios)",
    "Gateway Brownsville":"Gateway International Bridge",
    "Gateway LAR":       "Gateway to the Americas Bridge",
    "Juarez-Lincoln Bridge":"Juárez-Lincoln International Bridge",
    "Lake Falcon":       "Lake Falcon Dam International Crossing",
    "Laredo RR":         "Canadian Pacific Kansas City Laredo Railroad Bridge",
    "Los Ebanos Ferry":  "Los Ebanos Ferry",
    "McAllen/Hidalgo":   "McAllen-Hidalgo International Bridge",
    "Mserna":            "Marcelino Serna Bridge",
    "Paso del Norte":    "Paso del Norte Bridge",
    "Pharr Bridge":      "Pharr International Bridge",
    "Presidio Bridge":   "Presidio-Ojinaga International Bridge",
    "Progreso Bridge":   "Progreso International Bridge",
    "Roma Bridge":       "Roma-Ciudad Miguel Alemán International Bridge",
    "Stanton":           "Good Neighbor Bridge",
    "Starr-Camargo":     "Starr-Camargo Bridge",
    "Veterans Bridge":   "Veterans International Bridge at Los Tomates",
    "West Rail Bridge":  "West Rail Bridge",
    "World Trade Bridge":"World Trade Bridge",
    "Ysleta":            "Ysleta Bridge",
}

# Master region codes → canonical region names used in the pipeline
REGION_MAP = {
    "ELP": "El Paso",
    "LAR": "Laredo",
    "RGV": "Pharr",
    # NM dropped via CROSSING_MAP exclusion
}

MODE_ID = {
    "Commercial Trucks":      "Trucks",
    "Buses":                  "Buses",
    "Pedestrians/ Bicyclists":"Pedestrians",
    "Passenger Vehicles":     "POVs",
    "Railcars":               "Railcars",
}

CROSSING_SLUG = {
    "Anzalduas International Bridge":                    "ANZA",
    "Boquillas":                                         "BOQU",
    "Bridge of the Americas":                            "BRID",
    "Brownsville & Matamoros Express Bridge":            "BROW",
    "Camino Real International Bridge":                  "CAMI",
    "Canadian Pacific Kansas City Laredo Railroad Bridge":"CANA",
    "Colombia Solidarity Bridge":                        "COLO",
    "Del Rio International Bridge":                      "DELR",
    "Donna-Rio Bravo International Bridge":              "DONN",
    "Eagle Pass International Bridge":                   "EAGL",
    "El Paso Railroad Bridges":                          "ELPA",
    "Fort Hancock-El Porvenir Bridge":                   "FORT",
    "Free Trade International Bridge (Los Indios)":      "FREE",
    "Gateway International Bridge":                      "GATE",
    "Gateway to the Americas Bridge":                    "GTAB",
    "Good Neighbor Bridge":                              "GOOD",
    "Juárez-Lincoln International Bridge":               "JUAR",
    "Lake Amistad Dam Crossing":                         "LAKA",
    "Lake Falcon Dam International Crossing":            "LAKF",
    "Los Ebanos Ferry":                                  "LOSE",
    "Marcelino Serna Bridge":                            "MARC",
    "McAllen-Hidalgo International Bridge":              "MCAL",
    "Paso del Norte Bridge":                             "PASO",
    "Pharr International Bridge":                        "PHAR",
    "Presidio-Ojinaga International Bridge":             "PRES",
    "Progreso International Bridge":                     "PROG",
    "Roma-Ciudad Miguel Alemán International Bridge":    "ROMA",
    "South Orient Railroad Bridge":                      "SOUT",
    "Starr-Camargo Bridge":                              "STAR",
    "Union Pacific Eagle Pass Railroad Bridge":          "UNIO",
    "Veterans International Bridge at Los Tomates":      "VETE",
    "West Rail Bridge":                                  "WEST",
    "World Trade Bridge":                                "WORL",
    "Ysleta Bridge":                                     "YSLE",
}


def main() -> None:
    print(f"[00] Reading {RAW}")
    df = pd.read_excel(RAW, sheet_name="Data")

    # Drop NM (Santa Teresa) and 2025 (sourced from ELP PDFs + LRD-RVG xlsx instead)
    df = df[(df["Region"] != "NM") & (df["Year"] < 2025)].copy()

    # Compute Railcars = EmptyRC + LoadedRC (both may be NaN for non-rail crossings)
    df["Railcars"] = df[["EmptyRC", "Loaded RC"]].fillna(0).sum(axis=1)

    # --- Data fixes before melt ---

    # Anzalduas 2010: all 12 months were entered as Month=1 in the source workbook.
    # The 12 rows are in Jan-Dec order; reassign Month accordingly.
    anz_2010 = (df["BrdgNameCommon"] == "Anzalduas Bridge") & (df["Year"] == 2010)
    if anz_2010.sum() == 12:
        df.loc[anz_2010, "Month"] = list(range(1, 13))
        print("[00] Fixed Anzalduas 2010: reassigned 12 rows to months 1–12")
        # Order-validation guard: the reassignment assumes rows arrived in Jan–Dec
        # order. If two adjacent months share the same nonzero POV value, that
        # assumption is almost certainly violated (real monthly POV traffic at
        # Anzalduas varies month-to-month; exact duplicates are implausible).
        pov_series = (
            df.loc[anz_2010].sort_values("Month")["POVs"].fillna(0).astype(int).tolist()
        )
        for i in range(len(pov_series) - 1):
            a, b = pov_series[i], pov_series[i + 1]
            if a != 0 and a == b:
                raise SystemExit(
                    f"[00] Anzalduas 2010 order check FAILED: months "
                    f"{i + 1} and {i + 2} have identical POV value {a:,} — "
                    f"rows likely not in calendar order. POV series: {pov_series}"
                )
        print("[00] Anzalduas 2010 order check passed")
    else:
        print(f"[00] WARNING: Anzalduas 2010 has {anz_2010.sum()} rows (expected 12) — skipped fix")

    # Paso del Norte and Ysleta each have a main-bridge row and a DCL row per month.
    # Sum them into a single row per (Year, Month) before melting.
    DCL_CROSSINGS = {"Paso del Norte", "Ysleta"}
    non_dcl = df[~df["BrdgNameCommon"].isin(DCL_CROSSINGS)].copy()
    dcl_agg = (
        df[df["BrdgNameCommon"].isin(DCL_CROSSINGS)]
        .groupby(["Year", "Month", "Region", "POE", "BrdgNameCommon"], as_index=False)
        [["Trucks", "Buses ", "POVs", "Pedestrians", "EmptyRC", "Loaded RC", "Railcars"]]
        .sum(min_count=1)
    )
    df = pd.concat([non_dcl, dcl_agg], ignore_index=True)

    # Rename mode columns to canonical mode labels
    df = df.rename(columns={
        "Trucks":       "Commercial Trucks",
        "Buses ":       "Buses",
        "POVs":         "Passenger Vehicles",
        "Pedestrians":  "Pedestrians/ Bicyclists",
    })

    # Melt wide → long on the five mode columns
    id_vars = ["Year", "Month", "Region", "POE", "BrdgNameCommon"]
    value_vars = ["Commercial Trucks", "Buses", "Passenger Vehicles",
                  "Pedestrians/ Bicyclists", "Railcars"]
    long = df[id_vars + value_vars].melt(
        id_vars=id_vars,
        value_vars=value_vars,
        var_name="Modes",
        value_name="Northbound Crossing",
    )

    # Drop rows where the crossing has no mapping (shouldn't happen after NM drop)
    unknown = set(long["BrdgNameCommon"].unique()) - set(CROSSING_MAP)
    if unknown:
        raise SystemExit(f"[00] Unmapped crossings: {unknown}")

    long["Crossing"] = long["BrdgNameCommon"].map(CROSSING_MAP)
    long["Region"] = long["Region"].map(REGION_MAP)

    # Fill nulls with 0
    long["Northbound Crossing"] = long["Northbound Crossing"].fillna(0).astype(int)

    unmapped_slugs = set(long["Crossing"].unique()) - set(CROSSING_SLUG)
    if unmapped_slugs:
        raise SystemExit(f"[00] No crossing slug for: {unmapped_slugs}")

    # Build ID: "{YYYY}-{MM}-{SLUG}-{ModeAbbr}"  e.g. "2008-01-BRID-Buses"
    long["ID"] = (
        long["Year"].astype(str)
        + "-"
        + long["Month"].astype(str).str.zfill(2)
        + "-"
        + long["Crossing"].map(CROSSING_SLUG)
        + "-"
        + long["Modes"].map(MODE_ID).fillna(long["Modes"])
    )

    dup = long["ID"].duplicated().sum()
    if dup:
        raise SystemExit(f"[00] {dup} duplicate IDs — check source data")

    out = long[["ID", "Year", "Month", "Region", "POE", "Crossing", "Modes",
                "Northbound Crossing"]].sort_values(
        ["Year", "Month", "Region", "POE", "Crossing", "Modes"]
    ).reset_index(drop=True)

    # --- Append 2025 from the dedicated cleaned sources ---
    def _prep_2025(path: Path) -> pd.DataFrame:
        df25 = pd.read_csv(path)
        df25 = df25[["Year", "Month", "Region", "POE", "Crossing", "Modes",
                     "Northbound Crossing"]].copy()
        df25["Year"] = df25["Year"].astype(int)
        df25["Month"] = df25["Month"].astype(int)
        df25["Northbound Crossing"] = df25["Northbound Crossing"].fillna(0).astype(int)
        df25["ID"] = (
            df25["Year"].astype(str)
            + "-"
            + df25["Month"].astype(str).str.zfill(2)
            + "-"
            + df25["Crossing"].map(CROSSING_SLUG).fillna(df25["Crossing"])
            + "-"
            + df25["Modes"].map(MODE_ID).fillna(df25["Modes"])
        )
        return df25

    elp25 = _prep_2025(ELP_2025)
    lrd25 = _prep_2025(LRD_2025)
    data_2025 = pd.concat([elp25, lrd25], ignore_index=True)
    dup25 = data_2025["ID"].duplicated().sum()
    if dup25:
        raise SystemExit(f"[00] {dup25} duplicate IDs in 2025 sources")

    out = pd.concat([out, data_2025], ignore_index=True)
    out = out.sort_values(["Year", "Month", "Region", "POE", "Crossing", "Modes"]).reset_index(drop=True)

    out.to_csv(OUT_CSV, index=False, encoding="utf-8")
    print(f"[00] Wrote {OUT_CSV} ({len(out):,} rows)")

    # --- Yearly aggregate ---
    yearly = (
        out.groupby(["Year", "Region", "POE", "Crossing", "Modes"], as_index=False)["Northbound Crossing"]
        .sum()
    )
    yearly["ID"] = (
        yearly["Year"].astype(str)
        + "-"
        + yearly["Crossing"].map(CROSSING_SLUG)
        + "-"
        + yearly["Modes"].map(MODE_ID).fillna(yearly["Modes"])
    )
    yearly = yearly[["ID", "Year", "Region", "POE", "Crossing", "Modes", "Northbound Crossing"]].sort_values(
        ["Year", "Region", "POE", "Crossing", "Modes"]
    ).reset_index(drop=True)
    yearly.to_csv(OUT_CSV_YEARLY, index=False, encoding="utf-8")
    print(f"[00] Wrote {OUT_CSV_YEARLY} ({len(yearly):,} rows)")

    print(f"[00] Years:     {sorted(out['Year'].unique())}")
    print(f"[00] Crossings: {len(out['Crossing'].unique())} — {sorted(out['Crossing'].unique())}")
    print(f"[00] Modes:     {sorted(out['Modes'].unique())}")
    print(f"[00] Regions:   {sorted(out['Region'].unique())}")


if __name__ == "__main__":
    main()
