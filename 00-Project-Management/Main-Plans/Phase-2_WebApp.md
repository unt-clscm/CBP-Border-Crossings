# Phase 2 — WebApp

Clone the [BTS-TransBorder WebApp](../../../BTS-TransBorder/WebApp/) scaffold, keep the same tech stack and component architecture, and swap in CBP northbound-crossings data. The CBP app is narrower in scope than BTS (one dataset, one domain, no commodity/HS-code dimension), so most of the work is *deletion* — remove unused charts, pages, tabs, and filters — rather than new construction.

## Build status (2026-04-19)

**Overall: shell + all 4 routes built, data wired, map wired, unit tests in place. Remaining: `check:all` script, Playwright e2e layer, post-build review loop.**

| Area | Status | Notes |
|---|---|---|
| Bootstrap (clone, rename, strip) | ✓ Done | All BTS-specific pages/components/libs removed per §Deletions. |
| Data contract (3 JSONs in `public/data/`) | ✓ Done | All three files present. |
| Zustand store | ✓ Done | Shape extended beyond plan — see §Store. |
| Routes & pages (5 routes inc. `/about`) | ✓ Done | `Overview`, `ByCrossing`, `ByMode`, `ByRegion`, `About`, `NotFound` all present. |
| Map layer (`CrossingsMap`, `useCrossingsMapData`) | ✓ Done | Two-pin rule implemented via `isRail` flag. |
| Filters | ✓ Done | Plus an added `FilterBar` wrapper — see §Filters. |
| Charts | ✓ Done | `HeatmapTable` not included (plan marked it optional). |
| Unit tests (Vitest) | Partial | 3 test files: store, map data hook, cbp helpers. |
| E2E tests (Playwright) | Not started | Playwright is in `devDependencies` but no specs/`tests/` dir yet. |
| `check:all` script | Not started | Only `dev`, `build`, `preview`, `test`, `test:watch`, `lint` exist. |
| Post-build review loop | Not started | See §Development workflow. |
| Acceptance checklist | Partial | See checklist at bottom. |

## Stack (copied as-is from BTS)

- **Build:** Vite 7 + React 19 (plain JSX, no TypeScript)
- **Routing:** React Router DOM 7 (HashRouter — no server routing)
- **State:** Zustand 5
- **Styling:** Tailwind CSS 4 + CSS custom properties in `styles/globals.css`
- **Charts:** D3 7 (custom SVG chart primitives, no Recharts)
- **Maps:** Leaflet 1.9 + React-Leaflet 5 (already in BTS — no new library needed)
- **Icons:** Lucide React
- **Testing:** Vitest (unit) + Playwright (e2e/visual) — optional for initial build

Scripts (`npm run ...`): `dev`, `build`, `preview`, `test`, `test:watch`, `lint`. (`check:all` planned but not yet added.)

## Source reference

Every path below marked *BTS-path* refers to `BTS-TransBorder/WebApp/` in the sibling repo:
`D:/UNT/UNT System/TxDOT IAC 2025-26 - General/Task 1 - Bridges and Border Crossings Guide/Task 1.3 - Texas-Mexico Border Database/BTS-TransBorder/WebApp/`.

## Bootstrap procedure ✓ Done

1. **Copy** `BTS-TransBorder/WebApp/` → `CBP-Border-Corssings/WebApp/`.
2. **Rename** project in `package.json` (`name`, description). Keep versions.
3. **Strip BTS-specific content** (see §Pages & §Deletions).
4. **Add CBP data contract** to `public/data/` (see §Data).
5. **Rewrite the Zustand store** for the CBP dataset (one store, one dataset; see §Store).
6. **Keep** all chart primitives, filter primitives, layout, map, UI, and lib utilities intact — they are dataset-agnostic.
7. `npm install && npm run dev` — should render the shell; wire pages one at a time.

## Development workflow (status: build done; review loop not yet run)

### Sub-agent usage
Use sub-agents liberally wherever they help — parallel research across the codebase, independent reviews, focused debugging, scoped implementation of a single page or component. The main agent should delegate whenever a task is well-scoped and can be handed off with a self-contained brief, rather than doing everything serially in the main context.

### Red/Green TDD
Every feature — page, chart, store selector, filter, data transform — follows red/green TDD:
1. **Red:** write a failing test first (Vitest unit test for logic/selectors, Playwright e2e test for page behavior, visual snapshot for chart output).
2. **Green:** write the minimum implementation to make the test pass.
3. **Refactor:** clean up once green, tests still passing.

No code lands without a test that fails before the implementation exists. Keep tests small and behavior-focused; do not test framework internals.

### Post-build review loop
Once the whole app is built end-to-end, run an iterative review-and-fix loop using independent sub-agents:

1. **Spawn Reviewer A** (fresh sub-agent, no prior build context) → reviews the entire WebApp against this plan, the acceptance checklist, and general React/UX quality. Returns a prioritized issue list.
2. **Spawn Fixer** (separate sub-agent) → receives the issue list and fixes each item, writing tests first (red/green) for any behavioral change.
3. **Spawn Reviewer B** (another fresh sub-agent, unaware of Reviewer A's findings) → reviews again, both the original app *and* the fixes, and returns a new issue list.
4. **Repeat** fixer → reviewer → fixer → reviewer until a reviewer pass returns an empty (or trivial-only) issue list.

Each reviewer must be independent: a fresh sub-agent with only the plan + current code, not the previous reviewer's notes. This prevents reviewers from anchoring on earlier feedback and catches regressions the fixer introduced.

## Data contract ✓ Done

Three JSON files shipped to `WebApp/public/data/` (all small, no lazy loading needed):

### 1. `monthly_crossings_2008_2025.json`
- **Source:** `03-Processed-Data/json/monthly_crossings_2008_2025.json` (copy verbatim).
- **Shape:** 34,090 rows × 8 cols (`ID`, `Year`, `Month`, `Region`, `POE`, `Crossing`, `Modes`, `Northbound Crossing`). Monthly grain, 2008–2025.
- **Used by:** pages that need month-level detail (ByCrossing time series, ByMode stacked series, any seasonal view).

### 2. `yearly_crossings_2008_2025.json`
- **Source:** `03-Processed-Data/json/yearly_crossings_2008_2025.json` (copy verbatim).
- **Shape:** 2,850 rows × 7 cols (`ID`, `Year`, `Region`, `POE`, `Crossing`, `Modes`, `Northbound Crossing`). Yearly grain, 2008–2025.
- **Used by:** Overview headline numbers and any page showing annual totals (cheaper than re-summing the monthly file).

### 3. `crossings_coordinates.json`
- **Source:** converted from `01-Raw-Data/TX-MX-Border-Crossings-Coordinates.csv` (34 rows).
- **Shape per record:**
  ```json
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
  ```
- **`data_crossing_name` join key:** equals `crossing_name` for 32 of 34 records. For the two El Paso rail bridges (BNSF, Union Pacific) both carry `data_crossing_name = "El Paso Railroad Bridges"` so they join to the single combined CBP row.
- **Conversion script:** add `02-Data-Staging/Scripts/06_emit_coords_json.py` (small, one-off) to generate this file — keeps the coordinates CSV as the single source of truth.
- **Used by:** every map instance + crossing detail pages.

See `Phase-1_Data-Processing.md` for why `El Paso Railroad Bridges` is a single row in the data but two pins on the map (CBP reports the combined total; the split isn't available).

## Pages (4 routes) ✓ Done

Far fewer than BTS. Keep the `DashboardLayout` shell (sidebar filters + main content) from BTS-path `src/components/layout/DashboardLayout.jsx`.

| Route | Page | Purpose |
|---|---|---|
| `/` | Overview | Headline numbers for the latest year (total NB crossings, YoY Δ, mode mix donut, top-5 crossings bar), + full-border map with all 34 pins sized by total NB volume. |
| `/by-crossing` | ByCrossing | Filterable table of Year × Crossing × Mode. Sidebar filters: Year range, Mode(s), Region(s), Crossing(s). Locator map pinned to selected crossing(s). Time-series line chart of selected crossing × mode. |
| `/by-mode` | ByMode | Stacked area/bar of the 5 modes through 2013–2025 for all TX, with region and crossing filters. |
| `/by-region` | ByRegion | Regional comparison (El Paso / Laredo / Rio Grande Valley field offices): per-region stacked bars + regional map view. |
| `/about` | About | High-level overview only. Source: data received directly from CBP, collected for the purpose of building this dashboard. Describe the data structure (monthly + yearly grain, crossings, modes, year coverage), what fields are available, and a brief summary of how it is processed into the final outputs. No methodology deep-dive, no caveats section. |

**Remove** from the cloned app: `/us-mexico`, `/texas-mexico` (all 7 tabs), `/trade-by-state`, `/embed/:pageId/:chartId` route, `EmbedModal`, `EmbedPage`, `chartRegistry`, `WeightCaveatBanner`, `HeroStardust`.

Keep the router setup (`HashRouter`, `MainNav`, `PageWrapper`, `PageTransition`, `NotFound`) — just trim the route list.

## Map layer ✓ Done

BTS already has Leaflet wired up. **Reuse, don't rebuild.**

- **Reuse:** `src/components/maps/PortMap.jsx` as the template for `src/components/maps/CrossingsMap.jsx`. PortMap already does exactly what we need: CircleMarker pins from a coordinate JSON, sized by a scalar value, grouped/colored by a categorical field, with portal-based tooltips.
- **Reuse:** `src/components/maps/mapHelpers.jsx` (ScrollWheelGuard, MapResizeHandler, ResetZoomButton, TooltipSync) — no changes.
- **Reuse:** `src/styles/leaflet-overrides.css` — no changes.
- **Reuse:** `src/hooks/usePortMapData.js` as the template for `src/hooks/useCrossingsMapData.js`. Replace `buildMapPorts()` with `buildMapCrossings()` that returns one marker per coordinate-CSV row (34 markers), each carrying the joined data row from `yearly_crossings_2008_2025.json` via `data_crossing_name`.

### Two-pin rule for El Paso Railroad Bridges
The coordinates CSV has two rail-bridge rows (BNSF + Union Pacific) but CBP data has one combined row. `buildMapCrossings()` handles this implicitly because both coordinate records carry `data_crossing_name = "El Paso Railroad Bridges"` — both pins pull the same data. Pin popup must:
- Title: the individual bridge name (`crossing_name`, e.g., "BNSF Railroad Rail Bridge").
- Values: the combined total (from the joined data row).
- Footnote: *"CBP reports northbound railcars for BNSF and Union Pacific as a single combined total; this figure is the combined count for both bridges."*
- Click-through: both pins navigate to `/by-crossing?crossing=El+Paso+Railroad+Bridges`.

### Map defaults
- **Base tiles:** OpenStreetMap (BTS default — no Mapbox token needed).
- **Initial view:** centered on the Texas–Mexico border, zoom fit to bounds of all 34 coordinates (`L.latLngBounds(coords).pad(0.1)`).
- **Pin color:** by `region` (El Paso / Laredo / Rio Grande Valley) using three of the BTS brand palette colors (`--chart-color-1/2/3`).
- **Pin size:** `4 + 16 * sqrt(value/maxValue)` — same formula as PortMap.
- **Scroll guard:** keep ScrollWheelGuard on all pages so the map doesn't hijack page scroll.

## Zustand store ✓ Done (shape extended)

Replace BTS-path `src/stores/transborderStore.js` with `src/stores/crossingsStore.js`. CBP is simpler — one dataset, loaded once, no lazy dataset switching.

Actual shape (superset of original plan — extra indexes so pages can pick monthly or yearly grain without re-grouping; `monthlyStatus` tracks the background load separately from the app-ready state):
```js
{
  status: "idle" | "loading" | "ready" | "error",
  error: null | string,
  monthlyStatus: "idle" | "loading" | "ready" | "error",  // tracked separately
  monthlyError: null | string,
  monthly: [],           // monthly_crossings_2008_2025.json (~7.8 MB; lazy-populated)
  yearly: [],            // yearly_crossings_2008_2025.json  ( 2,850 rows × 7 cols)
  coords: [],            // crossings_coordinates.json
  byCrossing: {},        // alias → byCrossingYearly
  byCrossingMonthly: {},
  byCrossingYearly: {},
  byRegion: {},          // alias → byRegionYearly
  byRegionMonthly: {},
  byRegionYearly: {},
  yearsAvailable: [],
  minYear: 2008,
  maxYear: 2025,
  init: () => {},
}
```

**Load strategy:** `init()` fires yearly, coords, and monthly in parallel but only blocks `status: 'ready'` on yearly + coords. If monthly fails, `monthlyStatus: 'error'` is set and the app keeps working. Currently no shipped page consumes monthly, but the wiring is retained for future seasonal views.

Keep the BTS 30-second timeout / AbortSignal pattern. Call `init()` in `main.jsx`. Unit-tested in `src/stores/crossingsStore.test.js`.

## Filters (sidebar) ✓ Done

Clone BTS-path `src/components/filters/` verbatim. CBP uses a subset:
- **Keep:** `FilterSidebar`, `FilterSelect`, `FilterMultiSelect`, `YearRangeFilter`, `ActiveFilterTags`, `SelectChevron`.
- **Drop:** `MetricToggle` (no Value/Weight switch — we only have count), `TopNSelector` (charts can hardcode Top-5 where needed).
- **Added (not in original plan):** `FilterBar.jsx` (mobile/tablet alternative to the sidebar, rendered below `lg` by `DashboardLayout`) and `PageDataDownloadButton.jsx` (a single direct-download button shared by both `FilterSidebar` and `FilterBar`).

**Page download API:** pages pass a flat `pageDownload = { data, filename, columns }` to `DashboardLayout`. This replaced an earlier `{ market, segment }` shape copied from BTS — the two slots were always the same dataset here, so they collapse to one.

Filter dimensions per page:

| Filter | Overview | ByCrossing | ByMode | ByRegion |
|---|:-:|:-:|:-:|:-:|
| Year range (2013–2025) | — | ✓ | ✓ | ✓ |
| Mode (multi) | — | ✓ | — | ✓ |
| Region (multi) | — | ✓ | ✓ | — |
| Crossing (multi) | — | ✓ | ✓ | — |

Overview is fixed to latest year, no filters.

## Charts to use ✓ Done

From BTS-path `src/components/charts/`, reuse:
- **LineChart** — time series of any crossing × mode (ByCrossing page).
- **StackedBarChart** — modes through time (ByMode, ByRegion pages).
- **BarChart** — top-5 crossings (Overview).
- **DonutChart** — mode mix (Overview).
- ~~**HeatmapTable**~~ — was marked optional in the plan; not included in the shipped app.

**Dropped (confirmed absent from `src/components/charts/`):** SankeyDiagram, BarChartRace, DivergingBarChart, ScatterPlot, BoxPlotChart, LollipopChart, TreemapChart.

## Design tokens

Use BTS-path `src/styles/globals.css` as-is. The brand color palette (TxDOT blue/red/green/orange/purple/yellow + 9-color chart palette) and the `IBM Plex Sans` / `IBM Plex Mono` fonts are shared across the Task 1 deliverables — matching BTS keeps the two dashboards visually consistent since they live side-by-side.

## Export / interaction

- **CSV export** per chart — reuse BTS-path `src/lib/downloadCsv.js` + `downloadColumns.js`. Define column configs for the monthly file (8 cols) and yearly file (7 cols).
- **PNG export** per chart — reuse BTS-path `src/lib/exportPng.js`, no changes.
- **Fullscreen** per chart — reuse BTS-path `src/components/ui/ChartCard.jsx` + `FullscreenChart.jsx`, no changes.
- **URL state** — keep the hash router. Support `?year=`, `?mode=`, `?crossing=`, `?region=` query params on ByCrossing/ByMode/ByRegion so views are link-shareable.

## Deletions checklist (after cloning BTS) ✓ Done

All items below verified absent from the current tree.

Delete outright:
- `src/pages/USMexico/`, `src/pages/TexasMexico/`, `src/pages/TradeByState/`, `src/pages/EmbedPage.jsx`.
- `src/components/ui/EmbedModal.jsx`, `WeightCaveatBanner.jsx`, `HeroStardust.jsx`.
- `src/lib/chartRegistry.js`, `insightEngine.js`, `transborderHelpers.js`, `portUtils.js`.
- `src/hooks/useTexasOverlay.js`.
- `src/components/maps/ChoroplethMap.jsx`, `ChoroplethPortMap.jsx`, `StateMap.jsx`, `TradeFlowChoropleth.jsx`, `InteractiveFlowMap.jsx` — not needed (CBP has no state-level choropleth or O/D flows).
- All `public/data/*.json` from BTS.
- BTS glossary + methodology copy in About.

Keep: everything in `src/components/charts/`, `src/components/filters/`, `src/components/layout/`, `src/components/ui/` (except the three above), `src/lib/chartColors.js`, `downloadCsv.js`, `downloadColumns.js`, `exportPng.js`, `tokens.js`, `annotations.js`, `src/styles/`.

## Out of scope (Phase 2)

- No SQLite or backend — static JSON shipped with the app.
- No cross-dataset join with BTS freight dollars (the two apps stay decoupled even though they live side-by-side).
- No wait-time / real-time data — CBP publishes monthly PDFs, no live feed.
- No Spanish-language toggle (unless requested later).

## Acceptance checklist

- [ ] `npm run build` succeeds with no warnings. *(Not yet verified against current code.)*
- [ ] Every page loads in under 1 s on a cold cache (dataset is small). *(Not yet measured.)*
- [ ] Map pins render at correct lat/lon for all 34 CSV rows, including both BNSF and Union Pacific. *(Code path present via `buildMapCrossings()`; needs visual verification.)*
- [ ] BNSF and UP pins both show the combined `El Paso Railroad Bridges` total with the footnote. *(Needs verification.)*
- [ ] CSV export works on every chart. *(Needs verification.)*
- [ ] Filters reflect in URL query params and survive refresh. *(Needs verification.)*
- [ ] Lighthouse accessibility score ≥ 90 (inherited from BTS baseline). *(Not yet run.)*
- [ ] Unit tests pass (`npm test`). *(3 test files exist: store, map data hook, cbp helpers.)*
- [ ] Post-build reviewer/fixer loop run to empty issue list. *(Not yet started.)*

## Remaining work

1. Add a `check:all` script to `package.json` (lint + test + build).
2. Set up Playwright e2e layer (optional per original plan; `playwright` already in devDependencies).
3. Run through the acceptance checklist above and record results.
4. Run the post-build reviewer/fixer loop described in §Development workflow.
