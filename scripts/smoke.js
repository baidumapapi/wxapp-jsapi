/**
 * 冒烟测试（黑盒：一律通过公开 API + 捕获请求来断言行为）
 *
 * 覆盖两类内容：
 * 1. 本地用例（不依赖网络）：SN 签名、坐标转换、路线解析、畸形响应兜底、必填校验
 * 2. 真实接口用例（需环境变量 BMAP_AK）：search / suggestion / reverseGeocoding /
 *    geocoding / driving / walking / riding / transit 共 8 项
 *    （weather 2020-09 起平台限制，不在自动化范围）
 *
 * 运行：
 *   npm test              # 仅本地用例
 *   BMAP_AK=<ak> npm test # 本地 + 真实接口（ak 只存在于本次命令，不落盘）
 */
const crypto = require('crypto');
const assert = require('assert');
const https = require('https');
const { BMapWX } = require('../src/bmap-wx.js');

const AK = process.env.BMAP_AK || '';
const cases = [];
const test = (name, fn) => cases.push({ name, fn });
let passed = 0;

/** 拦截 wx.request：记录最后一次请求的 url/data，可按需回放或假响应 */
function captureStub(reply) {
  global.wx = {
    request: opt => {
      global.__lastUrl = opt.url;
      global.__lastData = opt.data;
      const payload = reply || { statusCode: 200, data: { status: 0, results: [] } };
      setTimeout(() => opt.success(payload), 0);
    },
  };
}

/** 官方 SN 规则重算（与 SDK 实现一致的独立参考实现） */
function expectSn(data, sk) {
  const clean = {};
  Object.keys(data).forEach(k => {
    if (k === 'sn' || k === 'timestamp') { return; }
    if (data[k] === '' || data[k] == null) { return; }
    clean[k] = data[k];
  });
  const query = Object.keys(clean).sort()
    .map(k => `${k}=${encodeURIComponent(clean[k])}`)
    .join('&');
  return crypto.createHash('md5').update(query + sk).digest('hex');
}

function replyRoute(paths) {
  return {
    statusCode: 200,
    data: {
      status: 0,
      result: {
        routes: [{
          distance: 1000,
          duration: 120,
          steps: paths,
        }],
      },
    },
  };
}

/* ---------------- 本地用例（黑盒：捕获请求断言） ---------------- */

test('SN 签名：配置 sk 后请求携带 ak+sn，sn 与官方算法一致', async () => {
  captureStub();
  const b = new BMapWX({ ak: 'MYAK', sk: 'MYSK' });
  await new Promise(resolve => {
    b.search({ query: '北京站', location: '39.9,116.4', success: resolve, fail: resolve });
  });
  const data = global.__lastData;
  assert.ok(data.ak === 'MYAK', 'ak 必须随请求携带');
  assert.ok(data.sn, '必须有 sn');
  assert.strictEqual(data.sn, expectSn(data, 'MYSK'), 'sn 算法与官方机制一致');
  assert.ok(data.timestamp, '必须有 timestamp');
});

test('transit：gcj02 输入自动转换为百度坐标后发出', async () => {
  captureStub({ statusCode: 200, data: { status: 0, result: { routes: [{ distance: 1, duration: 1, steps: [] }] } } });
  const b = new BMapWX({ ak: 'x' });
  await new Promise(resolve => {
    b.transit({
      origin: '39.908823,116.397470',
      destination: '50.0,10.0', // 越界 -> 原样
      region: '北京市',
      success: resolve,
      fail: resolve,
    });
  });
  const origin = global.__lastData.origin;
  const [lat, lng] = origin.split(',').map(Number);
  assert.ok(Math.abs(lat - 39.9152) < 0.001 && Math.abs(lng - 116.4039) < 0.001,
    `出发坐标应为百度坐标(≈39.9152,116.4039)，实际 ${origin}`);
  assert.strictEqual(global.__lastData.destination, '50.0,10.0', '经度越界坐标原样透传');
});

test('路线解析：嵌套 steps 折线递归收集（driving 为假响应）', async () => {
  captureStub(); // 用 replyTo 无关，改用自定义
  global.wx = {
    request: opt => setTimeout(() => opt.success({
      statusCode: 200,
      data: {
        status: 0,
        result: {
          routes: [{
            distance: 1000,
            duration: 120,
            steps: [
              { path: '116.1,39.9;116.2,39.91' },
              [{ path: '116.3,39.92' }], // transit 嵌套结构
            ],
          }],
        },
      },
    }), 0),
  };
  const b = new BMapWX({ ak: 'x' });
  let wxPolyline;
  const result = await new Promise(resolve => {
    b.driving({ origin: 'a', destination: 'b', success: resolve, fail: () => resolve(null) });
  });
  wxPolyline = result ? result.wxPolylineData : null;
  assert.ok(wxPolyline, '应成功回调');
  assert.strictEqual(wxPolyline.length, 3);
  assert.deepStrictEqual(wxPolyline[0], { longitude: 116.1, latitude: 39.9 });
});

test('畸形响应（result 缺失）转为 fail 回调而非抛出', async () => {
  global.wx = {
    request: opt => setTimeout(() => opt.success({ statusCode: 200, data: { status: 0, result: null } }), 0),
  };
  const b = new BMapWX({ ak: 'x' });
  const err = await new Promise(resolve => {
    b.geocoding({ address: '某地址', success: () => resolve(null), fail: resolve });
  });
  assert.ok(err, '应走 fail 回调');
  assert.strictEqual(err.statusCode, -2);
  assert.ok(/解析失败/.test(err.errMsg));
});

test('路线接口必填校验：缺起终点直接 fail', async () => {
  const b = new BMapWX({ ak: 'x' });
  const err = await new Promise(resolve => {
    b.driving({ origin: '', destination: '', success: () => resolve(null), fail: resolve });
  });
  assert.ok(err, '应走 fail 回调');
});

test('staticMap：生成合法静态图 URL（gcj02 + 默认参数）', async () => {
  const b = new BMapWX({ ak: 'MYAK' });
  const res = await new Promise(resolve => {
    b.staticMap({
      center: '116.397470,39.908823',
      markers: '116.397470,39.908823,label:天安门',
      success: resolve,
      fail: () => resolve(null),
    });
  });
  assert.ok(res, '应成功回调');
  assert.ok(res.url.startsWith('https://api.map.baidu.com/staticimage/v2?'), res.url);
  assert.ok(res.url.includes('ak=MYAK'), '含 ak');
  assert.ok(res.url.includes('coordtype=gcj02ll'), '坐标类型默认 gcj02');
  assert.ok(res.url.includes('width=400') && res.url.includes('zoom=11'), '默认宽高缩放');
  assert.ok(res.url.includes('%E5%A4%A9%E5%AE%89%E9%97%A8'), '中文标记内容已 URL 编码');
});

test('staticMap：配置 sk 后 URL 携带 SN 签名（字符序拼接 + sk MD5）', async () => {
  const b = new BMapWX({ ak: 'MYAK', sk: 'MYSK' });
  const res = await new Promise(resolve => {
    b.staticMap({ center: '116.4,39.9', success: resolve, fail: () => resolve(null) });
  });
  // 独立重算：排序编码拼接 + sk
  const entries = new URL(res.url).searchParams;
  const data = {};
  entries.forEach((v, k) => { data[k] = v; });
  const expect = crypto.createHash('md5')
    .update(Object.keys(data)
      .filter(k => k !== 'sn')
      .sort()
      .map(k => `${k}=${encodeURIComponent(data[k])}`)
      .join('&') + 'MYSK')
    .digest('hex');
  assert.strictEqual(data.sn, expect, 'sn 与官方规则一致');
});

test('weather：显式 location 按"经度,纬度"原样透传且不触发定位', async () => {
  captureStub({
    statusCode: 200,
    data: {
      status: 0, message: 'success',
      result: {
        location: { country: '中国', province: '北京市', city: '北京市', name: '西城区' },
        now: { text: '晴', temp: 28, feels_like: 29, rh: 55, wind_class: '2级', wind_dir: '南风', aqi: 42, vis: 26000, uptime: '2026-09-03 10:00' },
        forecasts: [
          { date: '2026-09-03', week: '星期四', text_day: '晴', high: 31, low: 20 },
          { date: '2026-09-04', week: '星期五', text_day: '多云', high: 33, low: 21 },
        ],
      },
    },
  });
  let getLocationCalled = false;
  global.wx.getLocation = () => { getLocationCalled = true; };
  const b = new BMapWX({ ak: 'x' });
  const res = await new Promise(resolve => {
    b.weather({ location: '116.4,39.9', success: resolve, fail: resolve });
  });
  assert.strictEqual(global.__lastData.location, '116.4,39.9', '天气 location 应为"经度,纬度"原样透传');
  assert.strictEqual(getLocationCalled, false, '显式传 location 时不应触发定位');
  assert.strictEqual(res.weatherData.currentCity, '北京市');
  assert.strictEqual(res.weatherData.feelsLike, 29);
  assert.strictEqual(res.weatherData.aqi, 42);
  assert.strictEqual(res.weatherData.forecast.length, 2, '解析 7 天预报');
  assert.strictEqual(res.weatherData.forecast[0].textDay, '晴');
});

/* --------- 真实接口用例（需 BMAP_AK） --------- */

function callThrough(callback) {
  const url = new URL(callback.url);
  Object.keys(callback.data || {}).forEach(k => url.searchParams.append(k, callback.data[k]));
  https.get(url, res => {
    let raw = '';
    res.on('data', c => (raw += c));
    res.on('end', () => {
      try {
        callback.success({ statusCode: res.statusCode, data: JSON.parse(raw) });
      } catch (e) {
        callback.fail({ errMsg: '非 JSON 响应' });
      }
    });
  }).on('error', e => callback.fail(e));
}

if (AK) {
  const b = new BMapWX({ ak: AK });

  test('search：返回 POI marker 数组', async () => {
    global.wx = { request: callThrough };
    const res = await new Promise((resolve, reject) => {
      b.search({ query: '美食', location: '39.908823,116.397470', success: resolve, fail: reject });
    });
    assert.ok(res.wxMarkerData.length > 0);
    assert.ok(Number.isFinite(res.wxMarkerData[0].latitude));
  });

  test('suggestion：返回联想数组', async () => {
    global.wx = { request: callThrough };
    const res = await new Promise((resolve, reject) => {
      b.suggestion({ query: '天安门', region: '北京', success: resolve, fail: reject });
    });
    assert.ok(Array.isArray(res.result) && res.result.length > 0);
  });

  test('reverseGeocoding：返回地址描述', async () => {
    global.wx = { request: callThrough };
    const res = await new Promise((resolve, reject) => {
      b.reverseGeocoding({ location: '39.908823,116.397470', success: resolve, fail: reject });
    });
    assert.ok(typeof res.wxMarkerData[0].address === 'string');
  });

  test('geocoding：返回合法坐标', async () => {
    global.wx = { request: callThrough };
    const res = await new Promise((resolve, reject) => {
      b.geocoding({ address: '北京市海淀区上地十街10号', success: resolve, fail: reject });
    });
    const m = res.wxMarkerData[0];
    assert.ok(m.latitude > 39 && m.latitude < 41, '纬度合法');
  });

  for (const [name, method] of [
    ['driving', 'driving'], ['walking', 'walking'],
    ['riding', 'riding'], ['transit', 'transit'],
  ]) {
    test(name + '：路线折线可解析且起终点贴近输入', async () => {
      global.wx = { request: callThrough };
      const params = { origin: '39.908823,116.397470', destination: '39.933362,116.380635' };
      if (method === 'transit') { params.region = '北京市'; }
      const res = await new Promise((resolve, reject) => {
        b[method](Object.assign({}, params, { success: resolve, fail: reject }));
      });
      const pts = res.wxPolylineData;
      assert.ok(pts.length > 10, name + ' 折线点数过少：' + pts.length);
      const first = pts[0];
      assert.ok(
        Math.abs(first.latitude - 39.908823) < 0.02 && Math.abs(first.longitude - 116.397470) < 0.02,
        name + ' 起点坐标偏差过大'
      );
    });
  }
}

/* --------- 执行 --------- */

(async () => {
  for (const c of cases) {
    try {
      await c.fn();
      passed++;
      console.log('  PASS', c.name);
    } catch (err) {
      console.error('  FAIL', c.name, '-', err.message);
    }
  }
  console.log(`\n${passed}/${cases.length} 通过${AK ? '' : '（未设 BMAP_AK，跳过真实接口用例）'}`);
  process.exit(passed === cases.length ? 0 : 1);
})();