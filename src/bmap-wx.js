/**
 * @file 微信小程序JSAPI
 * @author bmap fe
 * @version v1.2.0
 */

/**
 * 百度地图微信小程序API类
 *
 * 使用约定：
 * - 回调式调用：`new BMapWX({ ak }).search({ query, success, fail })`
 * - 成功回调统一入参为 `{ originalData, ...规范字段 }`：
 *   - 地图类接口（search / reverseGeocoding / geocoding）返回 wxMarkerData（小程序 marker 数组）
 *   - suggestion 返回 result（搜索结果数组）
 *   - 天气接口返回 weatherData（天气对象）
 * - 失败回调统一入参为 { errMsg, statusCode, message, rawMessage }
 *
 * 内部实现（参照 JSAPI 的请求管理 / 签名 / 错误码模式）：
 * - 统一请求管线：定位 → 参数序列化 → 签名（可选）→ 请求 → 业务校验 → 回调
 * - SN 签名：传入 sk 后按百度《Web 服务 API 签名机制》自动生成 timestamp+sn
 * - 错误码映射：statusCode -> 可读中文文案（message 字段）
 */

/** API 地址与路径（对应百度 Web 服务 API） */
const API_HOST = 'https://api.map.baidu.com';
const API_PATH = {
  search: '/place/v2/search',
  suggestion: '/place/v2/suggestion',
  reverseGeocoding: '/reverse_geocoding/v3',
  geocoding: '/geocoding/v3',
  driving: '/direction/v2/driving',
  walking: '/direction/v2/walking',
  transit: '/direction/v2/transit',
  riding: '/direction/v2/riding',
  weather: '/weather/v1/', // 必须带末尾斜杠（无斜杠时 API 返回 302），SDK 已内置
  weatherAbroad: '/weather_abroad/v1/', // 同上
  staticImage: '/staticimage/v2',
};

/** 通用错误码 -> 可读文案（对应百度官方 Web 服务 API 状态码） */
const STATUS_TEXT = {
  2: '请求参数错误',
  3: '权限校验失败',
  4: '配额校验失败',
  5: 'ak 不存在或非法',
  6: '该接口无访问权限',
  10: '服务已下线',
  220: 'APP Referer 校验失败（AK 类型与请求来源不匹配）',
  221: 'APP IP 校验失败（IP 不在白名单）',
  240: 'APP 服务被禁用（该服务未开通）',
  301: '服务器内部错误',
  302: '当日配额已用完',
  401: '鉴权失败（ak 无效或 sn 校验不通过）',
  402: 'Signature 校验失败',
  403: '请求已被拒绝（应用黑名单或未获授权）',
};

/**
 * 将字符串编码为 UTF-8 字节数组（含代理对处理）。
 */
function utf8Bytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) {
      bytes.push(c);
    } else if (c < 0x800) {
      bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c < 0xdc00) {
      const high = c;
      const low = str.charCodeAt(++i);
      c = 0x10000 + ((high & 0x3ff) << 10) + (low & 0x3ff);
      bytes.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 0x3f),
        0x80 | ((c >> 6) & 0x3f),
        0x80 | (c & 0x3f),
      );
    } else {
      bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return bytes;
}

/**
 * MD5（纯 JS 实现，无外部依赖；按 UTF-8 编码处理多字节字符）。
 */
const MD5 = (function () {
  const SHIFT = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const K = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
    0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
    0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
    0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
    0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
    0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
    0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
    0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
    0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
  ];

  function toHex(w) {
    let hex = '';
    for (let i = 0; i < 4; i++) {
      const b = (w >>> (i * 8)) & 0xff;
      hex += (b < 16 ? '0' : '') + b.toString(16);
    }
    return hex;
  }

  return function md5(str) {
    const msg = utf8Bytes(str);
    const bitLen = msg.length * 8;

    // 填充：0x80 + 补 0 至 ≡56 (mod 64) + 64 位长度（小端）
    msg.push(0x80);
    while (msg.length % 64 !== 56) { msg.push(0); }
    msg.push(bitLen & 0xff);
    msg.push((bitLen >>> 8) & 0xff);
    msg.push((bitLen >>> 16) & 0xff);
    msg.push((bitLen >>> 24) & 0xff);
    msg.push(0);
    msg.push(0);
    msg.push(0);
    msg.push(0);

    let a0 = 0x67452301;
    let b0 = 0xefcdab89;
    let c0 = 0x98badcfe;
    let d0 = 0x10325476;

    for (let offset = 0; offset < msg.length; offset += 64) {
      const M = [];
      for (let i = 0; i < 16; i++) {
        M[i] = msg[offset + i * 4]
          | (msg[offset + i * 4 + 1] << 8)
          | (msg[offset + i * 4 + 2] << 16)
          | (msg[offset + i * 4 + 3] << 24);
      }

      let A = a0;
      let B = b0;
      let C = c0;
      let D = d0;

      for (let i = 0; i < 64; i++) {
        let f;
        let g;
        if (i < 16) {
          f = (B & C) | (~B & D);
          g = i;
        } else if (i < 32) {
          f = (D & B) | (~D & C);
          g = (5 * i + 1) % 16;
        } else if (i < 48) {
          f = B ^ C ^ D;
          g = (3 * i + 5) % 16;
        } else {
          f = C ^ (B | ~D);
          g = (7 * i) % 16;
        }
        // 本轮的加法 + 循环左移
        const round = (A + f + K[i] + M[g]) | 0;
        const newB = (B + ((round << SHIFT[i]) | (round >>> (32 - SHIFT[i])))) | 0;
        // 寄存器轮换：newA=oldD, newD=oldC, newC=oldB, newB=newB
        const oldB = B;
        A = D;
        D = C;
        C = oldB;
        B = newB;
      }

      a0 = (a0 + A) | 0;
      b0 = (b0 + B) | 0;
      c0 = (c0 + C) | 0;
      d0 = (d0 + D) | 0;
    }

    return toHex(a0) + toHex(b0) + toHex(c0) + toHex(d0);
  };
})();

/* ================= 模块级私有函数（不挂到实例，用户不可见） ================= */

/**
 * 解析定位参数：支持显式传经纬度，否则走 wx.getLocation。
 * @private
 */
function resolveLocation(location) {
  if (!location) {
    return new Promise((resolve, reject) => {
      wx.getLocation({
        type: 'gcj02',
        success(res) {
          resolve({
            lat: res.latitude,
            lng: res.longitude,
            latLng: `${res.latitude},${res.longitude}`,
            lngLat: `${res.longitude},${res.latitude}`,
          });
        },
        fail: reject,
      });
    });
  }
  const parts = location.split(',').map(s => s.trim());
  return Promise.resolve({
    lat: parts[0],
    lng: parts[1],
    latLng: `${parts[0]},${parts[1]}`,
    lngLat: `${parts[1]},${parts[0]}`,
  });
}

/**
 * 构造小程序规范的 marker 对象。
 * @private
 */
function buildMarker(attrs, style = {}) {
  const marker = Object.assign({}, attrs);
  ['iconPath', 'iconTapPath', 'width', 'height', 'alpha'].forEach(key => {
    if (style[key] !== undefined) {
      marker[key] = style[key];
    }
  });
  // 新版基础库要求设置了 iconPath 的 marker 必须显式声明 width/height（不再按图片尺寸推断），
  // 未传入时兜底为 30，避免 <map> 渲染层报 "width and height of marker are required"
  if (marker.iconPath && marker.width === undefined) { marker.width = 30; }
  if (marker.iconPath && marker.height === undefined) { marker.height = 30; }
  return marker;
}

/**
 * 解析天气响应为业务对象（国内/海外通用）。
 * @private
 */
function parseWeather(res) {
  // 官方文档 2026 版响应字段由 location 调整为 address，两者兼容
  const location = res.result.location || res.result.address;
  const now = res.result.now;
  const weather = {
    country: location.country,
    province: location.province,
    currentCity: location.city,
    weatherDesc: now.text,
    temperature: now.temp,
    feelsLike: now.feels_like,
    windClass: now.wind_class,
    windDir: now.wind_dir,
    humidity: now.rh,
    aqi: now.aqi,
    vis: now.vis,
    updatedAt: now.uptime, // 接口原始格式（如 "20260903171500"），展示需自行格式化
    forecast: (res.result.forecasts || []).map(f => ({
      date: f.date,
      week: f.week,
      textDay: f.text_day,
      high: f.high,
      low: f.low,
    })),
  };
  if (location.name) {
    weather.district = location.name;
  }
  weather.updatetime = weather.updatedAt; // 兼容旧版调用
  return weather;
}

/**
 * 公交等无 coord_type 参数的接口：将 gcj02（微信生态系统坐标）转为百度坐标(bd09ll)。
 * 仅当输入为合法的"纬度,经度"数字串时转换，地点名称等其他格式原样返回。
 * 参考坐标偏移公式：https://lbsyun.baidu.com/faq/api?title=webapi/appendix/ak/coords
 * @private
 */
function toBd09(value) {
  const parts = String(value).split(',');
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) { return String(value); }
  // 不在中国大陆范围，放弃转换
  if (lat < 3 || lat > 54 || lng < 73 || lng > 136) { return String(value); }
  const X_PI = Math.PI * 3000 / 180;
  const x = lng;
  const y = lat;
  const z = Math.sqrt(x * x + y * y) + 0.00002 * Math.sin(y * X_PI);
  const theta = Math.atan2(y, x) + 0.000003 * Math.cos(x * X_PI);
  const bdLng = z * Math.cos(theta) + 0.0065;
  const bdLat = z * Math.sin(theta) + 0.006;
  return `${bdLat.toFixed(6)},${bdLng.toFixed(6)}`;
}

/**
 * Web 服务 SN 签名（参考 JSAPI SignSource 的加密保护思路）。
 * 官方规则（《Web 服务 API 签名机制》）：请求参数（含 ak）按 key 字典序升序排列、
 * 值做 encodeURIComponent 后拼成 queryString，再在末尾追加 sk，整体 md5 得 sn；
 * ak 保留在签名串中并随请求 URL 携带（服务端凭 ak 定位对应 sk 校验 sn），
 * 同时追加 timestamp + sn（timestamp 为 Unix 秒，参与签名）。
 *
 * @param {Object} params 请求参数（含 ak）
 * @param {string} sk     服务密钥
 * @returns {Object} 追加 timestamp + sn 的请求参数
 * @private
 */
function signParams(params, sk) {
  const clean = {};
  Object.keys(params).forEach(key => {
    if (key === 'sn' || key === 'timestamp') { return; }
    if (params[key] === '' || params[key] === undefined || params[key] === null) { return; }
    clean[key] = params[key];
  });
  const query = Object.keys(clean)
    .sort()
    .map(key => `${key}=${encodeURIComponent(clean[key])}`)
    .join('&');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const sn = MD5(query + sk);
  return Object.assign({}, clean, { timestamp, sn });
}

/**
 * 路线规划公共必填校验：缺少 origin/destination 时直接 fail。
 * @returns {boolean} 参数是否合法
 * @private
 */
function ensureRouteParams(param) {
  if (param.origin && param.destination) { return true; }
  const fail = param.fail || function () {};
  fail({ errMsg: 'input origin and destination!' });
  return false;
}

/**
 * 路线规划参数构造：白名单透传 + 公共默认值。
 * @param {Object}   param   用户入参
 * @param {string[]} fields  允许透传给接口的字段白名单
 * @param {Object}   extra   附加参数（如 coord_type）
 * @param {string}   ak      当前密钥
 * @private
 */
function routeParams(param, fields, extra, ak) {
  const params = {
    origin: param.origin,
    destination: param.destination,
    tactics: param.tactics || 0,
    output: param.output || 'json',
    // direction 系接口仅支持 gcj02 / bd09ll / wgs84（长度≤6）
    ret_coordtype: param.ret_coordtype || 'gcj02',
    ak,
  };
  fields.forEach(field => {
    if (param[field] !== undefined) {
      params[field] = param[field];
    }
  });
  Object.assign(params, extra || {});
  return params;
}

/**
 * 路线规划通用回调：解析 direction/v2 响应为规范化 routes。
 * 并额外将步骤折线合并为小程序 <map polyline> 可直接使用的坐标数组。
 *
 * @param {Object} res direction/v2 原始响应（status=0 时 result.routes 存在）
 * @private
 */
function parseRouteResponse(res) {
  const sourceRoutes = (res.result && res.result.routes) || [];
  const routes = sourceRoutes.map(route => {
    const polyline = [];
    // direction/v2 各模式（driving/walking/riding）的折线在 step.path；
    // 公交（transit）的步骤是嵌套数组，因此统一递归收集 path；
    // 附加深度上限与坐标合法性过滤，防御畸形响应。
    const collect = (nodes, depth) => {
      if (depth > 8) { return; }
      (nodes || []).forEach(node => {
        if (Array.isArray(node)) {
          collect(node, depth + 1);
          return;
        }
        if (!node || typeof node !== 'object') { return; }
        const pts = String(node.path || '');
        pts.split(';').forEach(point => {
          if (!point) { return; }
          const [longitude, latitude] = point.split(',');
          const lng = Number(longitude);
          const lat = Number(latitude);
          if (Number.isFinite(lng) && Number.isFinite(lat)) {
            polyline.push({ longitude: lng, latitude: lat });
          }
        });
        collect(node.steps, depth + 1);
      });
    };
    collect(route.steps, 0);
    return {
      distance: route.distance,
      duration: route.duration,
      prefer: route.prefer,
      polyline,
      steps: route.steps || [],
    };
  });
  return {
    originalData: res,
    routes,
    // 兼容旧版命名习惯：主方案折线（wx marker 系列字段的延伸）
    wxPolylineData: routes.length ? routes[0].polyline : [],
  };
}

/**
 * wx.request 的 Promise 化封装。
 * @param {string} url  API 地址（含路径）
 * @param {Object} data 请求参数
 * @returns {Promise<Object>} 响应体（res.data）
 * @private
 */
function requestApi(url, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      data,
      header: { 'content-type': 'application/json' },
      method: 'GET',
      success: res => resolve(res.data),
      fail: reject,
    });
  });
}

class BMapWX {

  /**
   * @constructor
   * @param {Object} options                配置
   * @param {string} options.key            百度地图开放平台密钥。小程序建议选「服务端」类型并配 IP 白名单，
   *                                        「微信小程序」类型在开发者工具中会因 Referer 校验失败（220）
   * @param {string} [options.sk]           服务密钥；配置后按官方《Web 服务 API 签名机制》自动生成
   *                                        timestamp+sn（ak 保留且参与签名）
   * @param {string} [options.serviceHost]  自定义 API 域名（默认 https://api.map.baidu.com）
   */
  constructor(options = {}) {
    if (!options.ak) {
      console.warn('[BMapWX] 未配置 ak，接口请求将失败，请在 https://lbsyun.baidu.com/ 申请后传入');
    }
    this.ak = options.ak;
    this.sk = options.sk || '';
    this.serviceHost = options.serviceHost || API_HOST;
  }

  /**
   * 低级定位接口（兼容旧版公开调用）
   *
   * @param {string}   [type]               坐标类型，默认 gcj02
   * @param {Function} [success]            成功回调
   * @param {Function} [fail]               失败回调
   * @param {Function} [complete]           完成回调
   */
  getWXLocation(type, success, fail, complete) {
    wx.getLocation({
      type: type || 'gcj02',
      success: success || function () {},
      fail: fail || function () {},
      complete: complete || function () {},
    });
  }

  /**
   * 统一请求管线：定位（可选）→ 参数序列化 → 签名（可选）→ 请求 → 业务校验 → 回调。
   * 内部使用 async/await 组织异步流程，对外仍是回调式调用。
   *
   * @private
   * @param {Object}  param                用户入参（含 success/fail）
   * @param {Object}  cfg
   * @param {string}  cfg.path             API 路径（相对 api.map.baidu.com）
   * @param {boolean} [cfg.needLocation]   是否需要先定位
   * @param {Function} cfg.buildParams     根据定位结果拼请求参数
   * @param {Function} [cfg.ok]            判断业务是否成功
   * @param {Function} [cfg.parse]         成功响应的格式化（得到 success 入参）
   */
  async _request(param, cfg) {
    const success = param.success || function () {};
    const fail = param.fail || function () {};

    const fireFail = error => {
      // 兼容微信部分失败回调直接传字符串 / 空对象的情况
      const raw = typeof error === 'string' ? { errMsg: error } : (error || {});
      const statusCode = raw.statusCode || raw.status || raw.error;
      let rawMessage = raw.errMsg || raw.message || 'request failed';
      // 响应体为网页/非 JSON 时，友好提示而非展示整段 HTML
      if (/^\s*<!DOCTYPE|^\s*<html/i.test(rawMessage)) {
        rawMessage = '服务端返回了网页内容而非接口数据，请求可能被拦截或网络出口受限';
      } else if (typeof rawMessage === 'string' && rawMessage.length > 160) {
        rawMessage = rawMessage.slice(0, 160) + '…';
      }
      fail({
        errMsg: rawMessage,
        message: STATUS_TEXT[statusCode] || rawMessage,
        statusCode,
        rawMessage,
      });
    };
    const fireSuccess = (result, loc) => {
      let payload;
      try {
        payload = cfg.parse ? cfg.parse(result, loc) : result;
      } catch (parseError) {
        // 解析逻辑属 SDK 内部，解析失败按接口失败处理（不冒出到用户栈、不触发 success）
        fireFail({ errMsg: '响应解析失败', message: parseError.message || 'parse error', statusCode: -2 });
        return;
      }
      success(payload);
    };

    let loc = null;
    let res = null;
    try {
      // 1. 定位（可选）
      loc = cfg.needLocation ? await resolveLocation(param.location) : null;
      // 2. 请求参数：兼容显式 sn/timestamp；配置 sk 且未显式传 sn 时自动签名
      let data = cfg.buildParams(loc);
      // 显式传入的 sn/timestamp 原样透传（未配置 sk、自行签名场景）
      if (param.sn) { data.sn = param.sn; }
      if (param.timestamp) { data.timestamp = param.timestamp; }
      // 剔除空值参数：未显式传 sn/timestamp 时不保留空占位，请求 URL 更干净
      Object.keys(data).forEach(k => {
        if (data[k] === '' || data[k] == null) { delete data[k]; }
      });
      if (this.sk && !param.sn) {
        data = signParams(data, this.sk);
      }
      // 3. 发起请求
      res = await requestApi(this.serviceHost + cfg.path, data);
    } catch (error) {
      // 定位失败 / 网络失败统一走 fail 回调
      fireFail(error);
      return;
    }
    // 4. 业务校验并回调
    if (cfg.ok ? cfg.ok(res) : true) {
      fireSuccess(res, loc);
    } else {
      fireFail(res);
    }
  }

  /**
   * POI 周边检索
   *
   * @param {Object}   param               检索参数（其余与百度 Place API 一致）
   * @param {string}   [param.query]       检索关键词，默认 "生活服务$美食&酒店"
   * @param {string}   [param.location]    中心点，默认当前定位
   * @param {Function} [param.success]     成功回调，入参 { originalData, wxMarkerData }
   * @param {Function} [param.fail]        失败回调，入参 { errMsg, statusCode, message }
   */
  search(param = {}) {
    this._request(param, {
      path: API_PATH.search,
      needLocation: true,
      buildParams: loc => ({
        query: param.query || '生活服务$美食&酒店',
        scope: param.scope || 1,
        filter: param.filter || '',
        coord_type: param.coord_type || 2,
        page_size: param.page_size || 10,
        page_num: param.page_num || 0,
        output: param.output || 'json',
        radius: param.radius || 2000,
        location: loc.latLng,
        ak: this.ak,
        ret_coordtype: 'gcj02ll',
      }),
      ok: res => (res.status === 0),
      parse: res => ({
        originalData: res,
        wxMarkerData: (res.results || []).map((poi, id) => buildMarker({
          id,
          title: poi.name,
          latitude: poi.location.lat,
          longitude: poi.location.lng,
          address: poi.address,
          telephone: poi.telephone,
        }, param)),
      }),
    });
  }

  /**
   * 关键词模糊检索（输入联想）
   *
   * @param {Object}   param              检索参数
   * @param {string}   [param.query]       输入的关键字
   * @param {string}   [param.region]      检索城市，默认全国
   * @param {Function} [param.success]     成功回调，入参 { originalData, result }
   * @param {Function} [param.fail]        失败回调，入参 { errMsg, statusCode, message }
   */
  suggestion(param = {}) {
    this._request(param, {
      path: API_PATH.suggestion,
      buildParams: () => ({
        query: param.query || '',
        region: param.region || '全国',
        city_limit: param.city_limit || false,
        output: param.output || 'json',
        ak: this.ak,
        ret_coordtype: 'gcj02ll',
      }),
      ok: res => (res.status === 0),
      parse: res => ({
        originalData: res,
        result: res.result || [],
      }),
    });
  }

  /**
   * 逆地理编码：经纬度 -> 地址描述信息
   *
   * @param {Object}   param
   * @param {string}   [param.location]  待解析经纬度，默认当前定位
   * @param {Function} [param.success]   成功回调，入参 { originalData, wxMarkerData }
   * @param {Function} [param.fail]      失败回调，入参 { errMsg, statusCode, message }
   */
  reverseGeocoding(param = {}) {
    this._request(param, {
      path: API_PATH.reverseGeocoding,
      needLocation: true,
      buildParams: loc => ({
        location: loc.latLng,
        coordtype: param.coordtype || 'gcj02ll',
        ret_coordtype: 'gcj02ll',
        radius: param.radius || 1000,
        output: param.output || 'json',
        ak: this.ak,
        extensions_poi: param.extensions_poi !== undefined ? param.extensions_poi : 1,
        extensions_road: param.extensions_road || false,
        extensions_town: param.extensions_town || false,
        language: param.language || 'zh-CN',
        language_auto: param.language_auto || 0,
      }),
      ok: res => (res.status === 0),
      parse: (res, loc) => ({
        originalData: res,
        wxMarkerData: [buildMarker({
          id: 0,
          latitude: loc.lat,
          longitude: loc.lng,
          address: res.result.formatted_address,
          desc: res.result.sematic_description,
          business: res.result.business,
        }, param)],
      }),
    });
  }

  /**
   * 逆地理编码（兼容旧版方法名）
   *
   * @deprecated 请使用 reverseGeocoding
   */
  regeocoding(param = {}) {
    return this.reverseGeocoding(param);
  }

  /**
   * 驾车路线规划
   *
   * @param {Object}   param                    起终点等规划参数
   * @param {string}   param.origin             起点，"纬度,经度" 或地点名称（必填）
   * @param {string}   param.destination        终点，"纬度,经度" 或地点名称（必填）
   * @param {number}   [param.tactics]          策略：0 速度优先 / 1 距离优先 / 6 躲避拥堵等
   * @param {Function} [param.success]          成功回调，入参 { originalData, routes, wxPolylineData }
   * @param {Function} [param.fail]             失败回调
   */
  driving(param = {}) {
    if (!ensureRouteParams(param)) { return; }
    this._request(param, {
      path: API_PATH.driving,
      buildParams: () => routeParams(
        param,
        ['waypoints', 'width', 'plate', 'city', 'ret_coordtype'],
        { coord_type: param.coord_type || 'gcj02' },
        this.ak,
      ),
      ok: res => (res.status === 0),
      parse: res => parseRouteResponse(res),
    });
  }

  /**
   * 步行路线规划
   *
   * @param {Object}   param                同驾车，无途经点
   * @param {Function} [param.success]      成功回调，入参 { originalData, routes, wxPolylineData }
   * @param {Function} [param.fail]         失败回调
   */
  walking(param = {}) {
    if (!ensureRouteParams(param)) { return; }
    this._request(param, {
      path: API_PATH.walking,
      buildParams: () => routeParams(
        param,
        ['city'],
        { coord_type: param.coord_type || 'gcj02' },
        this.ak,
      ),
      ok: res => (res.status === 0),
      parse: res => parseRouteResponse(res),
    });
  }

  /**
   * 骑行路线规划
   *
   * @param {Object}   param
   * @param {number}   [param.tactics]      0 常规 / 1 避开高速（更快）等
   * @param {Function} [param.success]      成功回调，入参 { originalData, routes, wxPolylineData }
   * @param {Function} [param.fail]         失败回调
   */
  riding(param = {}) {
    if (!ensureRouteParams(param)) { return; }
    this._request(param, {
      path: API_PATH.riding,
      buildParams: () => routeParams(
        param,
        ['width', 'plate', 'city'],
        { coord_type: param.coord_type || 'gcj02' },
        this.ak,
      ),
      ok: res => (res.status === 0),
      parse: res => parseRouteResponse(res),
    });
  }

  /**
   * 公交（含地铁）路线规划
   *
   * @param {Object}   param
   * @param {string}   [param.region]       起点所在城市，名称/坐标起点时常需提供（如"北京市"）
   * @param {string}   [param.region_d]     终点所在城市（跨城时）
   * @param {number}   [param.tactics]      0 常规 / 3 换乘少优先 / 4 步行少优先 / 5 地铁优先等
   * @param {Function} [param.success]      成功回调，入参 { originalData, routes, wxPolylineData }
   * @param {Function} [param.fail]         失败回调
   */
  transit(param = {}) {
    if (!ensureRouteParams(param)) { return; }
    this._request(param, {
      path: API_PATH.transit,
      // 公交接口不提供 coord_type 参数，输入坐标按百度坐标(bd09ll)解析：
      // 对 gcj02（微信生态默认坐标系）的经纬度输入做转换，地点名/其他格式原样透传
      buildParams: () => {
        const p = routeParams(param, ['region', 'region_d', 'city', 'vision'], null, this.ak);
        p.origin = toBd09(param.origin);
        p.destination = toBd09(param.destination);
        return p;
      },
      ok: res => (res.status === 0),
      parse: res => parseRouteResponse(res),
    });
  }

  /**
   * 地理编码：地址 -> 经纬度
   *
   * @param {Object}   param
   * @param {string}   param.address        待解析地址，必填，如"北京市海淀区上地十街10号"
   * @param {string}   [param.city]         地址所在城市，默认空
   * @param {Function} [param.success]      成功回调，入参 { originalData, wxMarkerData }
   * @param {Function} [param.fail]         失败回调，入参 { errMsg, statusCode, message, rawMessage }
   */
  geocoding(param = {}) {
    if (!param.address) {
      const fail = param.fail || function () {};
      fail({ errMsg: 'input address!' });
      return;
    }
    this._request(param, {
      path: API_PATH.geocoding,
      buildParams: () => ({
        address: param.address,
        city: param.city || '',
        ret_coordtype: param.ret_coordtype || param.coordtype || 'gcj02ll', // 兼容新旧参数键
        output: param.output || 'json',
        ak: this.ak,
        callback: param.callback || '',
      }),
      ok: res => (res.status === 0),
      parse: res => {
        const loc = res.result.location;
        return {
          originalData: res,
          wxMarkerData: [buildMarker({
            id: 0,
            latitude: loc.lat,
            longitude: loc.lng,
          }, param)],
        };
      },
    });
  }

  /**
   * 天气检索通用实现（国内/海外共用）。
   *
   * @private
   * @param {Object} param  检索参数（其余同百度天气 API）
   * @param {string} path   API 路径（/weather/v1 或 /weather_abroad/v1）
   */
  _weatherRequest(param, path) {
    this._request(param, {
      path,
      needLocation: true,
      buildParams: loc => ({
        // 天气接口约定 location 为 "经度,纬度"（与其余接口顺序相反）：
        // 显式传入时原样透传，未传时按定位结果组串（loc.lng,loc.lat）
        location: param.location ? String(param.location).trim() : `${loc.lng},${loc.lat}`,
        // 与 location 二选一：仅显式传入时携带（同时传时官方按 district_id 优先，会吞掉 location）
        district_id: param.district_id || '',
        data_type: param.data_type || 'all',
        output: param.output || 'json',
        ak: this.ak,
        coordtype: param.coordtype || 'gcj02',
      }),
      // 新版：status=0（数字）；旧版：error=0 且 status='success'，兼容两种格式
      ok: res => (res.status === 0 || (res.error === 0 && res.status === 'success')),
      parse: res => {
        const weatherData = parseWeather(res);
        return {
          originalData: res,
          weatherData,
          wxMarkerData: [weatherData], // 兼容旧版调用
        };
      },
    });
  }

  /**
   * 国内天气检索
   *
   * @param {Object}   param                检索参数（其余同百度天气 API）
   * @param {string}   [param.location]     天气地点，接口要求 "经度,纬度"或城市名，默认当前定位
   * @param {string}   [param.district_id]  区县编码（与 location 二选一，同时传时官方按 district_id 优先）
   * @param {string}   [param.data_type]    返回内容：all 实况+7天预报（默认）/ now 仅实况
   * @param {string}   [param.output]       返回格式 json（默认）
   * @param {string}   [param.coordtype]    坐标类型 gcj02（默认）
   * @param {Function} [param.success]      成功回调，入参 { originalData, weatherData, wxMarkerData(兼容) }
   * @param {Function} [param.fail]         失败回调，入参 { errMsg, statusCode, message, rawMessage }
   */
  weather(param = {}) {
    this._weatherRequest(param, API_PATH.weather);
  }

  /**
   * 海外天气检索
   *
   * @param {Object}   param                 用法同 weather
   * @param {string}   [param.location]      海外地点，仅接受 "经度,纬度"（weatherAbroad 不支持城市名），默认当前定位
   * @param {Function} [param.success]       成功回调，入参 { originalData, weatherData, wxMarkerData(兼容) }
   * @param {Function} [param.fail]          失败回调，入参 { errMsg, statusCode, message, rawMessage }
   */
  weatherAbroad(param = {}) {
    this._weatherRequest(param, API_PATH.weatherAbroad);
  }

  /**
   * 静态图：生成可直接用于 <image src> 的地图图片 URL（本地拼装，不发起网络请求）。
   *
   * @param {Object}   param
   * @param {string}   [param.center]    中心点 "经度,纬度" 或地点名，默认北京
   * @param {number}   [param.width]     图片宽度 px（默认 400，scale=2 时 ≤512）
   * @param {number}   [param.height]    图片高度 px（默认 300）
   * @param {number}   [param.zoom]      地图级别 [3,19]（scale=2 高清图上限 18），默认 11
   * @param {string}   [param.scale]     1 普通 / 2 高清（输出 2 倍像素；宽高须 ≤512，zoom 上限 18）
   * @param {string}   [param.coordtype] 坐标类型，默认 gcj02ll（与小程序坐标系一致）
   * @param {string}   [param.markers]      标注点坐标，如 "lng,lat|lng2,lat2"（多个用竖线 | 分隔），样式经 markerStyles
   * @param {string}   [param.markerStyles] 标注点样式：size,label,color（label 为标注文字），多组用竖线 | 分隔，与 markers 一一对应，如 "16,北京,0xFF6600|16,上海,0x0066CC"
   * @param {string}   [param.labels]       标签坐标，如 "lng,lat"（仅坐标，文字经 labelStyles）
   * @param {string}   [param.labelStyles]  标签样式：content,fontWeight,fontSize,fontColor,bgColor,border（content 为标签文字，如 "我的位置,1,18,0x006600,0xFFFFFF,1"）
   * @param {string}   [param.paths]        折线/多边形，如 "lng,lat;lng2,lat2|..."
   * @param {string}   [param.pathStyles]   折线样式：color,weight,opacity[,fillColor]
   * @param {number|string} [param.copyright] 版权样式：0 log+文字 / 1 纯文字（默认 0）
   * @param {string}   [param.bbox]         地图视野范围（与 center 二选一）："minX,minY;maxX,maxY"
   * @param {string}   [param.dpiType]   ph（高清屏）/ pl（低分屏），自 V3 起已废弃（服务端不再区分，保留兼容）
   * @param {Function} [param.success]   成功回调，入参 { url, originalData }
   * @param {Function} [param.fail]      失败回调，入参 { errMsg, statusCode, message, rawMessage }
   */
  staticMap(param = {}) {
    const fail = param.fail || function () {};
    if (!this.ak) {
      fail({ errMsg: '未配置 ak，无法生成静态图 URL' });
      return;
    }
    const data = {
      width: param.width || 400,
      height: param.height || 300,
      zoom: param.zoom || 11,
      coordtype: param.coordtype || 'gcj02ll',
      ak: this.ak,
    };
    ['center', 'scale', 'markers', 'markerStyles', 'labels', 'labelStyles', 'paths', 'pathStyles', 'dpiType', 'copyright', 'bbox'].forEach(key => {
      if (param[key] !== undefined) {
        data[key] = param[key];
      }
    });
    if (this.sk) {
      // 静态图接口的 SN 校验：参数按 key 字典序编码拼接后 + sk 做 MD5（无 timestamp）
      const query = Object.keys(data)
        .sort()
        .map(key => `${key}=${encodeURIComponent(data[key])}`)
        .join('&');
      data.sn = MD5(query + this.sk);
    }
    const query = Object.keys(data)
      .map(key => `${key}=${encodeURIComponent(data[key])}`)
      .join('&');
    const success = param.success || function () {};
    success({
      url: `${this.serviceHost}${API_PATH.staticImage}?${query}`,
      originalData: data,
    });
  }
}

module.exports.BMapWX = BMapWX;