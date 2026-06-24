/**
 * 城市更新财务测算引擎 - 独立 API 服务
 * 端口号：默认 3000（可通过环境变量 PORT 修改）
 *
 * 启动方式：
 *   node api-server.js
 *   PORT=3001 node api-server.js
 *
 * 使用方式：
 *   其他项目通过 HTTP POST 调用，支持跨域 (CORS)
 */

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// 加载财务测算核心模块
const {
  UrbanRenewalCalculator,
  calculateFinancialPlan,
  generateFinancialReport,
  validateFinancialParams,
  calculateIRR,
  calculateCashFlow,
  sensitivityAnalysis,
} = require('./src/financial-calculator.js');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// CORS 头
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8',
};

// 成功响应
function success(res, data) {
  res.writeHead(200, CORS_HEADERS);
  res.end(JSON.stringify({ success: true, data }, null, 2));
}

// 错误响应
function error(res, message, statusCode = 400) {
  res.writeHead(statusCode, CORS_HEADERS);
  res.end(JSON.stringify({ success: false, error: message }, null, 2));
}

// 解析请求体
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON: ' + e.message));
      }
    });
  });
}

// 路由处理
const routes = {
  // 健康检查
  'GET /health': async (req, res) => {
    success(res, {
      status: 'ok',
      service: 'urban-renewal-financial-calculator',
      version: '2.0.0',
      port: PORT,
      uptime: process.uptime(),
    });
  },

  // 获取预设参数（大方案/中方案/默认）
  'GET /api/presets': async (req, res) => {
    success(res, {
      da: {
        originalArea: 56882,
        aboveGroundNew: 115312,
        undergroundNew: 60000,
        aboveGroundExchange: 65309,
        undergroundExchange: 2950,
        aboveGroundUnitPrice: 4300,
        undergroundUnitPrice: 6000,
        demolitionUnitPrice: 150,
        landPrice: 2500,
        enableLandFeeDeduction: true,
        salesPrice: 15000,
        aboveGroundSalesArea: 50003,
        commercialRentArea: 30000,
        rentPerDay: 2.5,
        rentYears: 18,
        occupancyRate: 0.9,
        parkingSpaces: 676,
        parkingAreaPerSpace: 84,
        parkingRent: 10,
        parkingOccupancy: 0.95,
        prelimUnitPrice: 100,
        mgmtRate: 0.02,
        marketingRate: 0.02,
        leasingRate: 0.10,
        rentTaxRate: 0.15,
        operatingCostRate: 0.15,
        salesCostRate: 0.05,
        taxRate: 0.035,
        financeCost: 6162,
      },
      zhong: {
        originalArea: 42791,
        aboveGroundNew: 74260,
        undergroundNew: 22400,
        aboveGroundExchange: 45589,
        undergroundExchange: 2950,
        aboveGroundUnitPrice: 4300,
        undergroundUnitPrice: 6000,
        demolitionUnitPrice: 150,
        landPrice: 2500,
        enableLandFeeDeduction: true,
        salesPrice: 15000,
        aboveGroundSalesArea: 22400,
        commercialRentArea: 5000,
        rentPerDay: 2.5,
        rentYears: 18,
        occupancyRate: 0.9,
        parkingSpaces: null,
        parkingAreaPerSpace: 84,
        parkingRent: 10,
        parkingOccupancy: 0.95,
        prelimUnitPrice: 100,
        mgmtRate: 0.02,
        marketingRate: 0.02,
        leasingRate: 0.10,
        rentTaxRate: 0.15,
        operatingCostRate: 0.15,
        salesCostRate: 0.05,
        taxRate: 0.035,
        financeCost: 3267,
      },
      default: {
        originalArea: 59224,
        aboveGroundNew: 99140,
        undergroundNew: 63000,
        exchangeRatio: 1.2,
        aboveGroundUnitPrice: 4300,
        undergroundUnitPrice: 6000,
        demolitionUnitPrice: 150,
        landPrice: 2500,
        salesPrice: 15000,
        commercialRentArea: 30000,
        rentPerDay: 2.5,
        rentYears: 18,
        occupancyRate: 0.9,
        parkingSpaces: 681,
        parkingRent: 10,
        parkingOccupancy: 0.95,
        prelimUnitPrice: 100,
        mgmtRate: 0.02,
        marketingRate: 0.02,
        leasingRate: 0.10,
        salesCostRate: 0.05,
        taxRate: 0.035,
        rentTaxRate: 0.15,
        operatingCostRate: 0.15,
        financeCost: 5791,
      },
    });
  },

  // 执行完整测算
  'POST /api/calculate': async (req, res) => {
    const params = await parseBody(req);
    const result = calculateFinancialPlan(params);
    success(res, result);
  },

  // 计算 IRR
  'POST /api/irr': async (req, res) => {
    const params = await parseBody(req);
    const irr = calculateIRR(params);
    success(res, { irr, params });
  },

  // 逐年现金流
  'POST /api/cashflow': async (req, res) => {
    const params = await parseBody(req);
    const cashflow = calculateCashFlow(params);
    success(res, cashflow);
  },

  // 敏感性分析
  'POST /api/sensitivity': async (req, res) => {
    const body = await parseBody(req);
    const { variables, perturbations, ...params } = body;
    const result = sensitivityAnalysis(params, {
      variables: variables || ['salesPrice', 'aboveGroundUnitPrice', 'rentPerDay', 'occupancyRate', 'landPrice'],
      perturbations: perturbations || [-0.20, -0.10, 0, 0.10, 0.20],
    });
    success(res, result);
  },

  // 参数校验
  'POST /api/validate': async (req, res) => {
    const params = await parseBody(req);
    const validation = validateFinancialParams(params);
    success(res, validation);
  },

  // 生成文本报告
  'POST /api/report': async (req, res) => {
    const params = await parseBody(req);
    const report = generateFinancialReport(params);
    success(res, { report, params });
  },

  // 获取所有参数默认值（方便前端初始化表单）
  'GET /api/defaults': async (req, res) => {
    const calc = new UrbanRenewalCalculator({});
    success(res, calc.params);
  },
};

// 创建服务器
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const routeKey = `${req.method} ${parsed.pathname}`;

  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // 查找路由
  const handler = routes[routeKey];
  if (!handler) {
    // 如果是根路径，返回 API 文档
    if (parsed.pathname === '/' && req.method === 'GET') {
      res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getAPIDocs());
      return;
    }

    // 尝试返回静态文件（测试页面）
    if (parsed.pathname === '/test.html' && req.method === 'GET') {
      res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getTestPage());
      return;
    }

    return error(res, `Route not found: ${routeKey}`, 404);
  }

  try {
    await handler(req, res);
  } catch (err) {
    console.error('[Error]', err);
    error(res, err.message, 500);
  }
});

// 启动
server.listen(PORT, HOST, () => {
  console.log(`\n========================================`);
  console.log(`  城市更新财务测算引擎 - API 服务`);
  console.log(`  v2.0.0`);
  console.log(`========================================`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  测试页面: http://localhost:${PORT}/test.html`);
  console.log(`  API 文档: http://localhost:${PORT}/`);
  console.log(`  跨域支持: 已启用 (CORS)`);
  console.log(`========================================\n`);
  console.log('可用接口:');
  console.log('  GET  /health           - 健康检查');
  console.log('  GET  /api/presets      - 获取预设参数（大方案/中方案/默认）');
  console.log('  GET  /api/defaults     - 获取所有参数默认值');
  console.log('  POST /api/calculate    - 执行完整测算');
  console.log('  POST /api/irr          - 计算 IRR');
  console.log('  POST /api/cashflow     - 逐年现金流');
  console.log('  POST /api/sensitivity  - 敏感性分析');
  console.log('  POST /api/validate     - 参数校验');
  console.log('  POST /api/report       - 生成文本报告');
  console.log('========================================\n');
  console.log('按 Ctrl+C 停止服务\n');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n[Server] 正在关闭...');
  server.close(() => {
    console.log('[Server] 已关闭');
    process.exit(0);
  });
});

// API 文档 HTML
function getAPIDocs() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>城市更新财务测算引擎 API</title>
<style>
  body { font-family: 'Microsoft YaHei', sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; background: #f5f7fa; color: #333; }
  h1 { color: #1a56db; border-bottom: 3px solid #1a56db; padding-bottom: 10px; }
  h2 { color: #2d3748; margin-top: 30px; }
  .endpoint { background: #fff; border-radius: 8px; padding: 16px 20px; margin: 12px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .method { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 13px; margin-right: 8px; }
  .get { background: #10b981; color: #fff; }
  .post { background: #3b82f6; color: #fff; }
  .path { font-family: 'Consolas', monospace; font-size: 15px; color: #1a56db; }
  .desc { color: #718096; font-size: 14px; margin-top: 6px; }
  .example { background: #1a202c; color: #e2e8f0; padding: 12px 16px; border-radius: 6px; overflow-x: auto; font-size: 13px; margin-top: 8px; }
  .note { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 16px 0; border-radius: 4px; }
</style>
</head>
<body>
<h1>🏗️ 城市更新财务测算引擎 API</h1>
<p>版本 2.0.0 | 零依赖 Node.js 服务 | 支持 CORS 跨域</p>

<div class="note">
  <strong>快速开始：</strong>打开浏览器的开发者工具（F12 → Console），直接复制下面的示例代码运行。
</div>

<h2>🔍 查询接口</h2>

<div class="endpoint">
  <span class="method get">GET</span>
  <span class="path">/health</span>
  <div class="desc">健康检查，返回服务状态</div>
</div>

<div class="endpoint">
  <span class="method get">GET</span>
  <span class="path">/api/presets</span>
  <div class="desc">获取预设参数（大方案/中方案/默认）</div>
</div>

<div class="endpoint">
  <span class="method get">GET</span>
  <span class="path">/api/defaults</span>
  <div class="desc">获取所有参数默认值，用于表单初始化</div>
</div>

<h2>🧮 计算接口</h2>

<div class="endpoint">
  <span class="method post">POST</span>
  <span class="path">/api/calculate</span>
  <div class="desc">执行完整财务测算，返回面积、收入、成本、指标、可行性</div>
  <div class="example">fetch('http://localhost:${PORT}/api/calculate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    originalArea: 56882,
    aboveGroundNew: 115312,
    undergroundNew: 60000,
    salesPrice: 15000
  })
})
.then(r => r.json())
.then(console.log);</div>
</div>

<div class="endpoint">
  <span class="method post">POST</span>
  <span class="path">/api/irr</span>
  <div class="desc">计算内部收益率（IRR）</div>
</div>

<div class="endpoint">
  <span class="method post">POST</span>
  <span class="path">/api/cashflow</span>
  <div class="desc">逐年现金流表（建设期 + 运营期）</div>
</div>

<div class="endpoint">
  <span class="method post">POST</span>
  <span class="path">/api/sensitivity</span>
  <div class="desc">敏感性分析（5变量×5扰动水平）</div>
  <div class="example">body: {
  "salesPrice": 15000,
  "variables": ["salesPrice", "rentPerDay"],
  "perturbations": [-0.2, -0.1, 0, 0.1, 0.2]
}</div>
</div>

<div class="endpoint">
  <span class="method post">POST</span>
  <span class="path">/api/validate</span>
  <div class="desc">参数校验，返回是否合法及错误信息</div>
</div>

<div class="endpoint">
  <span class="method post">POST</span>
  <span class="path">/api/report</span>
  <div class="desc">生成文本报告，适合打印或导出</div>
</div>

<h2>🧪 测试</h2>
<p><a href="/test.html">点击这里打开交互式测试页面</a></p>

<h2>📚 参数说明</h2>
<p>完整参数列表请参考 <a href="https://github.com/James-hu-pro/urban_renewal_financial_calculator" target="_blank">GitHub 仓库</a> 的 README.md</p>
</body>
</html>`;
}

// 交互式测试页面
function getTestPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>财务测算引擎 - 交互测试</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; background: #f0f4f8; color: #1a202c; line-height: 1.6; }
  .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
  h1 { color: #1a56db; font-size: 24px; margin-bottom: 8px; }
  .subtitle { color: #718096; font-size: 14px; margin-bottom: 24px; }

  /* 输入面板 */
  .panel { background: #fff; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  .panel-title { font-size: 16px; font-weight: 600; color: #2d3748; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
  .panel-title:first-child { margin-top: 0; }
  .panel-section { background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
  .form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
  .form-field { display: flex; flex-direction: column; gap: 6px; }
  .form-field label { font-size: 13px; color: #64748b; font-weight: 500; }
  .form-field input { padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; transition: all 0.2s; }
  .form-field input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
  .btn-group { display: flex; gap: 12px; margin-top: 20px; flex-wrap: wrap; }
  button { padding: 12px 24px; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; transition: all 0.2s; font-weight: 500; }
  .btn-primary { background: #1a56db; color: #fff; }
  .btn-primary:hover { background: #1e40af; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(26,86,219,0.3); }
  .btn-secondary { background: #e2e8f0; color: #334155; }
  .btn-secondary:hover { background: #cbd5e0; }
  .btn-green { background: #10b981; color: #fff; }
  .btn-green:hover { background: #059669; }

  /* 结果面板 */
  .result-section { display: none; }
  .result-section.active { display: block; }

  /* 指标卡片 */
  .metric-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .metric-card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); border-left: 4px solid #3b82f6; transition: transform 0.2s; }
  .metric-card:hover { transform: translateY(-2px); box-shadow: 0 4px 20px rgba(0,0,0,0.12); }
  .metric-card.success { border-left-color: #10b981; }
  .metric-card.warning { border-left-color: #f59e0b; }
  .metric-card.danger { border-left-color: #ef4444; }
  .metric-card.info { border-left-color: #3b82f6; }
  .metric-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .metric-value { font-size: 28px; font-weight: 700; color: #1a202c; }
  .metric-value.positive { color: #10b981; }
  .metric-value.negative { color: #ef4444; }
  .metric-value.warning { color: #f59e0b; }
  .metric-unit { font-size: 14px; color: #718096; margin-left: 4px; }
  .metric-desc { font-size: 12px; color: #94a3b8; margin-top: 4px; }

  /* 表格 */
  .table-card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); margin-bottom: 20px; }
  .table-title { font-size: 15px; font-weight: 600; color: #2d3748; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 10px 12px; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0; }
  td { padding: 10px 12px; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
  tr:hover td { background: #f8fafc; }
  .td-num { font-family: 'Consolas', monospace; text-align: right; font-weight: 500; }
  .td-unit { color: #94a3b8; font-size: 12px; }
  .td-positive { color: #10b981; }
  .td-negative { color: #ef4444; }

  /* 可行性状态 */
  .feasibility-banner { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 20px 24px; border-radius: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
  .feasibility-banner.success { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
  .feasibility-banner.warning { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
  .feasibility-banner.danger { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
  .feasibility-title { font-size: 18px; font-weight: 600; }
  .feasibility-detail { font-size: 13px; opacity: 0.9; margin-top: 4px; }
  .feasibility-icon { font-size: 32px; }

  /* 标签 */
  .tag { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; }
  .tag-success { background: #d1fae5; color: #065f46; }
  .tag-warning { background: #fef3c7; color: #92400e; }
  .tag-danger { background: #fee2e2; color: #991b1b; }
  .tag-info { background: #dbeafe; color: #1e40af; }

  /* 加载状态 */
  .loading { text-align: center; padding: 40px; color: #3b82f6; }
  .loading-spinner { width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* JSON 查看器 */
  .json-viewer { background: #1a202c; color: #e2e8f0; padding: 16px; border-radius: 8px; font-size: 13px; overflow-x: auto; font-family: 'Consolas', monospace; max-height: 400px; overflow-y: auto; }
  .json-toggle { color: #3b82f6; cursor: pointer; font-size: 13px; margin-top: 12px; display: inline-block; }
  .json-toggle:hover { text-decoration: underline; }
  .json-section { display: none; }
  .json-section.show { display: block; }

  /* 响应式 */
  @media (max-width: 768px) {
    .form-grid { grid-template-columns: 1fr; }
    .metric-cards { grid-template-columns: 1fr 1fr; }
  }
</style>
</head>
<body>
<div class="container">
  <h1>🏗️ 城市更新财务测算引擎</h1>
  <p class="subtitle">版本 2.0.0 | API 服务: http://localhost:${PORT}</p>

  <!-- 输入面板：分类展示 -->
  <div class="panel">
    
    <!-- 建设参数 -->
    <div class="panel-title">🏗️ 建设参数</div>
    <div class="form-grid">
      <div class="form-field"><label>原产权面积 (㎡)</label><input type="number" id="originalArea" value="56882"></div>
      <div class="form-field"><label>地上新建面积 (㎡)</label><input type="number" id="aboveGroundNew" value="115312"></div>
      <div class="form-field"><label>地下新建面积 (㎡)</label><input type="number" id="undergroundNew" value="60000"></div>
      <div class="form-field"><label>建设周期 (年)</label><input type="number" id="buildYears" value="3"></div>
    </div>
    
    <!-- 单价参数 -->
    <div class="panel-title" style="margin-top:24px">💰 单价参数</div>
    <div class="form-grid">
      <div class="form-field"><label>代建单价 (元/㎡)</label><input type="number" id="aboveGroundUnitPrice" value="4300"></div>
      <div class="form-field"><label>地下代建单价 (元/㎡)</label><input type="number" id="undergroundUnitPrice" value="6000"></div>
      <div class="form-field"><label>土地单价 (元/㎡)</label><input type="number" id="landPrice" value="2500"></div>
      <div class="form-field"><label>前期费单价 (元/㎡)</label><input type="number" id="prelimUnitPrice" value="100"></div>
    </div>
    
    <!-- 收入参数 -->
    <div class="panel-title" style="margin-top:24px">📈 收入参数</div>
    <div class="form-grid">
      <div class="form-field"><label>销售单价 (元/㎡)</label><input type="number" id="salesPrice" value="15000"></div>
      <div class="form-field"><label>日租金 (元/㎡/天)</label><input type="number" id="rentPerDay" value="2.5" step="0.1"></div>
      <div class="form-field"><label>出租率</label><input type="number" id="occupancyRate" value="0.9" step="0.05"></div>
      <div class="form-field"><label>商业出租面积 (㎡)</label><input type="number" id="commercialRentArea" value="30000"></div>
      <div class="form-field"><label>车位数</label><input type="number" id="parkingSpaces" value="676"></div>
      <div class="form-field"><label>车位月租金 (元)</label><input type="number" id="parkingRent" value="10"></div>
    </div>
    
    <!-- 费率参数 -->
    <div class="panel-title" style="margin-top:24px">📊 费率参数</div>
    <div class="form-grid">
      <div class="form-field"><label>管理费率</label><input type="number" id="mgmtRate" value="0.02" step="0.01"></div>
      <div class="form-field"><label>营销费率</label><input type="number" id="marketingRate" value="0.02" step="0.01"></div>
      <div class="form-field"><label>租赁费率</label><input type="number" id="leasingRate" value="0.10" step="0.05"></div>
      <div class="form-field"><label>销售成本费率</label><input type="number" id="salesCostRate" value="0.05" step="0.01"></div>
      <div class="form-field"><label>销售税率</label><input type="number" id="taxRate" value="0.035" step="0.005"></div>
      <div class="form-field"><label>租金税率</label><input type="number" id="rentTaxRate" value="0.15" step="0.05"></div>
      <div class="form-field"><label>运营费率</label><input type="number" id="operatingCostRate" value="0.15" step="0.05"></div>
      <div class="form-field"><label>财务费用 (万元)</label><input type="number" id="financeCost" value="0"></div>
    </div>
    
    <!-- 财务参数 -->
    <div class="panel-title" style="margin-top:24px">🧮 财务参数</div>
    <div class="form-grid">
      <div class="form-field"><label>折现率</label><input type="number" id="discountRate" value="0.08" step="0.01"></div>
      <div class="form-field"><label>租金年增长率</label><input type="number" id="rentGrowthRate" value="0.03" step="0.01"></div>
    </div>
    
    <div class="btn-group" style="margin-top:24px">
      <button class="btn-primary" onclick="callAPI('calculate')">🧮 执行测算</button>
      <button class="btn-secondary" onclick="loadPreset('da')">📋 大方案</button>
      <button class="btn-secondary" onclick="loadPreset('zhong')">📋 中方案</button>
      <button class="btn-green" onclick="callAPI('irr')">📈 计算IRR</button>
      <button class="btn-secondary" onclick="callAPI('cashflow')">💰 现金流</button>
      <button class="btn-secondary" onclick="callAPI('sensitivity')">📊 敏感性</button>
    </div>
  </div>

  <!-- 加载状态 -->
  <div id="loading" class="loading" style="display:none;">
    <div class="loading-spinner"></div>
    <div>正在计算中，请稍候...</div>
  </div>

  <!-- 结果展示区域 -->
  <div id="result" class="result-section">
    <!-- 可行性横幅 -->
    <div id="feasibility-banner" class="feasibility-banner"></div>

    <!-- 核心指标卡片 -->
    <div class="metric-cards" id="metric-cards"></div>

    <!-- 面积数据 -->
    <div class="table-card">
      <div class="table-title">📐 面积分析</div>
      <table id="area-table"></table>
    </div>

    <!-- 收入数据 -->
    <div class="table-card">
      <div class="table-title">💵 收入分析</div>
      <table id="income-table"></table>
    </div>

    <!-- 成本数据 -->
    <div class="table-card">
      <div class="table-title">💸 成本分析</div>
      <table id="cost-table"></table>
    </div>

    <!-- 财务指标 -->
    <div class="table-card">
      <div class="table-title">📊 财务指标</div>
      <table id="metrics-table"></table>
    </div>

    <!-- 原始 JSON -->
    <div class="json-toggle" onclick="toggleJson()">🔧 查看原始 JSON 数据</div>
    <div id="json-section" class="json-section">
      <div class="json-viewer" id="json-output"></div>
    </div>
  </div>
</div>

<script>
const API_BASE = '';

function getParams() {
  const ids = ['originalArea','aboveGroundNew','undergroundNew','salesPrice','rentPerDay',
    'occupancyRate','commercialRentArea','aboveGroundUnitPrice','undergroundUnitPrice',
    'parkingSpaces','parkingRent','landPrice',
    'prelimUnitPrice','mgmtRate','marketingRate','leasingRate','salesCostRate',
    'taxRate','rentTaxRate','operatingCostRate','financeCost','discountRate','rentGrowthRate','buildYears'];
  const params = {};
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) params[id] = parseFloat(el.value) || 0;
  });
  return params;
}

async function callAPI(endpoint) {
  const loading = document.getElementById('loading');
  const result = document.getElementById('result');
  loading.style.display = 'block';
  result.classList.remove('active');

  try {
    const response = await fetch(API_BASE + '/api/' + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getParams()),
    });
    const json = await response.json();
    loading.style.display = 'none';

    if (json.success) {
      if (endpoint === 'calculate') {
        renderResult(json.data);
      } else if (endpoint === 'irr') {
        alert('IRR = ' + (json.data.irr !== null ? json.data.irr.toFixed(2) + '%' : '无法计算'));
      } else if (endpoint === 'cashflow') {
        showCashFlow(json.data);
      } else if (endpoint === 'sensitivity') {
        showSensitivity(json.data);
      }
    } else {
      alert('错误: ' + json.error);
    }
  } catch (err) {
    loading.style.display = 'none';
    alert('请求失败: ' + err.message);
  }
}

function renderResult(data) {
  const result = document.getElementById('result');
  result.classList.add('active');

  // 可行性横幅
  const fb = document.getElementById('feasibility-banner');
  const f = data.feasibility || '未评估';
  const fd = data.feasibilityDetail || {};
  let fbClass = 'info';
  let fbIcon = '⏳';
  if (f.includes('可行')) { fbClass = 'success'; fbIcon = '✅'; }
  else if (f.includes('风险') || f.includes('关注')) { fbClass = 'warning'; fbIcon = '⚠️'; }
  else { fbClass = 'danger'; fbIcon = '❌'; }
  fb.className = 'feasibility-banner ' + fbClass;
  fb.innerHTML = '<div><div class="feasibility-title">' + fbIcon + ' ' + f + '</div><div class="feasibility-detail">' +
    '利润: ' + (fd.profitPositive ? '✅' : '❌') + ' | ' +
    'ROI达标: ' + (fd.roiAboveMinimum ? '✅' : '❌') + ' | ' +
    '回收期合理: ' + (fd.paybackWithinLimit ? '✅' : '❌') + ' | ' +
    'NPV为正: ' + (fd.npvPositive ? '✅' : '❌') +
    '</div></div>';

  // 核心指标卡片
  const m = data.metrics || {};
  const cards = [
    { label: '净收益', value: data.netProfit, unit: '万元', positive: data.netProfit >= 0, key: 'netProfit' },
    { label: 'ROI', value: m.roi, unit: '%', positive: m.roi >= 8, key: 'roi' },
    { label: 'IRR', value: m.irr !== undefined ? m.irr : '--', unit: '%', positive: m.irr >= 8, key: 'irr' },
    { label: 'NPV', value: m.npvNetProfit, unit: '万元', positive: m.npvNetProfit >= 0, key: 'npv' },
    { label: '总投资', value: m.totalInvestment, unit: '万元', positive: true, key: 'investment' },
    { label: '回收期', value: m.paybackPeriod, unit: '年', positive: m.paybackPeriod <= 15, key: 'payback' },
    { label: '盈亏平衡单价', value: m.breakEvenPrice, unit: '元/㎡', positive: true, key: 'breakeven' },
    { label: '总收入', value: data.income.totalIncome, unit: '万元', positive: true, key: 'income' },
  ];
  document.getElementById('metric-cards').innerHTML = cards.map(c => {
    const v = typeof c.value === 'number' ? c.value.toLocaleString() : c.value;
    const valClass = typeof c.value === 'number' ? (c.positive ? 'positive' : 'negative') : '';
    const cardClass = typeof c.value === 'number' ? (c.positive ? 'success' : 'danger') : 'info';
    return '<div class="metric-card ' + cardClass + '"><div class="metric-label">' + c.label + '</div>' +
      '<div class="metric-value ' + valClass + '">' + v + '<span class="metric-unit">' + c.unit + '</span></div></div>';
  }).join('');

  // 面积表格
  const a = data.area || {};
  renderTable('area-table', [
    ['原产权面积', a.originalArea, '㎡'],
    ['地上新建面积', a.aboveGroundNew, '㎡'],
    ['地下新建面积', a.undergroundNew, '㎡'],
    ['总新建面积', a.totalNewArea, '㎡'],
    ['总产权调换面积', a.totalExchangeArea, '㎡'],
    ['地上超配面积', a.aboveSurplus, '㎡'],
    ['地下超配面积', a.belowSurplus, '㎡'],
    ['总超配面积', a.totalSurplus, '㎡'],
  ]);

  // 收入表格
  const i = data.income || {};
  renderTable('income-table', [
    ['销售收入', i.aboveSalesIncome, '万元'],
    ['商业租金收入', i.commercialRentIncome, '万元'],
    ['车位租金收入', i.parkingIncome, '万元'],
    ['总租金收入', i.totalRentIncome, '万元'],
    ['总收入', i.totalIncome, '万元'],
  ], true);

  // 成本表格
  const c = data.cost || {};
  renderTable('cost-table', [
    ['土地费补缴', c.landFeePayable, '万元'],
    ['代建成本', c.totalBuildCost, '万元'],
    ['拆除费', c.demolitionCost, '万元'],
    ['前期费', c.prelimCost, '万元'],
    ['管理费', c.managementCost, '万元'],
    ['营销费', c.marketingCost, '万元'],
    ['销售费', c.salesCost, '万元'],
    ['销售税费', c.salesTax, '万元'],
    ['租金税费', c.rentTax, '万元'],
    ['运营费', c.operatingCost, '万元'],
    ['财务费', c.financeCost, '万元'],
    ['总成本', c.totalCost, '万元'],
  ], true);

  // 财务指标表格
  renderTable('metrics-table', [
    ['总投资', m.totalInvestment, '万元'],
    ['净收益', m.netProfit, '万元'],
    ['ROI', m.roi, '%'],
    ['IRR', m.irr !== undefined ? m.irr : '--', '%'],
    ['NPV', m.npvNetProfit, '万元'],
    ['静态回收期', m.paybackPeriod, '年'],
    ['盈亏平衡单价', m.breakEvenPrice, '元/㎡'],
    ['盈亏平衡出租率', m.breakEvenOccupancy, ''],
    ['折现率', (m.discountRate * 100).toFixed(1), '%'],
    ['租金增长率', (m.rentGrowthRate * 100).toFixed(1), '%'],
  ]);

  // JSON 输出
  document.getElementById('json-output').textContent = JSON.stringify(data, null, 2);
}

function renderTable(tableId, rows, highlightTotal) {
  const html = '<thead><tr><th>项目</th><th style="text-align:right">金额</th><th>单位</th></tr></thead><tbody>' +
    rows.map((row, idx) => {
      const isNum = typeof row[1] === 'number';
      const val = isNum ? row[1].toLocaleString() : row[1];
      const valClass = isNum && row[1] > 0 ? 'td-positive' : '';
      const isTotal = highlightTotal && idx === rows.length - 1;
      return '<tr style="' + (isTotal ? 'font-weight:600;background:#f8fafc' : '') + '"><td>' + row[0] + '</td>' +
        '<td class="td-num ' + valClass + '">' + val + '</td><td class="td-unit">' + row[2] + '</td></tr>';
    }).join('') + '</tbody>';
  document.getElementById(tableId).innerHTML = html;
}

function showCashFlow(data) {
  const result = document.getElementById('result');
  result.classList.add('active');
  document.getElementById('feasibility-banner').style.display = 'none';
  document.getElementById('metric-cards').innerHTML = '';
  document.getElementById('area-table').innerHTML = '<tr><td>逐年现金流数据已生成，请查看 JSON 输出</td></tr>';
  document.getElementById('income-table').innerHTML = '';
  document.getElementById('cost-table').innerHTML = '';
  document.getElementById('metrics-table').innerHTML = '';
  document.getElementById('json-output').textContent = JSON.stringify(data, null, 2);
  document.getElementById('json-section').classList.add('show');
}

function showSensitivity(data) {
  const result = document.getElementById('result');
  result.classList.add('active');
  document.getElementById('feasibility-banner').style.display = 'none';
  document.getElementById('metric-cards').innerHTML = '';
  document.getElementById('area-table').innerHTML = '<tr><td>敏感性分析数据已生成，请查看 JSON 输出</td></tr>';
  document.getElementById('income-table').innerHTML = '';
  document.getElementById('cost-table').innerHTML = '';
  document.getElementById('metrics-table').innerHTML = '';
  document.getElementById('json-output').textContent = JSON.stringify(data, null, 2);
  document.getElementById('json-section').classList.add('show');
}

function toggleJson() {
  document.getElementById('json-section').classList.toggle('show');
}

async function loadPreset(name) {
  try {
    const response = await fetch(API_BASE + '/api/presets');
    const json = await response.json();
    if (json.success && json.data[name]) {
      const p = json.data[name];
      document.getElementById('originalArea').value = p.originalArea || '';
      document.getElementById('aboveGroundNew').value = p.aboveGroundNew || '';
      document.getElementById('undergroundNew').value = p.undergroundNew || '';
      document.getElementById('salesPrice').value = p.salesPrice || '';
      document.getElementById('rentPerDay').value = p.rentPerDay || '';
      document.getElementById('occupancyRate').value = p.occupancyRate || '';
      document.getElementById('commercialRentArea').value = p.commercialRentArea || '';
      document.getElementById('aboveGroundUnitPrice').value = p.aboveGroundUnitPrice || '';
      document.getElementById('undergroundUnitPrice').value = p.undergroundUnitPrice || '';
      document.getElementById('parkingSpaces').value = p.parkingSpaces || '';
      document.getElementById('parkingRent').value = p.parkingRent || '';
      document.getElementById('landPrice').value = p.landPrice || '';
      callAPI('calculate');
    }
  } catch (err) {
    console.error(err);
  }
}
</script>
</body>
</html>`;
}
