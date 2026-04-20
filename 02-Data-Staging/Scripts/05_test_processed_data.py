"""
05_test_processed_data.py
Structural invariant checks on monthly_crossings_2008_2025.csv.
Run after the pipeline to catch regressions before they reach the webapp.

Exit code 0 if all checks pass, 1 otherwise.

Usage:
    python 02-Data-Staging/Scripts/05_test_processed_data.py
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
MONTHLY_CSV = ROOT / "03-Processed-Data" / "csv" / "monthly_crossings_2008_2025.csv"
MONTHLY_JSON = ROOT / "03-Processed-Data" / "json" / "monthly_crossings_2008_2025.json"
YEARLY_CSV = ROOT / "03-Processed-Data" / "csv" / "yearly_crossings_2008_2025.csv"
YEARLY_JSON = ROOT / "03-Processed-Data" / "json" / "yearly_crossings_2008_2025.json"
COORDS_CSV = ROOT / "01-Raw-Data" / "TX-MX-Border-Crossings-Coordinates.csv"
LRD_XLSX = ROOT / "01-Raw-Data" / "LRD-RVG-2025.xlsx"
VOCAB = ROOT / "02-Data-Staging" / "config" / "vocab.json"

# El Paso Railroad Bridges is a CBP-combined reporting entry (BNSF + UP).
# It does not appear verbatim in the coordinates CSV; the map layer splits it.
ALLOWED_NON_CSV_CROSSINGS = {"El Paso Railroad Bridges"}

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

EXPECTED_YEAR_RANGE = range(2008, 2026)
EXPECTED_MONTHS = set(range(1, 13))
EXPECTED_MODES = {
    "Commercial Trucks", "Buses", "Passenger Vehicles",
    "Pedestrians/ Bicyclists", "Railcars",
}


class TestRunner:
    def __init__(self) -> None:
        self.failures: list[str] = []
        self.passed: list[str] = []

    def check(self, name: str, ok: bool, detail: str = "") -> None:
        if ok:
            self.passed.append(name)
            print(f"  PASS  {name}")
        else:
            self.failures.append(f"{name}: {detail}" if detail else name)
            print(f"  FAIL  {name}" + (f"\n        {detail}" if detail else ""))

    def summary(self) -> int:
        total = len(self.passed) + len(self.failures)
        print()
        print(f"{len(self.passed)}/{total} checks passed")
        if self.failures:
            print("\nFailures:")
            for f in self.failures:
                print(f"  - {f}")
            return 1
        return 0


def test_files_exist(t: TestRunner) -> pd.DataFrame | None:
    print("[1] File presence")
    for p in (MONTHLY_CSV, MONTHLY_JSON, YEARLY_CSV, YEARLY_JSON, COORDS_CSV, VOCAB):
        t.check(f"{p.name} exists", p.exists(), f"missing: {p}")
    if not MONTHLY_CSV.exists():
        return None
    return pd.read_csv(MONTHLY_CSV)


def test_csv_json_parity(t: TestRunner, df: pd.DataFrame) -> None:
    print("[2] CSV / JSON parity")
    with open(MONTHLY_JSON, "r", encoding="utf-8") as fh:
        j = json.load(fh)
    t.check("monthly CSV and JSON have equal row counts",
            len(j) == len(df),
            f"csv={len(df):,} json={len(j):,}")
    yr = pd.read_csv(YEARLY_CSV)
    with open(YEARLY_JSON, "r", encoding="utf-8") as fh:
        jy = json.load(fh)
    t.check("yearly CSV and JSON have equal row counts",
            len(jy) == len(yr),
            f"csv={len(yr):,} json={len(jy):,}")


def test_schema(t: TestRunner, df: pd.DataFrame) -> None:
    print("[3] Schema")
    expected_cols = ["ID", "Year", "Month", "Region", "POE", "Crossing", "Modes", "Northbound Crossing"]
    t.check("columns match expected 8-col schema",
            list(df.columns) == expected_cols,
            f"got {list(df.columns)}")
    t.check("no null values",
            df.isna().sum().sum() == 0,
            f"{int(df.isna().sum().sum())} nulls across all cols")
    t.check("no negative crossing counts",
            (df["Northbound Crossing"] >= 0).all(),
            f"{int((df['Northbound Crossing'] < 0).sum())} negative rows")
    t.check("Northbound Crossing is integer-typed",
            pd.api.types.is_integer_dtype(df["Northbound Crossing"]),
            f"dtype={df['Northbound Crossing'].dtype}")


def test_year_month_range(t: TestRunner, df: pd.DataFrame) -> None:
    print("[4] Year and month range")
    actual_years = set(df["Year"].unique())
    expected_years = set(EXPECTED_YEAR_RANGE)
    t.check("years 2008..2025 present",
            actual_years == expected_years,
            f"missing={sorted(expected_years - actual_years)} extra={sorted(actual_years - expected_years)}")
    t.check("Month values are 1..12",
            set(df["Month"].unique()).issubset(EXPECTED_MONTHS),
            f"unexpected months: {sorted(set(df['Month'].unique()) - EXPECTED_MONTHS)}")
    # 2025 may have fewer months if data is not yet complete; just check >=1
    months_2025 = df[df["Year"] == 2025]["Month"].nunique()
    t.check("2025 has at least 1 month of data",
            months_2025 >= 1,
            f"got {months_2025} months")
    # 2008-2024 should all have 12 months
    bad_years = []
    for yr in range(2008, 2025):
        m = df[df["Year"] == yr]["Month"].nunique()
        if m != 12:
            bad_years.append(f"{yr}({m}mo)")
    t.check("years 2008–2024 each have 12 months of data",
            len(bad_years) == 0,
            f"years with wrong month count: {bad_years}")


def test_modes(t: TestRunner, df: pd.DataFrame) -> None:
    print("[5] Modes")
    actual = set(df["Modes"].unique())
    t.check("exactly the 5 canonical modes present",
            actual == EXPECTED_MODES,
            f"missing={sorted(EXPECTED_MODES - actual)} extra={sorted(actual - EXPECTED_MODES)}")


def test_vocab_conformance(t: TestRunner, df: pd.DataFrame) -> None:
    print("[6] Canonical vocabulary conformance")
    with open(VOCAB, "r", encoding="utf-8") as fh:
        vocab = json.load(fh)
    # vocab.json was built from the 2013-2024 baseline; master adds 2008-2012
    # crossings that predate the baseline — we check modes/regions strictly,
    # but crossings only need to be in the coordinates CSV (checked in [7]).
    for col, key in [("Region", "Region"), ("Modes", "Modes")]:
        allowed = set(vocab[key])
        actual = set(df[col].unique())
        stray = actual - allowed
        t.check(f"{col} values are subset of vocab.json",
                len(stray) == 0,
                f"unknown: {sorted(stray)}")


def test_csv_canonical_names(t: TestRunner, df: pd.DataFrame) -> None:
    print("[7] Coordinates CSV name alignment")
    coords = pd.read_csv(COORDS_CSV)
    csv_names = set(coords["Border Crossing Name"])
    proc_names = set(df["Crossing"].unique())
    unexpected = proc_names - csv_names - ALLOWED_NON_CSV_CROSSINGS
    t.check("every Crossing is in coordinates CSV (or allowed exception)",
            len(unexpected) == 0,
            f"names not in CSV: {sorted(unexpected)}")
    # BNSF + UP are combined as El Paso Railroad Bridges in reporting
    expected_absent = {"BNSF Railroad Rail Bridge", "Union Pacific Railroad Rail Bridge"}
    missing = csv_names - proc_names - expected_absent
    t.check("every coordinates-CSV crossing appears in master data "
            "(except BNSF/UP, combined as El Paso Railroad Bridges)",
            len(missing) == 0,
            f"missing: {sorted(missing)}")


def test_id_formula(t: TestRunner, df: pd.DataFrame) -> None:
    print("[8] ID formula")
    expected = (
        df["Year"].astype(str)
        + "-"
        + df["Month"].astype(str).str.zfill(2)
        + "-"
        + df["Crossing"].map(CROSSING_SLUG)
        + "-"
        + df["Modes"].map(MODE_ID).fillna(df["Modes"])
    )
    mismatches = (df["ID"] != expected).sum()
    t.check("ID == YYYY-MM-SLUG-ModeAbbr  e.g. 2008-01-BRID-Buses",
            mismatches == 0,
            f"{int(mismatches)} rows with incorrect ID")
    t.check("ID column is unique",
            df["ID"].is_unique,
            f"{int(df['ID'].duplicated().sum())} duplicate IDs")


def test_no_duplicate_month_rows(t: TestRunner, df: pd.DataFrame) -> None:
    print("[9] No duplicate (Year, Month, Crossing, Modes) rows")
    key = ["Year", "Month", "Crossing", "Modes"]
    dups = df.duplicated(subset=key).sum()
    t.check("no duplicate (Year, Month, Crossing, Modes) combinations",
            dups == 0,
            f"{int(dups)} duplicate rows")


def test_lrd_rvg_cross_source(t: TestRunner, df: pd.DataFrame) -> None:
    print("[10] Cross-source: 2025 LRD+RVG Commercial Trucks vs raw workbook")
    if not LRD_XLSX.exists():
        t.check("LRD-RVG workbook reachable for cross-check", False,
                f"missing: {LRD_XLSX}")
        return
    raw = pd.read_excel(LRD_XLSX, sheet_name="CY 2025", header=None)
    section_rows = []
    for i, row in raw.iterrows():
        v0, v1 = row[0], row[1]
        if isinstance(v0, str) and (pd.isna(v1) or v1 is None):
            section_rows.append((i, v0.strip()))
    truck_total = 0
    for idx, (start, name) in enumerate(section_rows):
        if name.strip().lower() != "trucks":
            continue
        end = section_rows[idx + 1][0] if idx + 1 < len(section_rows) else len(raw)
        for _, r in raw.iloc[start + 1: end].iterrows():
            if pd.isna(r[0]) or pd.isna(r[1]):
                continue
            for c in range(2, 14):
                v = r[c]
                try:
                    if pd.notna(v):
                        truck_total += int(v)
                except (TypeError, ValueError):
                    pass
    proc = int(
        df[(df["Year"] == 2025)
           & (df["Region"].isin(["Laredo", "Rio Grande Valley"]))
           & (df["Modes"] == "Commercial Trucks")]["Northbound Crossing"].sum()
    )
    t.check("2025 Laredo+RGV Commercial Trucks match raw LRD-RVG workbook sum",
            proc == truck_total,
            f"master={proc:,}  workbook={truck_total:,}  delta={proc - truck_total:+,}")


def test_yearly_consistency(t: TestRunner, monthly: pd.DataFrame) -> None:
    print("[11] Yearly file consistency")
    yearly = pd.read_csv(YEARLY_CSV)
    # Schema: 7 cols (no Month)
    expected_cols = ["ID", "Year", "Region", "POE", "Crossing", "Modes", "Northbound Crossing"]
    t.check("yearly columns match expected 7-col schema",
            list(yearly.columns) == expected_cols,
            f"got {list(yearly.columns)}")
    t.check("yearly ID column is unique",
            yearly["ID"].is_unique,
            f"{int(yearly['ID'].duplicated().sum())} duplicate IDs")
    # Annual totals must match what you'd get by summing the monthly file
    monthly_totals = (
        monthly.groupby(["Year", "Crossing", "Modes"])["Northbound Crossing"].sum()
    )
    yearly_totals = (
        yearly.groupby(["Year", "Crossing", "Modes"])["Northbound Crossing"].sum()
    )
    mismatches = (monthly_totals - yearly_totals).abs().sum()
    t.check("yearly totals match sum of monthly totals",
            mismatches == 0,
            f"total discrepancy: {mismatches:,}")


def test_2025_top10_have_all_months(t: TestRunner, df: pd.DataFrame) -> None:
    print("[12] 2025 coverage for top-10 crossings")
    y25 = df[df["Year"] == 2025]
    totals = y25.groupby("Crossing")["Northbound Crossing"].sum().sort_values(ascending=False)
    top10 = totals.head(10).index.tolist()
    missing: list[str] = []
    for crossing in top10:
        months = set(y25[y25["Crossing"] == crossing]["Month"].unique())
        if months != EXPECTED_MONTHS:
            missing.append(f"{crossing}: missing {sorted(EXPECTED_MONTHS - months)}")
    t.check("2025 top-10 crossings each have all 12 months",
            len(missing) == 0,
            "; ".join(missing))


def test_pre_opening_absence(t: TestRunner, df: pd.DataFrame) -> None:
    print("[13] Pre-opening absence")
    # (crossing, opening_year, opening_month) — strictly before this point, no rows
    opening_dates = [
        ("Anzalduas International Bridge",        2010,  1),
        ("El Paso Railroad Bridges",              2010,  1),
        ("Donna-Rio Bravo International Bridge",  2010, 12),
        ("Marcelino Serna Bridge",                2011,  1),
        ("Boquillas",                             2014,  9),
    ]
    for crossing, yr, mo in opening_dates:
        sub = df[df["Crossing"] == crossing]
        before = sub[(sub["Year"] < yr) | ((sub["Year"] == yr) & (sub["Month"] < mo))]
        t.check(f"{crossing} absent before opening date",
                len(before) == 0,
                f"{len(before)} rows before {yr}-{mo:02d}")


def test_elp_may_june_2025_differ(t: TestRunner, df: pd.DataFrame) -> None:
    print("[14] September PDF May/June 2025 El Paso POVs differ")
    sub = df[(df["Region"] == "El Paso")
             & (df["Modes"] == "Passenger Vehicles")
             & (df["Year"] == 2025)]
    may_total = sub[sub["Month"] == 5]["Northbound Crossing"].sum()
    jun_total = sub[sub["Month"] == 6]["Northbound Crossing"].sum()
    may_rows = len(sub[sub["Month"] == 5])
    jun_rows = len(sub[sub["Month"] == 6])
    if may_rows == 0 or jun_rows == 0:
        t.check("ELP 2025 May vs June POVs are not identical (PDF page duplication check)",
                False,
                f"missing month(s): May rows={may_rows}, Jun rows={jun_rows}")
        return
    t.check("ELP 2025 May vs June POVs are not identical (PDF page duplication check)",
            int(may_total) != int(jun_total),
            f"May={int(may_total):,} Jun={int(jun_total):,} — identical totals suggest "
            f"the known September-PDF duplicate-page error was not corrected")


def test_2025_railcars_only_on_rail_crossings(t: TestRunner, df: pd.DataFrame) -> None:
    print("[15] 2025 Railcars redirect integrity")
    rail_crossings = {
        "El Paso Railroad Bridges",
        "Canadian Pacific Kansas City Laredo Railroad Bridge",
        "West Rail Bridge",
        "Union Pacific Eagle Pass Railroad Bridge",
    }
    y25 = df[(df["Year"] == 2025) & (df["Modes"] == "Railcars")
             & (df["Northbound Crossing"] > 0)]
    stray = set(y25["Crossing"].unique()) - rail_crossings
    t.check("2025 non-zero Railcars appear only on the 4 rail crossings",
            len(stray) == 0,
            f"non-zero Railcars on non-rail crossing(s): {sorted(stray)}")


def main() -> int:
    t = TestRunner()
    print("=" * 60)
    print("Monthly & yearly crossings 2008-2025 — structural invariant checks")
    print("=" * 60)

    df = test_files_exist(t)
    if df is None:
        return t.summary()
    test_csv_json_parity(t, df)
    test_schema(t, df)
    test_year_month_range(t, df)
    test_modes(t, df)
    test_vocab_conformance(t, df)
    test_csv_canonical_names(t, df)
    test_id_formula(t, df)
    test_no_duplicate_month_rows(t, df)
    test_lrd_rvg_cross_source(t, df)
    test_yearly_consistency(t, df)
    test_2025_top10_have_all_months(t, df)
    test_pre_opening_absence(t, df)
    test_elp_may_june_2025_differ(t, df)
    test_2025_railcars_only_on_rail_crossings(t, df)

    return t.summary()


if __name__ == "__main__":
    sys.exit(main())
