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
<title>财务测算引擎 - 测试</title>
<style>
  body { font-family: 'Microsoft YaHei', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; background: #f0f4f8; }
  h1 { color: #1a56db; }
  .panel { background: #fff; border-radius: 12px; padding: 24px; margin: 16px 0; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  .form-row { display: flex; gap: 16px; margin: 12px 0; flex-wrap: wrap; }
  .form-field { flex: 1; min-width: 200px; }
  label { display: block; font-size: 13px; color: #64748b; margin-bottom: 4px; }
  input { width: 100%; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
  button { padding: 12px 24px; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; transition: all 0.2s; }
  .btn-primary { background: #1a56db; color: #fff; }
  .btn-primary:hover { background: #1e40af; }
  .btn-secondary { background: #e2e8f0; color: #334155; margin-left: 8px; }
  .result { background: #1a202c; color: #e2e8f0; padding: 16px; border-radius: 8px; font-size: 13px; overflow-x: auto; margin-top: 16px; white-space: pre-wrap; }
  .loading { color: #3b82f6; }
  .error { color: #ef4444; }
  .success { color: #10b981; }
  .tabs { display: flex; gap: 8px; margin-bottom: 16px; }
  .tab { padding: 8px 16px; border-radius: 6px; cursor: pointer; background: #e2e8f0; color: #64748b; }
  .tab.active { background: #1a56db; color: #fff; }
</style>
</head>
<body>
<h1>🏗️ 财务测算引擎 - 交互测试</h1>

<div class="panel">
  <div class="tabs">
    <div class="tab active" onclick="switchTab('calculate')">完整测算</div>
    <div class="tab" onclick="switchTab('irr')">IRR</div>
    <div class="tab" onclick="switchTab('cashflow')">现金流</div>
    <div class="tab" onclick="switchTab('sensitivity')">敏感性</div>
    <div class="tab" onclick="switchTab('validate')">校验</div>
  </div>

  <div class="form-row">
    <div class="form-field">
      <label>原产权面积 (㎡)</label>
      <input type="number" id="originalArea" value="56882">
    </div>
    <div class="form-field">
      <label>地上新建面积 (㎡)</label>
      <input type="number" id="aboveGroundNew" value="115312">
    </div>
    <div class="form-field">
      <label>地下新建面积 (㎡)</label>
      <input type="number" id="undergroundNew" value="60000">
    </div>
  </div>

  <div class="form-row">
    <div class="form-field">
      <label>销售单价 (元/㎡)</label>
      <input type="number" id="salesPrice" value="15000">
    </div>
    <div class="form-field">
      <label>日租金 (元/㎡/天)</label>
      <input type="number" id="rentPerDay" value="2.5" step="0.1">
    </div>
    <div class="form-field">
      <label>出租率</label>
      <input type="number" id="occupancyRate" value="0.9" step="0.05">
    </div>
  </div>

  <div style="margin-top: 16px;">
    <button class="btn-primary" onclick="callAPI('calculate')">🧮 执行测算</button>
    <button class="btn-secondary" onclick="loadPreset('da')">📋 大方案</button>
    <button class="btn-secondary" onclick="loadPreset('zhong')">📋 中方案</button>
  </div>

  <div id="output" class="result" style="display:none;"></div>
</div>

<script>
const API_BASE = '';
let currentTab = 'calculate';

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
}

function getParams() {
  return {
    originalArea: parseFloat(document.getElementById('originalArea').value) || 0,
    aboveGroundNew: parseFloat(document.getElementById('aboveGroundNew').value) || 0,
    undergroundNew: parseFloat(document.getElementById('undergroundNew').value) || 0,
    salesPrice: parseFloat(document.getElementById('salesPrice').value) || 0,
    rentPerDay: parseFloat(document.getElementById('rentPerDay').value) || 0,
    occupancyRate: parseFloat(document.getElementById('occupancyRate').value) || 0,
  };
}

async function callAPI(endpoint) {
  const output = document.getElementById('output');
  output.style.display = 'block';
  output.textContent = '⏳ 计算中...';
  output.className = 'result loading';

  try {
    const response = await fetch(API_BASE + '/api/' + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getParams()),
    });
    const data = await response.json();
    output.textContent = JSON.stringify(data, null, 2);
    output.className = data.success ? 'result success' : 'result error';
  } catch (err) {
    output.textContent = '❌ 错误: ' + err.message;
    output.className = 'result error';
  }
}

async function loadPreset(name) {
  try {
    const response = await fetch(API_BASE + '/api/presets');
    const data = await response.json();
    if (data.success && data.data[name]) {
      const p = data.data[name];
      document.getElementById('originalArea').value = p.originalArea;
      document.getElementById('aboveGroundNew').value = p.aboveGroundNew;
      document.getElementById('undergroundNew').value = p.undergroundNew;
      document.getElementById('salesPrice').value = p.salesPrice;
      document.getElementById('rentPerDay').value = p.rentPerDay;
      document.getElementById('occupancyRate').value = p.occupancyRate;
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
