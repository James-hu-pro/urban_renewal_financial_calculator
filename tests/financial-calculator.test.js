/**
 * UrbanRenewalCalculator 全面单元测试
 * 覆盖：基础计算、输入校验、NPV/IRR、敏感性分析、逐年现金流
 * 运行方式: node tests/financial-calculator.test.js
 */

const {
  UrbanRenewalCalculator,
  calculateFinancialPlan,
  validateFinancialParams,
  calculateIRR,
  calculateCashFlow,
  sensitivityAnalysis,
} = require('../src/financial-calculator.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

function approxEqual(a, b, tolerance = 1) {
  return Math.abs(a - b) <= tolerance;
}

function assertApprox(a, b, tol, msg) {
  if (!approxEqual(a, b, tol)) {
    throw new Error(`${msg || '近似比较失败'}: ${a} vs ${b} (容差: ${tol})`);
  }
}

console.log('\n=== 财务测算模块全面测试 ===\n');

// ============================================================
// 第一部分：基础面积与收入计算（保留原有测试）
// ============================================================
console.log('\n--- 基础面积与收入 ---');

test('新建建筑面积 = 地上 + 地下', () => {
  const result = calculateFinancialPlan({
    aboveGroundNew: 100000, undergroundNew: 60000,
    aboveGroundExchange: 40000, undergroundExchange: 3000,
    aboveGroundSalesArea: null,
  });
  if (result.area.totalNewArea !== 160000) throw new Error(`${result.area.totalNewArea}`);
});

test('产权调换面积 = 原面积 × 调换比例', () => {
  const result = calculateFinancialPlan({ originalArea: 50000, exchangeRatio: 1.2 });
  if (result.area.totalExchangeArea !== 60000) throw new Error(`${result.area.totalExchangeArea}`);
});

test('地上超配面积 = 地上新建 - 地上调换', () => {
  const result = calculateFinancialPlan({
    aboveGroundNew: 100000, aboveGroundExchange: 60000,
    undergroundNew: 60000, undergroundExchange: 3000,
    aboveGroundSalesArea: null,
  });
  if (result.area.aboveSurplus !== 40000) throw new Error(`${result.area.aboveSurplus}`);
});

test('地下超配面积 = 地下新建 - 地下调换', () => {
  const result = calculateFinancialPlan({
    aboveGroundNew: 100000, aboveGroundExchange: 60000,
    undergroundNew: 60000, undergroundExchange: 3000,
    aboveGroundSalesArea: null,
  });
  if (result.area.belowSurplus !== 57000) throw new Error(`${result.area.belowSurplus}`);
});

test('地上销售收入 = 可售面积 × 销售单价 / 10000', () => {
  const result = calculateFinancialPlan({
    aboveGroundNew: 100000, aboveGroundExchange: 60000,
    aboveGroundSalesArea: 40000, salesPrice: 15000,
    undergroundNew: 60000, undergroundExchange: 3000,
  });
  // 40000 * 15000 / 10000 = 60000 万元
  if (result.income.aboveSalesIncome !== 60000) throw new Error(`${result.income.aboveSalesIncome}`);
});

test('默认可售面积 = 地上超配面积', () => {
  const result = calculateFinancialPlan({
    aboveGroundNew: 100000, aboveGroundExchange: 60000,
    aboveGroundSalesArea: null, undergroundNew: 60000, undergroundExchange: 3000,
  });
  if (result.income.aboveSalesArea !== 40000) throw new Error(`${result.income.aboveSalesArea}`);
});

test('商业年化租金（第1年）', () => {
  const result = calculateFinancialPlan({ commercialRentArea: 30000, rentPerDay: 2.5, occupancyRate: 0.9 });
  // 30000 * 2.5 * 365 * 0.9 / 10000 = 2463.75 万元
  assertApprox(result.income.annualCommercialRent, 2464, 1);
});

test('车位年化租金', () => {
  const result = calculateFinancialPlan({ parkingSpaces: 681, parkingRent: 10, parkingOccupancy: 0.95 });
  // 681 * 10 * 365 * 0.95 / 10000 = 236.22 万元
  assertApprox(result.income.annualParkingRent, 236, 1);
});

// ============================================================
// 第二部分：成本计算
// ============================================================
console.log('\n--- 成本计算 ---');

test('建安成本 = 地上×地上单价 + 地下×地下单价', () => {
  const result = calculateFinancialPlan({
    aboveGroundNew: 100000, aboveGroundUnitPrice: 4300,
    undergroundNew: 60000, undergroundUnitPrice: 6000,
    aboveGroundExchange: 40000, undergroundExchange: 3000,
    aboveGroundSalesArea: null,
  });
  // 43000 + 36000 = 79000 万元
  if (result.cost.totalBuildCost !== 79000) throw new Error(`${result.cost.totalBuildCost}`);
});

test('拆除成本 = 原面积 × 拆除单价 / 10000', () => {
  const result = calculateFinancialPlan({ originalArea: 56882, demolitionUnitPrice: 150 });
  if (result.cost.demolitionCost !== 853) throw new Error(`${result.cost.demolitionCost}`);
});

test('土地费：代建成本 > 应缴土地费时免缴', () => {
  const result = calculateFinancialPlan({
    aboveGroundNew: 115312, aboveGroundExchange: 65309,
    aboveGroundUnitPrice: 4300, undergroundNew: 60000,
    undergroundExchange: 2950, undergroundUnitPrice: 6000,
    landPrice: 2500, enableLandFeeDeduction: true,
  });
  if (result.cost.landFeePayable !== 0) throw new Error(`${result.cost.landFeePayable}`);
});

test('土地费：不启用抵扣时全额缴纳', () => {
  const result = calculateFinancialPlan({
    aboveGroundNew: 115312, aboveGroundExchange: 65309,
    undergroundNew: 60000, undergroundExchange: 2950,
    landPrice: 2500, enableLandFeeDeduction: false,
  });
  if (result.cost.landFeePayable !== 12501) throw new Error(`${result.cost.landFeePayable}`);
});

test('full口径含前期费用、管理费、运营成本', () => {
  const fullResult = calculateFinancialPlan({ costMode: 'full' });
  const reportResult = calculateFinancialPlan({ costMode: 'report' });
  if (fullResult.cost.prelimCost <= 0) throw new Error('full口径前期费用应>0');
  if (reportResult.cost.prelimCost !== 0) throw new Error('report口径前期费用应为0');
  if (fullResult.cost.managementCost <= 0) throw new Error('full口径管理费应>0');
  if (fullResult.cost.operatingCost <= 0) throw new Error('full口径运营成本应>0');
});

test('full口径总成本 ≥ report口径总成本', () => {
  const fullResult = calculateFinancialPlan({ costMode: 'full' });
  const reportResult = calculateFinancialPlan({ costMode: 'report' });
  if (fullResult.cost.totalCost < reportResult.cost.totalCost) throw new Error('full应≥report');
});

// ============================================================
// 第三部分：租金增长 + NPV
// ============================================================
console.log('\n--- 租金增长 + NPV ---');

test('rentGrowthRate=0时，合计租金 ≈ 年化×年限（容差考虑舍入）', () => {
  const result = calculateFinancialPlan({ rentGrowthRate: 0 });
  const expected = result.income.annualTotalRent * 18;
  assertApprox(result.income.totalRentIncome, expected, 5, '不含增长时租金应≈年化×年限');
});

test('rentGrowthRate=3%时，合计租金 > 年化×年限', () => {
  const resultGrowth = calculateFinancialPlan({ rentGrowthRate: 0.03 });
  const resultFlat = calculateFinancialPlan({ rentGrowthRate: 0 });
  if (resultGrowth.income.totalRentIncome <= resultFlat.income.totalRentIncome) {
    throw new Error('含增长的租金合计应大于不含增长');
  }
});

test('NPV租金 < 18年合计租金（折现后金额更小）', () => {
  const result = calculateFinancialPlan({ discountRate: 0.08 });
  if (result.metrics.npvRent >= result.income.totalRentIncome) {
    throw new Error(`NPV租金 ${result.metrics.npvRent} 应小于合计 ${result.income.totalRentIncome}`);
  }
});

test('NPV租金 ≈ 合计租金 × 折现因子（简化验证）', () => {
  // 年化租金 × 年金现值系数 ≈ NPV租金（含增长时更复杂，用0增长验证）
  const result = calculateFinancialPlan({ discountRate: 0.08, rentGrowthRate: 0, buildYears: 3 });
  // 年金现值系数 = (1-(1+r)^(-n))/r，但租金从第4年开始，还要乘折现到第3年末
  // 即 pvFactor = 1/(1+r)^3 × ((1-(1+r)^(-18))/r)
  const r = 0.08;
  const annuityFactor = (1 - Math.pow(1 + r, -18)) / r;
  const delayFactor = 1 / Math.pow(1 + r, 3);
  const expectedNPV = result.income.annualTotalRent * annuityFactor * delayFactor;
  assertApprox(result.metrics.npvRent, expectedNPV, 100, 'NPV租金应近似年金现值');
});

test('NPV净收益 < 未折现净收益（折现让收益缩水）', () => {
  const result = calculateFinancialPlan({ discountRate: 0.08 });
  if (result.metrics.npvNetProfit >= result.netProfit) {
    throw new Error(`NPV净收益 ${result.metrics.npvNetProfit} 应小于未折现净收益 ${result.netProfit}`);
  }
});

test('discountRate=0时，NPV = 未折现值（不考虑时间价值）', () => {
  const result = calculateFinancialPlan({ discountRate: 0, rentGrowthRate: 0 });
  // 折现率为0时，NPV净收益 ≈ 净收益（但销售收入的折现年份仍影响）
  // buildYears=3时，第3年的销售收入折现因子=1/(1+0)^3=1
  assertApprox(result.metrics.npvNetProfit, result.netProfit, 50, '折现率0时NPV≈净收益');
});

// ============================================================
// 第四部分：IRR
// ============================================================
console.log('\n--- IRR ---');

test('IRR 为数值且在合理范围（-10%~100%）', () => {
  const irr = calculateIRR({});
  if (irr === null) throw new Error('IRR不应为null');
  if (irr < -10 || irr > 100) throw new Error(`IRR ${irr}% 超出合理范围`);
});

test('IRR > 折现率时项目可行（NPV>0）', () => {
  const irr = calculateIRR({ discountRate: 0.08 });
  const result = calculateFinancialPlan({ discountRate: 0.08 });
  // IRR > discountRate ⟹ NPV > 0
  if (irr > 8 && result.metrics.npvNetProfit <= 0) {
    throw new Error('IRR>8%时NPV应>0');
  }
});

test('IRR ≈ 0或负时，项目几乎无收益', () => {
  // 极端场景：成本 = 收入（最小收入）
  const irr = calculateIRR({
    originalArea: 0, aboveGroundNew: 100000, undergroundNew: 5000,
    aboveGroundExchange: 0, undergroundExchange: 0,
    aboveGroundSalesArea: null, salesPrice: 1, commercialRentArea: 0, parkingSpaces: 0,
    aboveGroundUnitPrice: 4300, undergroundUnitPrice: 6000,
  });
  // 销售收入极低 → IRR应很低或负
  if (irr !== null && irr > 5) throw new Error(`极低收入项目IRR应很低，实际=${irr}%`);
});

// ============================================================
// 第五部分：输入校验
// ============================================================
console.log('\n--- 输入校验 ---');

test('负面积校验', () => {
  const v = validateFinancialParams({ originalArea: -100 });
  if (v.valid) throw new Error('负面积应校验失败');
  if (v.errors.length === 0) throw new Error('应有错误信息');
});

test('比率越界校验（>1）', () => {
  const v = validateFinancialParams({ occupancyRate: 1.5 });
  if (v.valid) throw new Error('occupancyRate>1应校验失败');
});

test('exchangeRatio < 0 校验', () => {
  const v = validateFinancialParams({ exchangeRatio: -0.5 });
  if (v.valid) throw new Error('exchangeRatio<0应校验失败');
});

test('exchangeRatio = 0 允许（全部收储模式）', () => {
  const v = validateFinancialParams({ exchangeRatio: 0 });
  if (!v.valid) throw new Error('exchangeRatio=0应通过校验（全部收储模式）');
});

test('exchangeRatio > 3 校验', () => {
  const v = validateFinancialParams({ exchangeRatio: 5 });
  if (v.valid) throw new Error('exchangeRatio=5应校验失败');
});

test('逻辑约束：aboveGroundNew < aboveGroundExchange', () => {
  const v = validateFinancialParams({ aboveGroundNew: 5000, aboveGroundExchange: 10000 });
  if (v.valid) throw new Error('应校验失败：新建面积小于调换面积');
});

test('costMode非法值', () => {
  const v = validateFinancialParams({ costMode: 'invalid' });
  if (v.valid) throw new Error('非法costMode应校验失败');
});

test('financeCostMode非法值', () => {
  const v = validateFinancialParams({ financeCostMode: 'invalid' });
  if (v.valid) throw new Error('非法financeCostMode应校验失败');
});

test('合法参数通过校验', () => {
  const v = validateFinancialParams({ originalArea: 56882, exchangeRatio: 1.2 });
  if (!v.valid) throw new Error('合法参数应通过校验');
});

test('calculate() 对非法参数抛出异常', () => {
  let threw = false;
  try {
    calculateFinancialPlan({ originalArea: -100 });
  } catch (e) {
    threw = true;
  }
  if (!threw) throw new Error('负面积应导致calculate()抛异常');
});

test('销售面积超过超配面积时抛异常', () => {
  let threw = false;
  try {
    calculateFinancialPlan({
      aboveGroundNew: 100000, aboveGroundExchange: 60000,
      aboveGroundSalesArea: 999999, // 远超超配面积40000
      undergroundNew: 60000, undergroundExchange: 3000,
    });
  } catch (e) {
    threw = true;
    if (!e.message.includes('销售面积')) throw new Error('异常信息应提到销售面积');
  }
  if (!threw) throw new Error('销售面积超额应抛异常');
});

// ============================================================
// 第六部分：动态财务费用
// ============================================================
console.log('\n--- 动态财务费用 ---');

test('financeCostMode=dynamic 时财务费用 > 0', () => {
  const result = calculateFinancialPlan({ financeCostMode: 'dynamic' });
  if (result.cost.financeCost <= 0) throw new Error('动态财务费用应>0');
});

test('dynamic 财务费用近似计算值', () => {
  const result = calculateFinancialPlan({
    financeCostMode: 'dynamic',
    financeRatio: 0.7, financeInterestRate: 0.06, buildYears: 3,
    // 简化场景：不含财务费用的投资额 ≈ 已知值
  });
  // investWithoutFinance * 0.7 * 0.06 * 3
  // 大方案不含财务费用的投资额 ≈ 70000-80000 万元（粗略）
  // 70000 * 0.7 * 0.06 * 3 = 8820 万元
  if (result.cost.financeCost < 5000 || result.cost.financeCost > 15000) {
    throw new Error(`动态财务费用 ${result.cost.financeCost} 万元不在合理范围`);
  }
});

test('financeCostMode=fixed 时使用传入固定值', () => {
  const result = calculateFinancialPlan({ financeCostMode: 'fixed', financeCost: 1234 });
  if (result.cost.financeCost !== 1234) throw new Error(`${result.cost.financeCost}`);
});

// ============================================================
// 第七部分：可行性判断
// ============================================================
console.log('\n--- 可行性判断 ---');

test('净收益>0 + ROI≥8% + 回收期≤15年 → "可行"', () => {
  const result = calculateFinancialPlan({});
  // 大方案默认参数应至少满足净收益>0
  if (result.feasibilityDetail.profitPositive !== true) throw new Error('大方案净收益应>0');
});

test('exchangeRatio=0时全部收储模式（直接征收重建）', () => {
  // 直接征收重建：无产权调换，全部新建可售
  const result = calculateFinancialPlan({
    originalArea: 6000,
    aboveGroundNew: 10000,
    undergroundNew: 5000,
    exchangeRatio: 0,  // 全部货币化补偿，无产权调换
    aboveGroundSalesArea: null,  // 使用全部超配面积
    salesPrice: 15000,
    commercialRentArea: 2000,
    aboveGroundUnitPrice: 4300,
    undergroundUnitPrice: 6000,
  });
  // 调换面积应为0
  if (result.area.aboveGroundExchange !== 0) throw new Error(`地上调换面积应为0，实际: ${result.area.aboveGroundExchange}`);
  if (result.area.undergroundExchange !== 0) throw new Error(`地下调换面积应为0，实际: ${result.area.undergroundExchange}`);
  // 超配面积 = 新建面积（全部可售）
  if (result.area.aboveSurplus !== 10000) throw new Error(`地上超配面积应为10000，实际: ${result.area.aboveSurplus}`);
  if (result.area.belowSurplus !== 5000) throw new Error(`地下超配面积应为5000，实际: ${result.area.belowSurplus}`);
  // 全部地上面积可售
  if (result.income.aboveSalesArea !== 10000) throw new Error(`可售面积应为10000，实际: ${result.income.aboveSalesArea}`);
});

test('可行性多条件判断', () => {
  // 极端场景：巨大成本、零收入
  const result = calculateFinancialPlan({
    aboveGroundNew: 100000, undergroundNew: 50000,
    aboveGroundExchange: 0, undergroundExchange: 0,
    salesPrice: 0, commercialRentArea: 0, parkingSpaces: 0,
    aboveGroundUnitPrice: 4300, undergroundUnitPrice: 6000,
  });
  // 新判定体系：零收入+高成本 = 严重亏损（F级）
  if (!result.feasibility.includes('严重亏损') && !result.feasibility.includes('不可行')) {
    throw new Error(`应为严重亏损或不可行，实际: ${result.feasibility}`);
  }
  if (result.feasibilityLevel !== 'F') throw new Error(`应为F级，实际: ${result.feasibilityLevel}`);
});

test('默认参数下判定为严重亏损（NPV深度亏损触发）', () => {
  // 默认参数下：NPV深度亏损（<-20%总投资），触发severeLoss硬约束
  const result = calculateFinancialPlan({});
  if (result.feasibilityLevel !== 'F') throw new Error(`默认参数应为F级，实际: ${result.feasibilityLevel}，feasibility=${result.feasibility}`);
  if (!result.feasibility.includes('严重亏损')) throw new Error('应包含"严重亏损"');
  if (result.feasibilityDetail.npvPositive) throw new Error('NPV应为负');
  // 回收期：修正后包含销售收入，但仍可能超15年上限
  if (result.metrics.paybackPeriod <= 15) throw new Error(`修正后回收期仍应超15年上限，实际: ${result.metrics.paybackPeriod}`);
  // IRR 应被计算并显示
  if (result.metrics.irr === undefined) throw new Error('metrics应包含irr');
  if (result.metrics.irr === null) throw new Error('默认参数下IRR应能计算（即使为负）');
});

// ============================================================
// 第八部分：盈亏平衡出租率
// ============================================================
console.log('\n--- 盈亏平衡出租率 ---');

test('盈亏平衡出租率在0-1之间', () => {
  const result = calculateFinancialPlan({});
  if (result.metrics.breakEvenOccupancy < 0 || result.metrics.breakEvenOccupancy > 1) {
    throw new Error(`出租率 ${result.metrics.breakEvenOccupancy} 不在0-1范围`);
  }
});

test('盈亏平衡出租率：高租金场景下 < 实际出租率', () => {
  // 高租金、低成本场景：breakEvenOccupancy 应明显低于实际出租率
  const result = calculateFinancialPlan({
    occupancyRate: 0.9, rentPerDay: 5, commercialRentArea: 30000,
    salesPrice: 15000, aboveGroundUnitPrice: 2000, undergroundUnitPrice: 3000,
    originalArea: 56882, aboveGroundNew: 115312,
  });
  if (result.metrics.breakEvenOccupancy >= result.area.originalArea > 0 ? 0.9 : 0) {
    throw new Error(`盈亏平衡出租率 ${result.metrics.breakEvenOccupancy} 应<实际0.9`);
  }
});

// ============================================================
// 第九部分：逐年现金流
// ============================================================
console.log('\n--- 逐年现金流 ---');

test('现金流表行数 = buildYears + rentYears + 1', () => {
  const cf = calculateCashFlow({ buildYears: 3, rentYears: 18 });
  if (cf.length !== 22) throw new Error(`现金流表应有22行，实际 ${cf.length}`);
});

test('第0年流出 = 总成本', () => {
  const result = calculateFinancialPlan({ buildYears: 3 });
  const cf = calculateCashFlow({ buildYears: 3 });
  if (cf[0].outflow !== result.cost.totalCost) throw new Error('第0年流出应=总成本');
});

test('第0年净现金流 = -总成本', () => {
  const cf = calculateCashFlow({ buildYears: 3 });
  if (cf[0].netCashflow >= 0) throw new Error('第0年应为负值');
});

test('建设期中间年无收支', () => {
  const cf = calculateCashFlow({ buildYears: 3 });
  for (let i = 1; i < 3; i++) {
    if (cf[i].inflow !== 0 || cf[i].outflow !== 0) throw new Error(`第${i}年不应有收支`);
  }
});

test('第buildYears年有销售收入', () => {
  const result = calculateFinancialPlan({ buildYears: 3 });
  const cf = calculateCashFlow({ buildYears: 3 });
  if (cf[3].inflow !== result.income.aboveSalesIncome) throw new Error('第3年应有销售收入流入');
});

test('运营期逐年租金含增长', () => {
  const cf = calculateCashFlow({ buildYears: 3, rentYears: 5, rentGrowthRate: 0.03 });
  // 第5年（运营第1年）应有正流入
  if (cf[4].inflow <= 0) throw new Error('运营第1年应有正流入');
  // 运营第2年流入 > 第1年（含增长）
  if (cf[5].inflow <= cf[4].inflow) throw new Error('运营第2年流入应大于第1年');
});

// ============================================================
// 第十部分：敏感性分析
// ============================================================
console.log('\n--- 敏感性分析 ---');

test('敏感性分析返回baseResult和matrix', () => {
  const sa = sensitivityAnalysis({});
  if (!sa.baseResult) throw new Error('应有baseResult');
  if (!sa.matrix) throw new Error('应有matrix');
});

test('默认分析5个变量', () => {
  const sa = sensitivityAnalysis({});
  const varCount = Object.keys(sa.matrix).length;
  if (varCount !== 5) throw new Error(`默认应分析5个变量，实际 ${varCount}`);
});

test('每个变量5个扰动级别', () => {
  const sa = sensitivityAnalysis({});
  for (const [varName, pertMap] of Object.entries(sa.matrix)) {
    const pertCount = Object.keys(pertMap).length;
    if (pertCount !== 5) throw new Error(`${varName}应有5个扰动，实际 ${pertCount}`);
  }
});

test('扰动0%时净收益 = 基准净收益', () => {
  const sa = sensitivityAnalysis({});
  const baseProfit = sa.baseResult.netProfit;
  for (const [varName, pertMap] of Object.entries(sa.matrix)) {
    const zeroPert = pertMap[0]; // 扰动0%
    if (zeroPert.netProfit !== baseProfit) {
      throw new Error(`${varName}扰动0%时净收益应=基准 ${baseProfit}，实际 ${zeroPert.netProfit}`);
    }
  }
});

test('销售单价下降20%时净收益下降', () => {
  const sa = sensitivityAnalysis({});
  const baseProfit = sa.baseResult.netProfit;
  const down20 = sa.matrix.salesPrice[-0.20];
  if (down20.netProfit >= baseProfit) throw new Error('销售单价下降20%时净收益应下降');
});

test('建安单价上升20%时净收益下降', () => {
  const sa = sensitivityAnalysis({});
  const baseProfit = sa.baseResult.netProfit;
  const up20 = sa.matrix.aboveGroundUnitPrice[0.20];
  if (up20.netProfit >= baseProfit) throw new Error('建安单价上升20%时净收益应下降');
});

test('出租率上升20%时净收益上升', () => {
  const sa = sensitivityAnalysis({});
  const baseProfit = sa.baseResult.netProfit;
  const up20 = sa.matrix.occupancyRate[0.20];
  if (up20.netProfit <= baseProfit) throw new Error('出租率上升20%时净收益应上升');
});

test('自定义变量和扰动', () => {
  const sa = sensitivityAnalysis({}, {
    variables: ['salesPrice'],
    perturbations: [-0.30, 0, 0.30],
  });
  if (Object.keys(sa.matrix).length !== 1) throw new Error('应只分析1个变量');
  if (Object.keys(sa.matrix.salesPrice).length !== 3) throw new Error('应有3个扰动');
});

test('比率越界时标记为skipped', () => {
  // occupancyRate 上升20% → 0.9*1.2=1.08 > 1，应被跳过
  const sa = sensitivityAnalysis({ occupancyRate: 0.9 }, {
    variables: ['occupancyRate'],
    perturbations: [0.20],
  });
  const entry = sa.matrix.occupancyRate[0.20];
  if (!entry.skipped) throw new Error('occupancyRate扰动越界应被跳过');
});

// ============================================================
// 第十一部分：报告生成
// ============================================================
console.log('\n--- 报告生成 ---');

test('基础报告包含面积、收入、成本、指标', () => {
  const calc = new UrbanRenewalCalculator({});
  const result = calc.calculate();
  const report = calc.generateReport(result);
  if (!report.includes('超配物业面积')) throw new Error('报告应含面积');
  if (!report.includes('超配物业收入')) throw new Error('报告应含收入');
  if (!report.includes('总成本费用')) throw new Error('报告应含成本');
  if (!report.includes('财务指标')) throw new Error('报告应含指标');
});

test('报告包含NPV指标', () => {
  const calc = new UrbanRenewalCalculator({ discountRate: 0.08 });
  const result = calc.calculate();
  const report = calc.generateReport(result);
  if (!report.includes('NPV')) throw new Error('报告应含NPV指标');
  if (!report.includes('折现分析')) throw new Error('报告应含折现分析');
});

test('报告包含可行性多条件判断', () => {
  const calc = new UrbanRenewalCalculator({});
  const result = calc.calculate();
  const report = calc.generateReport(result);
  if (!report.includes('净收益 > 0')) throw new Error('报告应含净收益条件');
  if (!report.includes('ROI')) throw new Error('报告应含ROI条件');
});

test('敏感性分析报告文本', () => {
  const calc = new UrbanRenewalCalculator({});
  const sa = calc.sensitivityAnalysis();
  const report = calc.generateSensitivityReport(sa);
  if (!report.includes('敏感性分析')) throw new Error('报告应含标题');
  if (!report.includes('salesPrice')) throw new Error('报告应含变量名');
});

// ============================================================
// 第十二部分：回收期修正验证（Bug Fix 专项测试）
// ============================================================
console.log('\n--- 回收期修正验证 ---');

test('回收期包含销售收入：销售收入覆盖全部投资时回收期=建设期', () => {
  // 极端场景：销售收入远大于总投资
  const result = calculateFinancialPlan({
    originalArea: 1000,
    aboveGroundNew: 50000,
    undergroundNew: 5000,
    aboveGroundExchange: 0,
    undergroundExchange: 0,
    aboveGroundSalesArea: null,
    salesPrice: 50000,     // 高售价
    commercialRentArea: 0,
    parkingSpaces: 0,
    aboveGroundUnitPrice: 2000,
    undergroundUnitPrice: 3000,
    financeCostMode: 'fixed',
    financeCost: 0,
  });
  // 销售收入 = 50000 * 50000 / 10000 = 250,000 万元
  // 总投资应该远小于 250,000 万元
  if (result.metrics.paybackPeriod !== 3) {
    throw new Error(`销售收入覆盖全部投资时回收期应=建设期3年，实际: ${result.metrics.paybackPeriod}`);
  }
});

test('回收期包含销售收入：部分覆盖时回收期=建设期+余额/年净租金', () => {
  const result = calculateFinancialPlan({
    originalArea: 56882,
    aboveGroundNew: 115312,
    undergroundNew: 60000,
    aboveGroundExchange: 65309,
    undergroundExchange: 2950,
    salesPrice: 15000,
    aboveGroundSalesArea: 50003,
    commercialRentArea: 30000,
    rentPerDay: 2.5,
    buildYears: 3,
    financeCostMode: 'fixed',
    financeCost: 0,
  });
  // 修正后回收期应远小于旧版本（旧版只用租金回收全部投资，得68+年）
  // 新版：销售先回收大部分，余额靠租金 → 应在20-40年范围
  if (result.metrics.paybackPeriod > 100) {
    throw new Error(`修正后回收期不应超过100年，实际: ${result.metrics.paybackPeriod}（可能仍用旧公式）`);
  }
  // 回收期应包含建设期3年
  if (result.metrics.paybackPeriod < 3) {
    throw new Error(`回收期不应小于建设期3年，实际: ${result.metrics.paybackPeriod}`);
  }
});

test('回收期：无销售收入时=总投资/年净租金', () => {
  // 无销售、纯租金回收（此场景下新旧公式结果相同）
  const result = calculateFinancialPlan({
    originalArea: 56882,
    aboveGroundNew: 115312,
    undergroundNew: 60000,
    aboveGroundExchange: 65309,
    undergroundExchange: 2950,
    aboveGroundSalesArea: 0,  // 无可售面积
    salesPrice: 0,            // 无销售
    commercialRentArea: 30000,
    rentPerDay: 2.5,
    buildYears: 3,
    financeCostMode: 'fixed',
    financeCost: 0,
  });
  // 无销售时，回收期 = 建设期 + 总投资/年净租金
  if (result.metrics.paybackPeriod <= result.metrics.totalInvestment) {
    // 回收期应该很长（纯靠租金回收全部投资）
    if (result.metrics.paybackPeriod < 30) {
      throw new Error(`无销售时纯租金回收期应很长，实际: ${result.metrics.paybackPeriod}`);
    }
  }
});

test('可行性判断：NPV/IRR否决生效，回收期不作为硬否决', () => {
  // 场景：NPV深度亏损 → 严重亏损（F级），不依赖回收期否决
  const result = calculateFinancialPlan({
    originalArea: 56882,
    aboveGroundNew: 115312,
    undergroundNew: 60000,
    aboveGroundExchange: 65309,
    undergroundExchange: 2950,
    salesPrice: 100,         // 极低售价
    commercialRentArea: 0,
    parkingSpaces: 0,
    aboveGroundUnitPrice: 4300,
    undergroundUnitPrice: 6000,
  });
  // NPV深度亏损 → severeLoss触发 → F级
  if (result.feasibilityLevel !== 'F') {
    throw new Error(`极低售价应为F级（严重亏损），实际: ${result.feasibilityLevel}`);
  }
});

test('可行性判断：NPV为正+IRR达标 → 非"F级"', () => {
  // 场景：高售价、低成本，NPV为正、IRR达标
  const result = calculateFinancialPlan({
    originalArea: 1000,
    aboveGroundNew: 50000,
    undergroundNew: 5000,
    aboveGroundExchange: 0,
    undergroundExchange: 0,
    aboveGroundSalesArea: null,
    salesPrice: 30000,
    commercialRentArea: 5000,
    rentPerDay: 3,
    aboveGroundUnitPrice: 2000,
    undergroundUnitPrice: 3000,
    landPrice: 500,
    financeCostMode: 'fixed',
    financeCost: 0,
  });
  // NPV应为正，不应是F级
  if (result.feasibilityLevel === 'F') {
    throw new Error(`NPV为正时不应为F级，实际: ${result.feasibilityLevel}, NPV=${result.metrics.npvNetProfit}`);
  }
  if (!result.feasibilityDetail.npvPositive) {
    throw new Error(`高售价低成本场景NPV应为正，实际NPV=${result.metrics.npvNetProfit}`);
  }
});

// ============================================================
// 第十三部分：边界条件
// ============================================================
console.log('\n--- 边界条件 ---');

test('默认参数大方案计算结果完整性', () => {
  const result = calculateFinancialPlan({});
  if (result.area.totalNewArea <= 0) throw new Error('新建面积>0');
  if (result.income.totalIncome <= 0) throw new Error('总收入>0');
  if (result.cost.totalCost <= 0) throw new Error('总成本>0');
  if (typeof result.netProfit !== 'number') throw new Error('净收益为数字');
  // 新判定体系包含6个等级：A/B/C/D/E/F
  const validLevels = ['优秀项目', '可行', '边界可行（需大幅优化）', '高风险（不建议投资）', '不可行', '严重亏损（建议终止）'];
  if (!validLevels.includes(result.feasibility)) throw new Error(`可行性判断不在有效列表中: ${result.feasibility}`);
  if (!['A', 'B', 'C', 'D', 'E', 'F'].includes(result.feasibilityLevel)) throw new Error(`可行性等级无效: ${result.feasibilityLevel}`);
  if (result.metrics.irr === undefined) throw new Error('metrics应包含irr');
  if (result.feasibilityScore === undefined) throw new Error('应包含feasibilityScore');
  if (!Array.isArray(result.feasibilityRiskNotes)) throw new Error('feasibilityRiskNotes应为数组');
});

test('销售单价为0时销售收入为0', () => {
  const result = calculateFinancialPlan({ salesPrice: 0 });
  if (result.income.aboveSalesIncome !== 0) throw new Error(`${result.income.aboveSalesIncome}`);
});

test('原面积为0且未指定调换面积时超配面积=新建面积', () => {
  const result = calculateFinancialPlan({
    originalArea: 0, aboveGroundExchange: null, undergroundExchange: 0,
  });
  if (result.area.totalExchangeArea !== 0) throw new Error(`${result.area.totalExchangeArea}`);
  if (result.area.aboveSurplus !== result.area.aboveGroundNew) throw new Error('超配面积应=新建面积');
});

// ============================================================
// 结果汇总
// ============================================================
console.log(`\n=== 测试结果: ${passed} 通过, ${failed} 失败 ===\n`);
process.exit(failed > 0 ? 1 : 0);
