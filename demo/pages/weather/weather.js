const { invoke, errMsg, weatherTheme, formatForecast, formatUptime } = require('../../utils/bmap');

/** AQI 等级（对应 GB 3095 六级） */
function aqiInfo(aqi) {
  if (aqi == null) { return null; }
  if (aqi <= 50) { return { level: '优', cls: 'aqi-good' }; }
  if (aqi <= 100) { return { level: '良', cls: 'aqi-ok' }; }
  if (aqi <= 150) { return { level: '轻度', cls: 'aqi-mild' }; }
  if (aqi <= 200) { return { level: '中度', cls: 'aqi-bad' }; }
  if (aqi <= 300) { return { level: '重度', cls: 'aqi-worse' }; }
  return { level: '严重', cls: 'aqi-worst' };
}

/** 今日日期文案，如 "9月3日 周四" */
function todayText() {
  const d = new Date();
  const weeks = ['日', '一', '二', '三', '四', '五', '六'];
  return `${d.getMonth() + 1}月${d.getDate()}日 周${weeks[d.getDay()]}`;
}

Page({
  data: {
    weather: null, // WeatherData：{ currentCity, district, weatherDesc, temperature, feelsLike, humidity, windDir, windClass, aqi, vis, updatedAt, forecast }
    stats: [], // [{ label, value, cls }] 2x3 数据宫格
    forecast: [], // [{ week, textDay, high, low, dotColor }] 7 天预报
    theme: 'theme-default',
    feels: '',
    today: '',
    updatedText: '', // 更新时间（已格式化，展示用）
    loading: true,
    error: '',
    /* 城市标题（国外查询时为所选城市名，国内为接口返回）与区县 */
    city: '',
    district: '',
    /* 国际城市快捷查询（weatherAbroad 的 location 仅接受"经度,纬度"，不支持城市名）；
       空 lng = 当前位置（国内） */
    cities: [
      { name: '当前位置', lng: '', lat: '' },
      { name: '东京', lng: '139.7671', lat: '35.6812' },
      { name: '伦敦', lng: '-0.1276', lat: '51.5072' },
      { name: '纽约', lng: '-74.0060', lat: '40.7128' },
      { name: '悉尼', lng: '151.2093', lat: '-33.8688' },
      { name: '巴黎', lng: '2.3522', lat: '48.8566' },
    ],
    activeCity: '当前位置',
  },

  /** 页面加载即按当前定位获取天气 */
  onLoad() {
    this.setData({ today: todayText() });
    this.fetchWeather();
  },

  async fetchWeather(opts = {}) {
    // 记录当前查询目标，刷新时保持（定位 / 指定城市）
    this._current = { location: opts.location || '', abroad: !!opts.abroad, city: opts.city || '' };
    this.setData({ loading: true, error: '' });
    try {
      const method = this._current.abroad ? 'weatherAbroad' : 'weather';
      const params = this._current.location ? { location: this._current.location } : {};
      const { weatherData } = await invoke(method, params);
      const theme = weatherTheme(weatherData.weatherDesc);
      const aqi = aqiInfo(weatherData.aqi);
      this.setData({
        weather: weatherData,
        city: this._current.city || weatherData.currentCity || '',
        district: this._current.city ? '' : (weatherData.district || ''),
        theme,
        feels: weatherData.feelsLike != null ? weatherData.feelsLike + '°' : '',
        updatedText: formatUptime(weatherData.updatedAt), // 展示层格式化（接口为原始紧凑格式）
        forecast: formatForecast(weatherData),
        stats: [
          { label: '湿度', value: this._withPercent(weatherData.humidity) },
          { label: '体感温度', value: weatherData.feelsLike != null ? weatherData.feelsLike + '°' : '—' },
          { label: '风向', value: weatherData.windDir || '—' },
          { label: '风力', value: weatherData.windClass || '—' },
          { label: '空气质量', value: aqi ? `${weatherData.aqi} ${aqi.level}` : '—', cls: aqi ? aqi.cls : '' },
          { label: '能见度', value: weatherData.vis != null ? (weatherData.vis / 1000).toFixed(1) + ' km' : '—' },
        ],
        loading: false,
      });
    } catch (err) {
      this.setData({ loading: false, error: '天气获取失败：' + errMsg(err) });
    }
  },

  /** 城市快捷切换（空 lng = 当前位置，走国内天气） */
  onCityTap(e) {
    const { lng, lat, name } = e.currentTarget.dataset;
    if (name === undefined) { return; }
    this.setData({ activeCity: name });
    this.fetchWeather(lng ? { location: `${lng},${lat}`, abroad: true, city: name } : {});
  },

  /** 重新获取（保持当前城市） */
  refresh() {
    this.fetchWeather(this._current);
  },

  /** 湿度补百分号（接口返回可能带 % 或不带） */
  _withPercent(value) {
    if (value == null) { return '—'; }
    const s = String(value);
    return s.indexOf('%') >= 0 ? s : s + '%';
  },
});