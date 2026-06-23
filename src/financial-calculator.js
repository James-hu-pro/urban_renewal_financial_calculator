/**
 * 城市更新财务效益测算核心模块
 * 适用场景：城市更新自主改造项目（产权调换 + 超配销售 + 持有出租）
 *
 * 核心能力：
 *   1. 基础测算 — 面积/收入/成本/净收益
 *   2. NPV/IRR  — 折现净现值 + 内部收益率
 *   3. 逐年现金流 — 建设期 + 运营期分年计算
 *   4. 敏感性分析 — 关键变量扰动矩阵
 *   5. 输入校验   — 参数范围和逻辑约束检查
 *
 * 双环境导出：Node.js (module.exports) + 浏览器 (window.*)
 */

class UrbanRenewalCalculator {
  constructor(params) {
    this.params = this.mergeWithDefaults(params);
  }

  // ==================== 参数默认值 ====================

  mergeWithDefaults(params) {
    const defaults = {
      // ---- 拆迁量 ----
      originalArea: 56882,          // 原产权面积 (㎡)
      exchangeRatio: 1.2,           // 产权调换比例（1:1.2 为行业常见政策）

      // ---- 拆建规模 ----
      aboveGroundNew: 115312,       // 地上新建建筑面积 (㎡)
      undergroundNew: 60000,        // 地下新建建筑面积 (㎡)

      // ---- 产权调换面积 ----
      aboveGroundExchange: 65309,   // 地上产权调换面积 (㎡)，null=按比例自动分配
      undergroundExchange: 2950,    // 地下产权调换面积 (㎡)

      // ---- 建设单价 ----
      aboveGroundUnitPrice: 4300,   // 地上建设综合单价 (元/㎡)
      undergroundUnitPrice: 6000,   // 地下建设综合单价 (元/㎡)
      demolitionUnitPrice: 150,     // 拆除单价 (元/㎡)

      // ---- 土地补缴 ----
      landPrice: 2500,              // 楼板价 (元/㎡)
      enableLandFeeDeduction: false, // 是否启用代建成本抵扣土地费（特定城市政策，默认关闭）

      // ---- 收入 · 销售 ----
      salesPrice: 15000,            // 地上超配销售单价 (元/㎡)
      aboveGroundSalesArea: 50003,  // 地上可销售超配面积 (㎡)，null=使用全部地上超配

      // ---- 收入 · 商业出租 ----
      commercialRentArea: 30000,    // 商业出租面积 (㎡)
      rentPerDay: 2.5,              // 商业日租金 (元/㎡/天)
      rentYears: 18,                // 租金计算年限
      occupancyRate: 0.9,           // 年出租率
      rentGrowthRate: 0.03,         // 年租金增长率（默认3%，反映长期通胀+租约调升）

      // ---- 收入 · 车位出租 ----
      parkingSpaces: 676,           // 停车位数量，null=按地下超配自动折算
      parkingAreaPerSpace: 84,      // 每车位占地下面积 (㎡/车位)
      parkingRent: 10,              // 车位日租金 (元/日·车位)
      parkingOccupancy: 0.95,       // 车位年出租率

      // ---- 前期费用 ----
      prelimUnitPrice: 100,         // 前期费用综合单价 (元/㎡)

      // ---- 开发间接费 ----
      mgmtRate: 0.02,               // 开发管理费率（占建安成本）
      marketingRate: 0.02,          // 营销费用率（占销售收入）
      leasingRate: 0.10,            // 招商费用率（占租金收入）

      // ---- 持有运营成本 ----
      operatingCostRate: 0.15,      // 持有运营成本率（占租金收入）
      rentTaxRate: 0.15,            // 租金综合税率（房产税12% + 增值税等）

      // ---- 销售环节费用 ----
      salesCostRate: 0.05,          // 物业销售成本率
      taxRate: 0.035,               // 销售税费率（增值税+附加等）

      // ---- 财务费用 ----
      financeCost: 0,                // 财务费用 (万元)，固定值模式默认0，建议使用 dynamic 模式
      financeRatio: 0.70,           // 融资比例（默认70%贷款）
      financeInterestRate: 0.06,    // 年贷款利率（默认6%）
      buildYears: 3,                // 建设周期（年）
      financeCostMode: 'fixed',     // 'fixed'=固定值 | 'dynamic'=动态计算

      // ---- 折现参数（NPV/IRR） ----
      discountRate: 0.08,           // 折现率（默认8%，含风险溢价）

      // ---- 可行性判断阈值 ----
      minimumROI: 0.08,             // 最低期望投资回报率（8%为商业地产行业基准）
      maxPaybackYears: 15,          // 最长可接受回收期（年）

      // ---- 成本口径模式 ----
      // 'full' = 完整专业口径（含前期/管理/运营/租金税费）
      // 'report' = 报告口径（与docx对齐，简化成本项）
      costMode: 'full',
    };
    return { ...defaults, ...params };
  }

  // ==================== 输入校验 ====================

  /**
   * 校验参数合法性，返回 { valid: boolean, errors: string[] }
   * 可作为静态方法调用：UrbanRenewalCalculator.validateParams(params)
   */
  static validateParams(params) {
    const errors = [];

    // ---- 面积类：必须 ≥ 0 ----
    const areaFields = ['originalArea', 'aboveGroundNew', 'undergroundNew',
      'aboveGroundExchange', 'undergroundExchange', 'commercialRentArea',
      'aboveGroundSalesArea', 'aboveGroundUnitPrice', 'undergroundUnitPrice',
      'demolitionUnitPrice', 'landPrice', 'salesPrice', 'rentPerDay',
      'prelimUnitPrice', 'parkingRent', 'parkingAreaPerSpace'];
    for (const f of areaFields) {
      if (params[f] !== undefined && params[f] !== null && params[f] < 0) {
        errors.push(`${f} 不能为负数（当前值: ${params[f]}）`);
      }
    }

    // ---- 比率类：必须在 0-1 或 0-合理上限 ----
    const ratio01Fields = ['occupancyRate', 'parkingOccupancy', 'mgmtRate',
      'marketingRate', 'leasingRate', 'operatingCostRate', 'rentTaxRate',
      'salesCostRate', 'taxRate', 'financeRatio', 'financeInterestRate',
      'discountRate', 'minimumROI', 'rentGrowthRate'];
    for (const f of ratio01Fields) {
      if (params[f] !== undefined && params[f] !== null) {
        if (params[f] < 0) errors.push(`${f} 不能为负数（当前值: ${params[f]}）`);
        if (params[f] > 1 && f !== 'minimumROI') errors.push(`${f} 不能超过1（当前值: ${params[f]}）`);
        // minimumROI 可以超过1（如100%回报率是极端但合法的）
        if (f === 'minimumROI' && params[f] > 2) errors.push(`${f} 超过200%不合理（当前值: ${params[f]}）`);
      }
    }

    // ---- 产权调换比例 ----
    if (params.exchangeRatio !== undefined) {
      if (params.exchangeRatio <= 0) errors.push('exchangeRatio 必须大于0');
      if (params.exchangeRatio > 3) errors.push('exchangeRatio 超过3倍不合理');
    }

    // ---- 年限类 ----
    if (params.rentYears !== undefined && params.rentYears <= 0) errors.push('rentYears 必须大于0');
    if (params.buildYears !== undefined && params.buildYears <= 0) errors.push('buildYears 必须大于0');
    if (params.maxPaybackYears !== undefined && params.maxPaybackYears <= 0) errors.push('maxPaybackYears 必须大于0');

    // ---- 逻辑约束 ----
    // 地上新建 > 地上产权调换（否则没有超配面积可销售）
    if (params.aboveGroundNew !== undefined && params.aboveGroundExchange !== undefined &&
        params.aboveGroundExchange !== null && params.aboveGroundNew < params.aboveGroundExchange) {
      errors.push('aboveGroundNew 应 ≥ aboveGroundExchange（否则无超配面积）');
    }
    // 地下新建 > 地下产权调换
    if (params.undergroundNew !== undefined && params.undergroundExchange !== undefined &&
        params.undergroundExchange !== null && params.undergroundNew < params.undergroundExchange) {
      errors.push('undergroundNew 应 ≥ undergroundExchange（否则无超配面积）');
    }
    // 销售面积 ≤ 地上超配面积（不能卖超出你拥有的）
    // 此校验在 calculate() 中动态执行（因为超配面积是计算值）

    // ---- 车位数 ----
    if (params.parkingSpaces !== undefined && params.parkingSpaces !== null && params.parkingSpaces < 0) {
      errors.push('parkingSpaces 不能为负数');
    }

    // ---- costMode ----
    if (params.costMode !== undefined && !['full', 'report'].includes(params.costMode)) {
      errors.push('costMode 只支持 "full" 或 "report"');
    }
    // ---- financeCostMode ----
    if (params.financeCostMode !== undefined && !['fixed', 'dynamic'].includes(params.financeCostMode)) {
      errors.push('financeCostMode 只支持 "fixed" 或 "dynamic"');
    }

    return { valid: errors.length === 0, errors };
  }

  // ==================== 核心计算 ====================

  calculate() {
    const p = this.params;

    // 输入校验
    const validation = UrbanRenewalCalculator.validateParams(p);
    if (!validation.valid) {
      throw new Error('参数校验失败：\n' + validation.errors.join('\n'));
    }

    // 1. 新建建筑面积
    const totalNewArea = p.aboveGroundNew + p.undergroundNew;

    // 2. 产权调换面积
    const totalExchangeArea = p.originalArea * p.exchangeRatio;

    let aboveExchange = p.aboveGroundExchange;
    if (aboveExchange === null) {
      const aboveRatio = p.aboveGroundNew / totalNewArea;
      aboveExchange = totalExchangeArea * aboveRatio;
    }
    const belowExchange = p.undergroundExchange;

    // 3. 超配面积
    const aboveSurplus = p.aboveGroundNew - aboveExchange;
    const belowSurplus = p.undergroundNew - belowExchange;
    const totalSurplus = aboveSurplus + belowSurplus;

    // 4. 地上可销售面积
    const aboveSalesArea = p.aboveGroundSalesArea !== null ? p.aboveGroundSalesArea : aboveSurplus;
    if (aboveSalesArea > aboveSurplus + 1) { // 允许1㎡的舍入误差
      throw new Error(`销售面积 (${aboveSalesArea}㎡) 超过地上超配面积 (${Math.round(aboveSurplus)}㎡)`);
    }
    const aboveSalesIncome = (aboveSalesArea * p.salesPrice) / 10000;

    // 5. 租金收入（年化，含租金增长）
    const annualCommercialRentYear1 = (
      p.commercialRentArea * p.rentPerDay * 365 * p.occupancyRate
    ) / 10000; // 万元/年（第1年）

    let parkingSpaces = p.parkingSpaces;
    if (parkingSpaces === null || parkingSpaces === undefined) {
      // 防护：parkingAreaPerSpace 为 0 时不能除零，此时车位数为 0
      parkingSpaces = p.parkingAreaPerSpace > 0 ? Math.round(belowSurplus / p.parkingAreaPerSpace) : 0;
    }
    const annualParkingRentYear1 = (
      parkingSpaces * p.parkingRent * 365 * p.parkingOccupancy
    ) / 10000;

    const annualTotalRentYear1 = annualCommercialRentYear1 + annualParkingRentYear1;

    // 5b. 18年租金合计（含增长）
    let totalRentIncome = 0;
    let annualRentByYear = [];
    for (let y = 0; y < p.rentYears; y++) {
      const yearRent = annualTotalRentYear1 * Math.pow(1 + p.rentGrowthRate, y);
      annualRentByYear.push(yearRent);
      totalRentIncome += yearRent;
    }

    // 5c. 简化版18年合计（不含增长，用于report口径和对比）
    const totalRentIncomeFlat = annualTotalRentYear1 * p.rentYears;

    const totalIncome = aboveSalesIncome + totalRentIncome;

    // 6. 成本计算
    // 6.1 土地补缴
    const landFeePayableRaw = aboveSurplus * p.landPrice;
    const exchangeBuildCost = (aboveExchange * p.aboveGroundUnitPrice) + (belowExchange * p.undergroundUnitPrice);
    let landFeePayable = 0;
    if (!p.enableLandFeeDeduction || exchangeBuildCost < landFeePayableRaw) {
      landFeePayable = (landFeePayableRaw - (p.enableLandFeeDeduction ? exchangeBuildCost : 0)) / 10000;
    }

    // 6.2 建安成本
    const aboveBuildCost = (p.aboveGroundNew * p.aboveGroundUnitPrice) / 10000;
    const belowBuildCost = (p.undergroundNew * p.undergroundUnitPrice) / 10000;
    const totalBuildCost = aboveBuildCost + belowBuildCost;

    // 6.3 拆除成本
    const demolitionCost = (p.originalArea * p.demolitionUnitPrice) / 10000;

    // 6.5 开发间接费 + 运营成本
    let managementCost, marketingCost, leasingCost, salesCost, salesTax, rentTax, operatingCost, prelimCost;
    if (p.costMode === 'report') {
      prelimCost = 0;
      managementCost = 0;
      marketingCost = 0;
      leasingCost = 0;
      salesCost = totalIncome * p.salesCostRate;
      salesTax = totalIncome * p.taxRate;
      rentTax = 0;
      operatingCost = 0;
    } else {
      prelimCost = (totalNewArea * p.prelimUnitPrice) / 10000;
      managementCost = totalBuildCost * p.mgmtRate;
      marketingCost = aboveSalesIncome * p.marketingRate;
      leasingCost = annualTotalRentYear1 * p.leasingRate;
      salesCost = aboveSalesIncome * p.salesCostRate;
      salesTax = aboveSalesIncome * p.taxRate;
      rentTax = totalRentIncome * p.rentTaxRate;
      operatingCost = totalRentIncome * p.operatingCostRate;
    }

    // 6.9 财务费用
    let financeCost;
    if (p.financeCostMode === 'dynamic') {
      // 动态计算：不含财务费用的投资额 × 融资比例 × 年利率 × 建设周期
      const investWithoutFinance = landFeePayable + prelimCost + totalBuildCost + demolitionCost +
        managementCost + marketingCost + leasingCost + salesCost + salesTax;
      // investWithoutFinance 为万元，结果也为万元
      financeCost = investWithoutFinance * p.financeRatio * p.financeInterestRate * p.buildYears;
    } else {
      financeCost = p.financeCost;
    }

    const totalCost = landFeePayable + prelimCost + totalBuildCost + demolitionCost +
      managementCost + marketingCost + leasingCost +
      salesCost + salesTax + rentTax + operatingCost + financeCost;

    // 7. 净收益
    const netProfit = totalIncome - totalCost;

    // 8. NPV 计算
    const npvRent = this.calculateRentNPV(annualRentByYear, p.discountRate);

    // 投资端 NPV：建设期成本一次性在第0年投入
    // 收入端 NPV：销售在第 buildYears 年实现，租金从第 buildYears+1 年起逐年流入
    // 简化模型：总投资在第0年一次性投入，销售收入在建设期末一次性回收，租金NPV单独计算
    const npvSales = aboveSalesIncome / Math.pow(1 + p.discountRate, p.buildYears);
    const npvTotalIncome = npvSales + npvRent;
    const npvNetProfit = npvTotalIncome - totalCost; // 成本在第0年投入，不折现
    const npvROI = totalCost > 0 ? (npvNetProfit / totalCost) * 100 : 0;

    // 9. 财务指标
    const totalInvestment = totalCost;
    const roi = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0;

    // 静态回收期
    const annualNetRent = annualTotalRentYear1 * (1 - p.operatingCostRate - p.rentTaxRate);
    const paybackPeriod = annualNetRent > 0 ? totalInvestment / annualNetRent : Infinity;

    // 盈亏平衡销售单价
    const breakEvenPrice = aboveSalesArea > 0 ?
      (totalCost - totalRentIncome) / aboveSalesArea * 10000 : 0;

    // 盈亏平衡出租率（简化：假设出租率为x时，净收益=0）
    // netProfit = salesIncome + rentArea * rent/day * 365 * x * years - totalCost_withoutRentProportional
    // 此计算较复杂，简化处理
    const breakEvenOccupancy = this.calculateBreakEvenOccupancy(p, aboveSalesIncome, totalCost, totalRentIncome,
      annualCommercialRentYear1, annualParkingRentYear1);

    // 10. 可行性判断（多条件）
    const feasibilityDetail = {
      profitPositive: netProfit > 0,
      roiAboveMinimum: roi >= p.minimumROI * 100,
      paybackWithinLimit: paybackPeriod <= p.maxPaybackYears,
      npvPositive: npvNetProfit > 0,
    };
    const allConditionsMet = feasibilityDetail.profitPositive && feasibilityDetail.roiAboveMinimum && feasibilityDetail.paybackWithinLimit;
    const feasibility = allConditionsMet ? '可行' : (netProfit > 0 ? '基本可行（需关注风险）' : '不可行');

    return {
      area: {
        originalArea: p.originalArea,
        aboveGroundNew: p.aboveGroundNew,
        undergroundNew: p.undergroundNew,
        totalNewArea: Math.round(totalNewArea),
        aboveGroundExchange: Math.round(aboveExchange),
        undergroundExchange: belowExchange,
        totalExchangeArea: Math.round(totalExchangeArea),
        aboveSurplus: Math.round(aboveSurplus),
        belowSurplus: Math.round(belowSurplus),
        totalSurplus: Math.round(totalSurplus),
      },

      income: {
        aboveSalesArea: Math.round(aboveSalesArea),
        aboveSalesIncome: this.roundWan(aboveSalesIncome),
        annualCommercialRent: this.roundWan(annualCommercialRentYear1),
        annualParkingRent: this.roundWan(annualParkingRentYear1),
        annualTotalRent: this.roundWan(annualTotalRentYear1),
        commercialRentArea: p.commercialRentArea,
        commercialRentIncome: this.roundWan(totalRentIncome),
        parkingSpaces: parkingSpaces,
        parkingIncome: this.roundWan(totalRentIncome - (annualCommercialRentYear1 * p.rentYears)),
        totalRentIncome: this.roundWan(totalRentIncome),
        totalRentIncomeFlat: this.roundWan(totalRentIncomeFlat), // 不含增长的对比值
        totalIncome: this.roundWan(totalIncome),
      },

      cost: {
        landFeePayable: this.roundWan(landFeePayable),
        prelimCost: this.roundWan(prelimCost),
        aboveBuildCost: this.roundWan(aboveBuildCost),
        belowBuildCost: this.roundWan(belowBuildCost),
        totalBuildCost: this.roundWan(totalBuildCost),
        demolitionCost: this.roundWan(demolitionCost),
        managementCost: this.roundWan(managementCost),
        marketingCost: this.roundWan(marketingCost),
        leasingCost: this.roundWan(leasingCost),
        salesCost: this.roundWan(salesCost),
        salesTax: this.roundWan(salesTax),
        rentTax: this.roundWan(rentTax),
        operatingCost: this.roundWan(operatingCost),
        financeCost: this.roundWan(financeCost),
        financeCostMode: p.financeCostMode,
        totalCost: this.roundWan(totalCost),
      },

      metrics: {
        totalInvestment: this.roundWan(totalInvestment),
        netProfit: this.roundWan(netProfit),
        roi: this.round2(roi),
        paybackPeriod: this.round2(paybackPeriod),
        breakEvenPrice: this.round2(breakEvenPrice),
        breakEvenOccupancy: this.round4(breakEvenOccupancy),
        // NPV 相关
        npvRent: this.roundWan(npvRent),
        npvSales: this.roundWan(npvSales),
        npvTotalIncome: this.roundWan(npvTotalIncome),
        npvNetProfit: this.roundWan(npvNetProfit),
        npvROI: this.round2(npvROI),
        discountRate: p.discountRate,
        rentGrowthRate: p.rentGrowthRate,
      },

      feasibility: feasibility,
      feasibilityDetail: feasibilityDetail,

      // 保留旧字段兼容
      netProfit: this.roundWan(netProfit),
    };
  }

  // ==================== NPV 计算 ====================

  /**
   * 计算租金流的净现值（从第 buildYears+1 年开始流入）
   * @param {number[]} annualRentByYear - 逐年租金数组（从运营第1年开始）
   * @param {number} discountRate - 折现率
   * @returns {number} NPV（万元）
   */
  calculateRentNPV(annualRentByYear, discountRate) {
    const buildYears = this.params.buildYears;
    let npv = 0;
    for (let y = 0; y < annualRentByYear.length; y++) {
      // 租金从建设期结束后第1年开始，即绝对第 buildYears+1 年
      npv += annualRentByYear[y] / Math.pow(1 + discountRate, buildYears + y + 1);
    }
    return npv;
  }

  // ==================== IRR 计算 ====================

  /**
   * 计算内部收益率（使 NPV = 0 的折现率）
   * 使用牛顿迭代法，基于简化现金流模型：
   *   第0年：-totalCost（一次性投入）
   *   第buildYears年：+aboveSalesIncome（销售收入）
   *   第buildYears+1 ~ buildYears+rentYears年：+annualNetRentByYear（逐年净租金）
   *
   * @param {number} precision - 精度（默认0.0001，即0.01%）
   * @param {number} maxIterations - 最大迭代次数
   * @returns {number|null} IRR（百分比），null表示无法收敛
   */
  calculateIRR(precision = 0.0001, maxIterations = 200) {
    const p = this.params;
    const baseResult = this.calculate();

    // 构建现金流数组
    const cashflows = this.buildCashflowArray(baseResult);

    // 用牛顿迭代法求解 IRR
    let rate = 0.1; // 初始猜测10%
    for (let i = 0; i < maxIterations; i++) {
      const { npv, dnpv } = this.npvAndDerivative(cashflows, rate);
      if (Math.abs(npv) < 0.01) { // NPV < 0.01万元即视为收敛
        return this.round2(rate * 100);
      }
      if (dnpv === 0) break; // 防止除零
      const newRate = rate - npv / dnpv;
      if (newRate < -0.5 || newRate > 5) break; // 防止发散（-50% ~ 500%）
      rate = newRate;
    }

    // 牛顿法失败，尝试二分法
    return this.irrBisection(cashflows, precision);
  }

  /**
   * 构建现金流数组（绝对年份索引）
   * 索引0 = 项目第0年（投入期），索引buildYears = 建设期末，...
   */
  buildCashflowArray(baseResult) {
    const p = this.params;
    const totalYears = p.buildYears + p.rentYears;
    const cashflows = new Array(totalYears + 1).fill(0);

    // 第0年：一次性投入总成本
    cashflows[0] = -baseResult.cost.totalCost;

    // 第 buildYears 年：销售收入
    cashflows[p.buildYears] += baseResult.income.aboveSalesIncome;

    // 第 buildYears+1 ~ buildYears+rentYears 年：逐年净租金
    for (let y = 0; y < p.rentYears; y++) {
      const yearRent = baseResult.income.annualTotalRent * Math.pow(1 + p.rentGrowthRate, y);
      const netRent = yearRent * (1 - p.operatingCostRate - p.rentTaxRate);
      cashflows[p.buildYears + y + 1] += netRent;
    }

    return cashflows;
  }

  /** 计算 NPV 及其对折现率的导数（牛顿法需要） */
  npvAndDerivative(cashflows, rate) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < cashflows.length; t++) {
      if (cashflows[t] === 0) continue;
      const factor = Math.pow(1 + rate, t);
      npv += cashflows[t] / factor;
      dnpv -= t * cashflows[t] / (factor * (1 + rate));
    }
    return { npv, dnpv };
  }

  /** 二分法求解 IRR（牛顿法失败时的后备） */
  irrBisection(cashflows, precision) {
    let low = -0.1, high = 1.0;
    const npvLow = this.npvAndDerivative(cashflows, low).npv;
    const npvHigh = this.npvAndDerivative(cashflows, high).npv;

    if (npvLow * npvHigh > 0) return null; // 无解区间

    for (let i = 0; i < 500; i++) {
      const mid = (low + high) / 2;
      const npvMid = this.npvAndDerivative(cashflows, mid).npv;
      if (Math.abs(npvMid) < 0.01) return this.round2(mid * 100);
      if (npvMid * npvLow < 0) high = mid;
      else low = mid;
    }
    return null;
  }

  // ==================== 逐年现金流 ====================

  /**
   * 生成逐年现金流表
   * @returns {Object[]} 逐年现金流数组，每项包含年份、流入、流出、净现金流、累计净现金流
   */
  calculateCashFlow() {
    const baseResult = this.calculate();
    const p = this.params;
    const totalYears = p.buildYears + p.rentYears;
    const cashflowTable = [];
    let cumulativeCF = 0;

    for (let year = 0; year <= totalYears; year++) {
      let inflow = 0;
      let outflow = 0;

      if (year === 0) {
        // 建设期第0年：全部成本一次性投入（简化模型）
        outflow = baseResult.cost.totalCost;
      } else if (year < p.buildYears) {
        // 建设期中间年：无收入无支出（简化，成本已在第0年投入）
      } else if (year === p.buildYears) {
        // 建设期末：销售收入实现
        inflow = baseResult.income.aboveSalesIncome;
      } else {
        // 运营期第 y-buildYears 年：净租金收入
        const opYear = year - p.buildYears - 1;
        if (opYear >= 0 && opYear < p.rentYears) {
          const yearRent = baseResult.income.annualTotalRent * Math.pow(1 + p.rentGrowthRate, opYear);
          const netRent = yearRent * (1 - p.operatingCostRate - p.rentTaxRate);
          inflow = netRent;
          outflow = yearRent * (p.operatingCostRate + p.rentTaxRate); // 运营成本+税费
        }
      }

      const netCF = inflow - outflow;
      cumulativeCF += netCF;

      cashflowTable.push({
        year,
        phase: year < p.buildYears ? '建设期' : (year === p.buildYears ? '销售期' : '运营期'),
        inflow: this.roundWan(inflow),
        outflow: this.roundWan(outflow),
        netCashflow: this.roundWan(netCF),
        cumulativeCashflow: this.roundWan(cumulativeCF),
      });
    }

    return cashflowTable;
  }

  // ==================== 敏感性分析 ====================

  /**
   * 对关键变量进行扰动分析
   * @param {Object} options - 配置选项
   *   variables: 要分析的变量名数组（默认5个核心变量）
   *   perturbations: 扰动比例数组（默认 [-0.20, -0.10, 0, 0.10, 0.20]）
   * @returns {Object} 敏感性矩阵
   *   format: { variable: { perturbation: { netProfit, roi, feasibility, npvNetProfit } } }
   */
  sensitivityAnalysis(options = {}) {
    const variables = options.variables || ['salesPrice', 'rentPerDay', 'occupancyRate', 'aboveGroundUnitPrice', 'undergroundUnitPrice'];
    const perturbations = options.perturbations || [-0.20, -0.10, 0, 0.10, 0.20];

    // 基准值
    const baseResult = this.calculate();
    const matrix = {};

    for (const varName of variables) {
      matrix[varName] = {};
      const baseValue = this.params[varName];

      for (const pert of perturbations) {
        const perturbedValue = baseValue * (1 + pert);
        const perturbedParams = { ...this.params, [varName]: perturbedValue };

        // 对于比率类变量，扰动后需检查不越界
        if (['occupancyRate', 'parkingOccupancy', 'mgmtRate', 'marketingRate',
          'leasingRate', 'operatingCostRate', 'rentTaxRate', 'salesCostRate',
          'taxRate', 'financeRatio', 'financeInterestRate', 'discountRate'].includes(varName)) {
          if (perturbedValue < 0 || perturbedValue > 1) {
            matrix[varName][pert] = { skipped: true, reason: '扰动后越界（0-1）' };
            continue;
          }
        }

        try {
          const perturbedCalc = new UrbanRenewalCalculator(perturbedParams);
          const perturbedResult = perturbedCalc.calculate();

          matrix[varName][pert] = {
            perturbation: pert,
            perturbedValue: this.round2(perturbedValue),
            netProfit: perturbedResult.netProfit,
            roi: perturbedResult.metrics.roi,
            npvNetProfit: perturbedResult.metrics.npvNetProfit,
            feasibility: perturbedResult.feasibility,
            paybackPeriod: perturbedResult.metrics.paybackPeriod,
            // 变化量
            netProfitChange: this.roundWan(perturbedResult.netProfit - baseResult.netProfit),
            roiChange: this.round2(perturbedResult.metrics.roi - baseResult.metrics.roi),
          };
        } catch (e) {
          matrix[varName][pert] = { skipped: true, reason: e.message };
        }
      }
    }

    return {
      baseResult: {
        netProfit: baseResult.netProfit,
        roi: baseResult.metrics.roi,
        npvNetProfit: baseResult.metrics.npvNetProfit,
        feasibility: baseResult.feasibility,
      },
      matrix,
    };
  }

  // ==================== 内部工具方法 ====================

  /** 计算盈亏平衡出租率 */
  calculateBreakEvenOccupancy(p, aboveSalesIncome, totalCost, totalRentIncome,
    annualCommercialRentYear1, annualParkingRentYear1) {
    // 简化模型：净收益=0时
    // salesIncome + (rentArea * rent/day * 365 * x + parking * rent * 365 * x) * years * (1 - operatingCostRate - rentTaxRate) - totalCost = 0
    // 求x
    // annualCommercialRentYear1 和 annualParkingRentYear1 是第1年在当前出租率下的收入
    // 全容量（100%出租率）年收入 = 年收入 / 当前出租率
    const fullCapacityCommercial = p.occupancyRate > 0 ? annualCommercialRentYear1 / p.occupancyRate : annualCommercialRentYear1;
    const fullCapacityParking = p.parkingOccupancy > 0 ? annualParkingRentYear1 / p.parkingOccupancy : annualParkingRentYear1;
    const annualTotalBase = fullCapacityCommercial + fullCapacityParking; // 万元/年（全容量）

    // annualTotalBase * x * rentYears * (1 - operatingCostRate - rentTaxRate) + salesIncome - totalCost = 0
    // x = (totalCost - salesIncome) / (annualTotalBase * rentYears * (1 - operatingCostRate - rentTaxRate))
    const netRentFactor = annualTotalBase * p.rentYears * (1 - p.operatingCostRate - p.rentTaxRate);
    if (netRentFactor <= 0) return 0;
    const x = (totalCost - aboveSalesIncome) / netRentFactor;
    return Math.max(0, Math.min(1, x));
  }

  roundWan(value) { return Math.round(value); }
  round2(value) { return Math.round(value * 100) / 100; }
  round4(value) { return Math.round(value * 10000) / 10000; }

  // ==================== 报告生成 ====================

  generateReport(result) {
    const a = result.area;
    const i = result.income;
    const c = result.cost;
    const m = result.metrics;
    const fd = result.feasibilityDetail;
    const p = this.params;

    let report = `
=== 城市更新财务效益测算报告 ===

一、超配物业面积
  新建建筑面积：${a.totalNewArea.toLocaleString()}㎡（地上${a.aboveGroundNew.toLocaleString()}㎡ + 地下${a.undergroundNew.toLocaleString()}㎡）
  产权调换面积：${a.totalExchangeArea.toLocaleString()}㎡（1:${p.exchangeRatio}）
    - 地上产权调换：${a.aboveGroundExchange.toLocaleString()}㎡
    - 地下产权调换：${a.undergroundExchange.toLocaleString()}㎡
  超配物业面积：${a.totalSurplus.toLocaleString()}㎡
    - 地上超配：${a.aboveSurplus.toLocaleString()}㎡
    - 地下超配：${a.belowSurplus.toLocaleString()}㎡

二、超配物业收入（合计 ${i.totalIncome.toLocaleString()} 万元）
  1. 地上超配销售收入：${i.aboveSalesIncome.toLocaleString()} 万元
     可售面积：${i.aboveSalesArea.toLocaleString()}㎡，单价：${p.salesPrice.toLocaleString()}元/㎡
  2. 商业租金收入（${p.rentYears}年合计，年增长${(p.rentGrowthRate * 100).toFixed(1)}%）：${i.commercialRentIncome.toLocaleString()} 万元
     第1年化租金：${i.annualCommercialRent.toLocaleString()} 万元/年，面积：${i.commercialRentArea.toLocaleString()}㎡
     对比：不含增长${p.rentYears}年合计 ${i.totalRentIncomeFlat.toLocaleString()} 万元（差额说明增长影响）
  3. 车位租金收入（${p.rentYears}年合计）：${i.parkingIncome.toLocaleString()} 万元
     车位数：${i.parkingSpaces.toLocaleString()} 个，年化租金：${i.annualParkingRent.toLocaleString()} 万元/年

三、总成本费用（合计 ${c.totalCost.toLocaleString()} 万元）
  1. 补缴土地费：${c.landFeePayable.toLocaleString()} 万元${p.enableLandFeeDeduction ? '（代建成本抵扣政策已启用）' : ''}
  2. 前期费用：${c.prelimCost.toLocaleString()} 万元
  3. 建设投资：${c.totalBuildCost.toLocaleString()} 万元（地上${c.aboveBuildCost.toLocaleString()} + 地下${c.belowBuildCost.toLocaleString()}）
  4. 场地拆除：${c.demolitionCost.toLocaleString()} 万元
  5. 开发管理费（${(p.mgmtRate * 100).toFixed(1)}%）：${c.managementCost.toLocaleString()} 万元
  6. 营销费用（${(p.marketingRate * 100).toFixed(1)}%）：${c.marketingCost.toLocaleString()} 万元
  7. 招商费用（${(p.leasingRate * 100).toFixed(1)}%）：${c.leasingCost.toLocaleString()} 万元
  8. 物业销售成本（${(p.salesCostRate * 100).toFixed(1)}%）：${c.salesCost.toLocaleString()} 万元
  9. 销售税费（${(p.taxRate * 100).toFixed(1)}%）：${c.salesTax.toLocaleString()} 万元
  10. 租金税费（${(p.rentTaxRate * 100).toFixed(1)}%）：${c.rentTax.toLocaleString()} 万元
  11. 持有运营成本（${(p.operatingCostRate * 100).toFixed(1)}%）：${c.operatingCost.toLocaleString()} 万元
  12. 财务费用：${c.financeCost.toLocaleString()} 万元${c.financeCostMode === 'dynamic' ? `（动态计算：融资${(p.financeRatio*100).toFixed(0)}% × 利率${(p.financeInterestRate*100).toFixed(1)}% × ${p.buildYears}年）` : '（固定值）'}

四、财务指标
  ┌─────────────────────────────────────────────────────┐
  │ 总投资：${m.totalInvestment.toLocaleString()} 万元                              │
  │ 净收益（未折现）：${m.netProfit.toLocaleString()} 万元                           │
  │ 投资回报率（ROI）：${m.roi.toFixed(2)}%（行业基准 ≥ ${(p.minimumROI*100).toFixed(0)}%）        │
  │ 静态投资回收期：${m.paybackPeriod.toFixed(2)} 年（上限 ${p.maxPaybackYears} 年）              │
  │ 盈亏平衡销售单价：${m.breakEvenPrice.toFixed(0)} 元/㎡                          │
  │ 盈亏平衡出租率：${(m.breakEvenOccupancy * 100).toFixed(2)}%                       │
  ├─────────────────────────────────────────────────────┤
  │ 折现分析（折现率 ${(p.discountRate*100).toFixed(1)}%，建设期 ${p.buildYears} 年）           │
  │ 租金NPV：${m.npvRent.toLocaleString()} 万元                                │
  │ 销售收入NPV：${m.npvSales.toLocaleString()} 万元                             │
  │ NPV总收益：${m.npvTotalIncome.toLocaleString()} 万元                           │
  │ NPV净收益：${m.npvNetProfit.toLocaleString()} 万元                            │
  │ NPV-ROI：${m.npvROI.toFixed(2)}%                                     │
  └─────────────────────────────────────────────────────┘

五、可行性判断：${result.feasibility}
  ✓ 净收益 > 0：${fd.profitPositive ? '是' : '否'}
  ✓ ROI ≥ ${(p.minimumROI*100).toFixed(0)}%：${fd.roiAboveMinimum ? '是' : '否'}
  ✓ 回收期 ≤ ${p.maxPaybackYears}年：${fd.paybackWithinLimit ? '是' : '否'}
  ✓ NPV > 0：${fd.npvPositive ? '是' : '否'}`.trim();

    // 如果有IRR，追加
    try {
      const irr = this.calculateIRR();
      if (irr !== null) {
        report += `\n  IRR（内部收益率）：${irr.toFixed(2)}%`;
      }
    } catch (e) {
      // IRR 计算失败时不追加
    }

    return report;
  }

  /** 生成敏感性分析报告文本 */
  generateSensitivityReport(sensitivityResult) {
    const base = sensitivityResult.baseResult;
    const matrix = sensitivityResult.matrix;

    let report = `
=== 敏感性分析报告 ===

基准值：净收益 ${base.netProfit.toLocaleString()} 万元 | ROI ${base.roi.toFixed(2)}% | NPV净收益 ${base.npvNetProfit.toLocaleString()} 万元 | 可行性: ${base.feasibility}

┌───────────────────敏感性矩阵───────────────────┐`;

    for (const [varName, pertMap] of Object.entries(matrix)) {
      report += `\n\n变量: ${varName}`;
      report += `\n  扰动    | 净收益(万元) | ROI(%) | NPV净收益(万元) | 可行性 | 净收益变化`;
      report += `\n  --------|-------------|--------|----------------|--------|----------`;

      for (const [pert, data] of Object.entries(pertMap)) {
        if (data.skipped) {
          report += `\n  ${(pert * 100).toFixed(0)}%   | 跳过: ${data.reason}`;
        } else {
          report += `\n  ${(pert * 100).toFixed(0)}%   | ${data.netProfit.toLocaleString()}      | ${data.roi.toFixed(2)}  | ${data.npvNetProfit.toLocaleString()}        | ${data.feasibility}  | ${data.netProfitChange.toLocaleString()}`;
        }
      }
    }

    report += `\n└─────────────────────────────────────────────────┘`;
    return report.trim();
  }
}

// ==================== 便捷函数 ====================

function calculateFinancialPlan(params) {
  const calc = new UrbanRenewalCalculator(params);
  return calc.calculate();
}

function generateFinancialReport(params) {
  const calc = new UrbanRenewalCalculator(params);
  const result = calc.calculate();
  return calc.generateReport(result);
}

function validateFinancialParams(params) {
  return UrbanRenewalCalculator.validateParams(params);
}

function calculateIRR(params, precision, maxIterations) {
  const calc = new UrbanRenewalCalculator(params);
  return calc.calculateIRR(precision, maxIterations);
}

function calculateCashFlow(params) {
  const calc = new UrbanRenewalCalculator(params);
  return calc.calculateCashFlow();
}

function sensitivityAnalysis(params, options) {
  const calc = new UrbanRenewalCalculator(params);
  return calc.sensitivityAnalysis(options);
}

// ==================== 双环境导出 ====================

// Node.js 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    UrbanRenewalCalculator,
    calculateFinancialPlan,
    generateFinancialReport,
    validateFinancialParams,
    calculateIRR,
    calculateCashFlow,
    sensitivityAnalysis,
  };
}

// 浏览器/全局导出
if (typeof window !== 'undefined') {
  window.UrbanRenewalCalculator = UrbanRenewalCalculator;
  window.calculateFinancialPlan = calculateFinancialPlan;
  window.generateFinancialReport = generateFinancialReport;
  window.validateFinancialParams = validateFinancialParams;
  window.calculateIRR = calculateIRR;
  window.calculateCashFlow = calculateCashFlow;
  window.sensitivityAnalysis = sensitivityAnalysis;
}
