
[Uploading README.md…]()
b8faf31a19d7fd134a82b9c7820755f7e773b2c1
# Urban Renewal Financial Calculator

A zero-dependency, pure JavaScript financial calculation engine for urban renewal (self-renovation) projects. Covers property exchange, surplus sales, commercial rental, and underground parking — with NPV, IRR, sensitivity analysis, and input validation.

**English** | [中文文档](./财务测算说明.md)

## Features

- **Full-cycle financial modeling** — demolition, construction, land fees, sales, rental, parking
- **NPV (Net Present Value)** — discount-rate based, configurable growth rate
- **IRR (Internal Rate of Return)** — Newton's method with bisection fallback
- **Sensitivity Analysis** — 5 variables × 5 perturbation levels matrix
- **Input Validation** — area/ratio/range constraints with detailed error messages
- **Cash Flow Table** — year-by-year breakdown (construction + operation phases)
- **Break-even Analysis** — sales price & occupancy rate dual dimension
- **Dual Export** — Node.js (`module.exports`) + Browser (`window.*`)
- **Zero Dependencies** — only native `Math` and ES6+ Array methods

## Installation

### 1. 作为 Node.js 模块使用

```bash
npm install urban-renewal-financial-calculator
```

Or copy the single file:

```bash
cp src/financial-calculator.js your-project/lib/
```

### 2. 作为独立 API 服务使用（推荐用于多项目共享）

```bash
cd urban-renewal-financial-calculator
node api-server.js        # 默认端口 3000
PORT=3001 node api-server.js  # 自定义端口
```

服务启动后，其他项目可以通过 HTTP 调用：

```javascript
// 任何项目（JS/Python/Java 等）都可以调用
const response = await fetch('http://localhost:3000/api/calculate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    originalArea: 56882,
    aboveGroundNew: 115312,
    undergroundNew: 60000,
    salesPrice: 15000,
  }),
});
const result = await response.json();
console.log(result.data.metrics.netProfit);  // 净收益
console.log(result.data.metrics.roi);         // ROI
```

API 服务特性：
- ✅ 零依赖（纯 Node.js 原生模块）
- ✅ CORS 跨域支持
- ✅ 提供交互式测试页面（`http://localhost:3000/test.html`）
- ✅ 内置 API 文档（`http://localhost:3000/`）
- ✅ 支持预设参数快速调用（大方案/中方案/默认）

### 3. 浏览器直接使用

```html
<script src="financial-calculator.js"></script>
<!-- All functions available as window.* globals -->
```

## Quick Start

```javascript
const { calculateFinancialPlan, generateFinancialReport } = require('urban-renewal-financial-calculator');

// Minimal parameters (defaults fill the rest)
const params = {
  originalArea: 56882,        // Original property area (m²)
  aboveGroundNew: 115312,     // New above-ground area (m²)
  undergroundNew: 60000,      // New underground area (m²)
  salesPrice: 15000,          // Surplus sales price (yuan/m²)
  rentPerDay: 2.5,            // Daily rent (yuan/m²/day)
};

// Full calculation result
const result = calculateFinancialPlan(params);
console.log(result.metrics.netProfit);    // Net profit (万元)
console.log(result.metrics.roi);          // ROI (%)
console.log(result.feasibility);          // '可行' | '基本可行' | '不可行'

// Text report
const report = generateFinancialReport(params);
console.log(report);
```

## API Reference

| Function | Description | Returns |
|----------|-------------|---------|
| `calculateFinancialPlan(params)` | Full financial calculation | Object with `area`, `income`, `cost`, `metrics`, `feasibility` |
| `generateFinancialReport(params)` | Formatted text report | String |
| `validateFinancialParams(params)` | Input validation | `{ valid: boolean, errors: string[] }` |
| `calculateIRR(params, precision?, maxIter?)` | Internal rate of return | Number (%, null if no solution) |
| `calculateCashFlow(params)` | Year-by-year cash flow table | Array of Objects |
| `sensitivityAnalysis(params, options?)` | Sensitivity matrix | `{ baseResult, matrix }` |

### Class Usage

```javascript
const { UrbanRenewalCalculator } = require('urban-renewal-financial-calculator');

const calc = new UrbanRenewalCalculator(params);
const result = calc.calculate();       // Core calculation
const cashflow = calc.calculateCashFlow();
const irr = calc.calculateIRR();
const sensitivity = calc.sensitivityAnalysis({
  variables: ['salesPrice', 'rentPerDay', 'occupancyRate'],
  perturbations: [-0.20, -0.10, 0, 0.10, 0.20]
});
```

## Parameters

50+ parameters with sensible defaults. Key categories:

| Category | Key Params | Default |
|----------|------------|---------|
| Demolition | `originalArea`, `exchangeRatio` | 56882 m², 1.2 |
| Construction | `aboveGroundNew`, `undergroundNew`, unit prices | 115312/60000 m² |
| Sales | `salesPrice`, `aboveGroundSalesArea` | 15000 yuan/m² |
| Rental | `rentPerDay`, `rentYears`, `occupancyRate`, `rentGrowthRate` | 2.5, 18, 0.9, 0.03 |
| Parking | `parkingSpaces`, `parkingRent` | null (auto), 10 |
| Finance | `financeCostMode`, `discountRate` | 'fixed', 0.08 |
| Thresholds | `minimumROI`, `maxPaybackYears` | 0.08, 15 |

> **Note**: Defaults are from a specific project (Urumqi Railway Bureau). Always override with your own project data.

Full parameter table: see [中文文档](./财务测算说明.md)

## Running Tests

```bash
node tests/financial-calculator.test.js
# Expected: 63 tests, all passing
```

No test framework required — the test file uses a simple hand-written `test()` function.

## Policy Notes

- **`enableLandFeeDeduction`**: Land fee deduction via construction cost offset is a **city-specific policy** (not universal). Default is `false`.
- **`exchangeRatio`**: 1:1.2 is common in many Chinese cities but varies by locality.
- **NPV model**: Simplified — assumes total investment at Year 0, sales revenue at end of construction, rental income starting Year buildYears+1.
- **Rent growth**: Compound annual growth model `(1 + rate)^year`.

## License

MIT — see [LICENSE](./LICENSE) file.

## Version

**2.0.0** — Added NPV/IRR, sensitivity analysis, input validation, dynamic finance cost, cash flow table.
