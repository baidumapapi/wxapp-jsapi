/**
 * BMap SDK 工具层
 * 将 BMapWX 的回调式 API 统一封装为 Promise，页面可用 async/await 调用：
 *
 *   const { wxMarkerData } = await invoke('search', { query: '美食' });
 *
 * 请求失败（定位失败/网络错误/业务错误）统一 reject，入参为 { errMsg, statusCode }。
 */
const bmap = require('../libs/bmap-wx.min.js');
const config = require('../config.js');

/** marker 图标（页面通用） */
const RED_ICON = '../../img/marker_red.png';
const YELLOW_ICON = '../../img/marker_yellow.png';

// SDK 实例为纯无状态（仅持有 ak/sk），模块级单例复用
const client = new bmap.BMapWX({ ak: config.ak, sk: config.sk || '' });

/** Promise 化调用 SDK 方法 */
function invoke(method, params = {}) {
  if (!config.ak) {
    return Promise.reject(new Error(config.hint));
  }
  if (typeof client[method] !== 'function') {
    return Promise.reject(new Error(`未知的 SDK 方法：${method}`));
  }
  return new Promise((resolve, reject) => {
    const callbacks = {
      success: resolve,
      fail(err) {
        // 仅网络层失败打 error；业务失败（错误码）由页面提示，避免刷屏
        if ((err && String(err.rawMessage || '').indexOf('request:fail') === 0)) {
          console.error('[bmap] ' + method + ' 网络失败：', err);
        }
        reject(err);
      },
    };
    client[method](Object.assign({}, params, callbacks));
  });
}

/** 错误信息提取：兼容 SDK 抛出的 { errMsg } 与普通 Error */
function errMsg(err) {
  return (err && (err.errMsg || err.message)) || '未知错误';
}

/**
 * 高亮补丁（推荐）：仅更新选中/未选中项的 iconPath 路径，避免整组替换 markers
 * 导致地图销毁重建全部 marker 图层而闪烁。用法：this.setData(markerIconPatch(this.data.markers, id))
 */
function markerIconPatch(markers, selectedId) {
  const patch = {};
  (markers || []).forEach((m, i) => {
    const target = i === selectedId ? YELLOW_ICON : RED_ICON;
    if (m.iconPath !== target) {
      patch[`markers[${i}].iconPath`] = target;
    }
  });
  return patch;
}

/** 天气描述 -> 主题类名（晴/多云/雨雪/雾霾，默认品牌绿），类样式见 app.wxss */
const THEMES = [
  [/雨|雷|冰雹/, 'theme-rain'],
  [/雪/, 'theme-snow'],
  [/云|阴/, 'theme-cloudy'],
  [/雾|霾|沙|尘/, 'theme-fog'],
  [/晴/, 'theme-sunny'],
];

function weatherTheme(desc) {
  const d = String(desc || '');
  for (const [re, theme] of THEMES) {
    if (re.test(d)) { return theme; }
  }
  return 'theme-default';
}

/** 主题 -> 控件圆点颜色（与主卡主题同色系） */
const THEME_DOT_COLORS = {
  'theme-sunny': '#5da9e9',
  'theme-cloudy': '#8a97a5',
  'theme-rain': '#4ca1af',
  'theme-snow': '#8fb5d9',
  'theme-fog': '#9ca3af',
  'theme-default': '#4db900',
};

/** 天气描述 -> 图标文件（本地 PNG，与主题色系一致，跨平台渲染一致） */
function weatherIcon(desc) {
  const d = String(desc || '');
  if (/雷|电|暴/.test(d)) { return '../../img/weather/thunder.png'; }
  if (/雨|冰雹/.test(d)) { return '../../img/weather/rain.png'; }
  if (/雪/.test(d)) { return '../../img/weather/snow.png'; }
  if (/雾|霾|沙|尘/.test(d)) { return '../../img/weather/fog.png'; }
  if (/多云/.test(d)) { return '../../img/weather/cloudy.png'; }
  if (/阴/.test(d)) { return '../../img/weather/overcast.png'; }
  return '../../img/weather/sunny.png';
}

/** 7 天预报格式化：今天/周X 缩写 + 天气图标 + 按天气着色的圆点（主题色点，供其它页复用） */
function formatForecast(weatherData) {
  return (weatherData.forecast || []).map((f, i) => ({
    date: f.date,
    week: i === 0 ? '今天' : String(f.week || '').replace('星期', '周'),
    textDay: f.textDay,
    high: f.high,
    low: f.low,
    dotColor: THEME_DOT_COLORS[weatherTheme(f.textDay)] || '#4db900',
    icon: weatherIcon(f.textDay),
  }));
}

/**
 * 天气更新时间格式化（展示层）：接口原始格式 "20260903171500" -> "2026-09-03 17:15"；
 * 非紧凑格式（如老接口的 "17:15"）原样返回。
 */
function formatUptime(uptime) {
  if (typeof uptime !== 'string') { return uptime; }
  const m = uptime.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (!m) { return uptime; }
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
}

/** 两点球面距离（km） */
function distanceKm(lat1, lng1, lat2, lng2) {
  const rad = d => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 距离文案：<1km 显示米，否则保留 1 位小数公里 */
function distText(km) {
  return km < 1 ? (km * 1000).toFixed(0) + 'm' : km.toFixed(1) + 'km';
}

module.exports = {
  invoke,
  errMsg,
  RED_ICON,
  YELLOW_ICON,
  markerIconPatch,
  weatherTheme,
  formatForecast,
  distanceKm,
  distText,
  formatUptime,
};