"""
04_merge_and_validate.py
Read the final master CSV (monthly_crossings_2008_2025.csv), emit JSON, and
write a validation report. The merge/ingestion work is done upstream in
00_load_master.py (and the 2025 ingest scripts it calls).

Run from the project root:
    python 02-Data-Staging/Scripts/04_merge_and_validate.py
"""
from __future__ import annotations
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
MONTHLY_CSV = ROOT / "03-Processed-Data" / "csv" / "monthly_crossings_2008_2025.csv"
YEARLY_CSV = ROOT / "03-Processed-Data" / "csv" / "yearly_crossings_2008_2025.csv"
OUT_JSON = ROOT / "03-Processed-Data" / "json"
DOCS = ROOT / "02-Data-Staging" / "docs"
OUT_JSON.mkdir(parents=True, exist_ok=True)
DOCS.mkdir(parents=True, exist_ok=True)

MODE_ID = {
    "Commercial Trucks":      "Trucks",
    "Buses":                  "Buses",
    "Pedestrians/ Bicyclists":"Pedestrians",
    "Passenger Vehicles":     "POVs",
    "Railcars":               "Railcars",
}


def main() -> None:
    print(f"[04] Reading {MONTHLY_CSV}")
    df = pd.read_csv(MONTHLY_CSV)
    print(f"[04] {len(df):,} rows  years {sorted(df['Year'].unique())}")

    # --- JSON exports ---
    out_json = OUT_JSON / "monthly_crossings_2008_2025.json"
    df.to_json(out_json, orient="records", indent=2, force_ascii=False)
    print(f"[04] Wrote {out_json}")

    yearly = pd.read_csv(YEARLY_CSV)
    out_json_yearly = OUT_JSON / "yearly_crossings_2008_2025.json"
    yearly.to_json(out_json_yearly, orient="records", indent=2, force_ascii=False)
    print(f"[04] Wrote {out_json_yearly}")

    # --- Validation report ---
    report: list[str] = []
    report.append("# Validation report — Monthly & Yearly Crossings 2008–2025\n")
    report.append(f"- Monthly source: `{MONTHLY_CSV.name}` ({len(df):,} rows)")
    report.append(f"- Yearly source:  `{YEARLY_CSV.name}` ({len(yearly):,} rows)")
    report.append(f"- Years: {sorted(df['Year'].unique())}")
    report.append(f"- Crossings: {df['Crossing'].nunique()}")
    report.append(f"- Modes: {sorted(df['Modes'].unique())}")
    report.append("")

    # Duplicate IDs
    dup = df["ID"].duplicated().sum()
    report.append(f"- Duplicate IDs: {dup}  {'OK' if dup == 0 else 'FAIL'}")

    # Null check
    nulls = int(df.isna().sum().sum())
    report.append(f"- Null values: {nulls}  {'OK' if nulls == 0 else 'FAIL'}")

    # Negative counts
    neg = int((df["Northbound Crossing"] < 0).sum())
    report.append(f"- Negative crossing counts: {neg}  {'OK' if neg == 0 else 'FAIL'}")
    report.append("")

    # Row counts by year
    report.append("## Row counts by Year")
    report.append("")
    report.append("| Year | Rows | Crossings | Months covered |")
    report.append("|---|---|---|---|")
    for yr, grp in df.groupby("Year"):
        n_cross = grp["Crossing"].nunique()
        n_months = grp["Month"].nunique()
        report.append(f"| {yr} | {len(grp):,} | {n_cross} | {n_months} |")
    report.append("")

    # Gap analysis: combos active in 2024 missing in 2025
    b24 = df[(df["Year"] == 2024) & (df["Northbound Crossing"] > 0)][
        ["Region", "POE", "Crossing", "Modes"]
    ].drop_duplicates()
    y25 = df[df["Year"] == 2025][["Region", "POE", "Crossing", "Modes"]].drop_duplicates()
    gap = b24.merge(y25, how="left", indicator=True)
    gap = gap[gap["_merge"] == "left_only"].drop(columns=["_merge"])

    report.append("## Gap analysis — 2024-active (POE, Crossing, Mode) combos missing in 2025")
    report.append("")
    if len(gap) == 0:
        report.append("All 2024-active combinations have a 2025 row.\n")
    else:
        report.append(f"{len(gap)} missing combinations:\n")
        report.append("| Region | POE | Crossing | Modes |")
        report.append("|---|---|---|---|")
        for _, r in gap.iterrows():
            report.append(f"| {r['Region']} | {r['POE']} | {r['Crossing']} | {r['Modes']} |")
        report.append("")

    # YoY outlier analysis (annual totals 2025 vs 2024)
    annual = df.groupby(["Year", "Region", "POE", "Crossing", "Modes"])["Northbound Crossing"].sum().reset_index()
    b24v = annual[annual["Year"] == 2024].rename(columns={"Northbound Crossing": "v2024"}).drop(columns="Year")
    y25v = annual[annual["Year"] == 2025].rename(columns={"Northbound Crossing": "v2025"}).drop(columns="Year")
    cmp = b24v.merge(y25v, on=["Region", "POE", "Crossing", "Modes"], how="outer")
    cmp["v2024"] = cmp["v2024"].fillna(0)
    cmp["v2025"] = cmp["v2025"].fillna(0)
    cmp["delta_pct"] = (
        (cmp["v2025"] - cmp["v2024"]) / cmp["v2024"].replace(0, pd.NA) * 100
    )
    big = cmp[
        ((cmp["v2024"] >= 1000) | (cmp["v2025"] >= 1000))
        & (cmp["delta_pct"].abs() >= 50)
    ].sort_values("delta_pct")

    report.append("## YoY outliers (|delta| >= 50% on a >=1000-count annual base, 2024 vs 2025)")
    report.append("")
    if len(big) == 0:
        report.append("None.\n")
    else:
        report.append(f"{len(big)} outlier combinations (soft check — not a failure):\n")
        report.append("| Region | POE | Crossing | Modes | 2024 | 2025 | delta_pct |")
        report.append("|---|---|---|---|---:|---:|---:|")
        for _, r in big.iterrows():
            report.append(
                f"| {r['Region']} | {r['POE']} | {r['Crossing']} | {r['Modes']} | "
                f"{int(r['v2024']):,} | {int(r['v2025']):,} | {r['delta_pct']:.1f}% |"
            )
        report.append("")

    # 2025 coverage summary
    nz25 = df[(df["Year"] == 2025) & (df["Northbound Crossing"] > 0)]
    report.append("## 2025 coverage summary (non-zero values)")
    report.append("")
    report.append(f"- Crossings with any non-zero 2025 value: {nz25['Crossing'].nunique()}")
    report.append(f"- POEs with any non-zero 2025 value:      {nz25['POE'].nunique()}")
    report.append(f"- Non-zero (Crossing, Mode, Month) rows:  {len(nz25)}")
    report.append("")

    # Cross-reference unmapped log
    um = DOCS / "unmapped_2025.md"
    if um.exists():
        report.append("## See also")
        report.append("- [`unmapped_2025.md`](./unmapped_2025.md)")
        report.append("- [`elp_pdf_notes.md`](./elp_pdf_notes.md)")
        report.append("")

    out_report = DOCS / "validation_report.md"
    out_report.write_text("\n".join(report), encoding="utf-8")
    print(f"[04] Wrote {out_report}")

    if dup or nulls or neg:
        raise SystemExit("[04] Validation FAILED — see report above")
    print("[04] All hard checks passed.")


if __name__ == "__main__":
    main()
