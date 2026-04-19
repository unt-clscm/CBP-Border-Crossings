# Validation report — Monthly & Yearly Crossings 2008–2025

- Monthly source: `monthly_crossings_2008_2025.csv` (34,090 rows)
- Yearly source:  `yearly_crossings_2008_2025.csv` (2,850 rows)
- Years: [np.int64(2008), np.int64(2009), np.int64(2010), np.int64(2011), np.int64(2012), np.int64(2013), np.int64(2014), np.int64(2015), np.int64(2016), np.int64(2017), np.int64(2018), np.int64(2019), np.int64(2020), np.int64(2021), np.int64(2022), np.int64(2023), np.int64(2024), np.int64(2025)]
- Crossings: 33
- Modes: ['Buses', 'Commercial Trucks', 'Passenger Vehicles', 'Pedestrians/ Bicyclists', 'Railcars']

- Duplicate IDs: 0  OK
- Null values: 0  OK
- Negative crossing counts: 0  OK

## Row counts by Year

| Year | Rows | Crossings | Months covered |
|---|---|---|---|
| 2008 | 1,665 | 28 | 12 |
| 2009 | 1,680 | 28 | 12 |
| 2010 | 1,805 | 31 | 12 |
| 2011 | 1,920 | 32 | 12 |
| 2012 | 1,920 | 32 | 12 |
| 2013 | 1,920 | 32 | 12 |
| 2014 | 1,940 | 33 | 12 |
| 2015 | 1,980 | 33 | 12 |
| 2016 | 1,980 | 33 | 12 |
| 2017 | 1,980 | 33 | 12 |
| 2018 | 1,980 | 33 | 12 |
| 2019 | 1,980 | 33 | 12 |
| 2020 | 1,980 | 33 | 12 |
| 2021 | 1,980 | 33 | 12 |
| 2022 | 1,980 | 33 | 12 |
| 2023 | 1,980 | 33 | 12 |
| 2024 | 1,980 | 33 | 12 |
| 2025 | 1,440 | 33 | 12 |

## Gap analysis — 2024-active (POE, Crossing, Mode) combos missing in 2025

All 2024-active combinations have a 2025 row.

## YoY outliers (|delta| >= 50% on a >=1000-count annual base, 2024 vs 2025)

6 outlier combinations (soft check — not a failure):

| Region | POE | Crossing | Modes | 2024 | 2025 | delta_pct |
|---|---|---|---|---:|---:|---:|
| Pharr | Rio Grande City | Los Ebanos Ferry | Passenger Vehicles | 28,398 | 43,732 | 54.0% |
| El Paso | Presidio | Presidio-Ojinaga International Bridge | Buses | 1,471 | 2,296 | 56.1% |
| Pharr | Rio Grande City | Los Ebanos Ferry | Pedestrians/ Bicyclists | 21,228 | 36,051 | 69.8% |
| Pharr | Rio Grande City | Starr-Camargo Bridge | Pedestrians/ Bicyclists | 27,385 | 48,632 | 77.6% |
| El Paso | Marcelino Serna | Marcelino Serna Bridge | Commercial Trucks | 20,795 | 37,337 | 79.5% |
| Pharr | Progreso | Donna-Rio Bravo International Bridge | Pedestrians/ Bicyclists | 2,315 | 10,112 | 336.8% |

## 2025 coverage summary (non-zero values)

- Crossings with any non-zero 2025 value: 33
- POEs with any non-zero 2025 value:      12
- Non-zero (Crossing, Mode, Month) rows:  903

## See also
- [`unmapped_2025.md`](./unmapped_2025.md)
- [`elp_pdf_notes.md`](./elp_pdf_notes.md)
