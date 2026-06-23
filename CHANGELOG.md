# Changelog

All notable changes to the Urban Renewal Financial Calculator module.

## [2.0.0] - 2026-06-23

### Added
- **NPV (Net Present Value)** calculation with configurable discount rate (default 8%)
- **IRR (Internal Rate of Return)** — Newton's iteration + bisection fallback algorithm
- **Sensitivity Analysis** — 5 variables × 5 perturbation levels (±10%, ±20%)
- **Input Validation** (`validateParams`) — area/ratio/range/logic constraints with detailed errors
- **Year-by-year Cash Flow Table** (`calculateCashFlow`) — construction + operation phases
- **Dynamic Finance Cost Mode** — `financeCostMode: 'dynamic'` auto-calculates from investment × rate × years
- **Multi-condition Feasibility Check** — profit > 0, ROI ≥ threshold, payback ≤ limit, NPV > 0
- **6 Convenience Functions** — `calculateFinancialPlan`, `generateFinancialReport`, `validateFinancialParams`, `calculateIRR`, `calculateCashFlow`, `sensitivityAnalysis`
- **Dual Environment Export** — Node.js (`module.exports`) + Browser (`window.*`)
- **63 Unit Tests** — all passing, zero framework dependency
- **English README.md** + MIT LICENSE

### Changed
- `enableLandFeeDeduction` default changed from `true` to `false` (not a universal policy)
- `financeCost` default changed from `6162` to `0` (recommend using `dynamic` mode)
- `parkingAreaPerSpace = 0` now guarded against division-by-zero in auto parking calculation
- `calculateBreakEvenOccupancy` now receives pre-calculated values instead of recalculating (eliminates redundancy)
- Dynamic finance cost calculation cleaned up — removed 3 redundant intermediate assignments

### Removed
- Project-specific presets (大方案/中方案) from `AppConfig.FINANCE_PRESETS`
- Preset load buttons from UI (`btn-load-da`, `btn-load-zhong`)
- `loadFinancePreset` function and `FINANCE_PRESETS` variable from app.js

## [1.0.0] - 2026-06-22

### Added
- Basic financial calculation: area, income (sales + rental + parking), cost, net profit
- ROI, payback period, break-even analysis
- Two cost modes: `full` (professional) and `report` (simplified)
- Rental growth model with compound rate
- Property exchange ratio with auto-distribution
- Text report generation
