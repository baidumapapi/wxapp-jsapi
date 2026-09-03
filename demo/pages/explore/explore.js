const {
  invoke,
  errMsg,
  RED_ICON,
  YELLOW_ICON,
  markerIconPatch,
  weatherTheme,
  formatForecast,
  distanceKm,
  distText,
} = require('../../utils/bmap');

/** 天气主题 -> 胶囊圆点颜色 */
const DOT_COLORS = {
  'theme-sunny': '#ffd76e',
  'theme-cloudy': '#aab4c0',
  'theme-rain': '#7fd0de',
  'theme-snow': '#cfe3f5',
  'theme-fog': '#c3c9d3',
  'theme-default': '#9be15d',
};

const SCENES = ['美食', '酒店', '景点', '咖啡', '公园'];

let sugTimer = null;
let sugToken = 0;

Page({
  data: {
    /* 定位 */
    located: false,
    locationText: '',
    /* 地图 */
    latitude: 39.908823,
    longitude: 116.397470,
    markers: [],
    polyline: [],
    /* 搜索联想 */
    keyword: '',
    suggestions: [],
    /* 场景检索 */
    scenes: SCENES,
    activeScene: '美食',
    searching: false,
    pois: [], // [{ id, title, address, telephone, dist }]
    /* POI 详情弹层 */
    detail: null,
    showDetail: false,
    callable: false,
    /* 路线 */
    modes: [
      { key: 'driving', label: '驾车' },
      { key: 'transit', label: '公交' },
      { key: 'walking', label: '步行' },
      { key: 'riding', label: '骑行' },
    ],
    routeMode: 'driving',
    routing: false,
    routeInfo: null, // { mode, distance, duration, count }
    showPanel: false, // 路线面板是否已挂载（结果只在面板内切换，避免闪烁）
    /* 天气 */
    showWeather: false,
    weather: null,
    forecast: [],
    weatherTheme: '',
    weatherDot: '',
    /* 地图海报 */
    poster: '',
    posterLoading: false,
    /* 通用 */
    error: '',
  },

  onLoad() {
    this.locate().then(() => {
      this.fetchWeather();
      // 开场即检索，用户一进来就有内容
      this.searchAround(SCENES[0]);
    });
  },

  onUnload() {
    clearTimeout(sugTimer);
  },

  /* ================= 定位 ================= */

  async locate() {
    this.setData({ error: '' });
    try {
      const { wxMarkerData } = await invoke('reverseGeocoding', {});
      const m = wxMarkerData && wxMarkerData[0];
      if (!m) { throw new Error('未解析到定位信息'); }
      const pieces = [m.address && m.address.replace(/,/g, ' '), m.business && `商圈 ${m.business}`]
        .filter(Boolean);
      this.setData({
        located: true,
        locationText: pieces.join(' · '),
        latitude: m.latitude,
        longitude: m.longitude,
      });
    } catch (err) {
      this.setData({ error: '定位失败：' + errMsg(err) });
    }
  },

  /* ================= 天气 ================= */

  async fetchWeather() {
    try {
      const { weatherData } = await invoke('weather', {});
      const theme = weatherTheme(weatherData.weatherDesc);
      this.setData({
        weather: weatherData,
        forecast: formatForecast(weatherData),
        weatherTheme: theme,
        weatherDot: DOT_COLORS[theme] || '#9be15d',
      });
    } catch (e) { /* 静默 */ }
  },

  toggleWeather() {
    this.setData({ showWeather: !this.data.showWeather });
  },

  /* ================= 搜索联想 ================= */

  confirmSearch() {
    const q = (this.data.keyword || '').trim();
    if (q) { this.searchAround(q); }
  },

  onKeywordInput(e) {
    const keyword = e.detail.value;
    clearTimeout(sugTimer);
    this.setData({ keyword, suggestions: [], error: '' });
    if (!keyword.trim()) { return; }
    sugTimer = setTimeout(() => this.fetchSuggestions(keyword.trim()), 300);
  },

  async fetchSuggestions(keyword) {
    const token = ++sugToken;
    try {
      const { result } = await invoke('suggestion', {
        query: keyword,
        region: (this.data.weather && this.data.weather.currentCity) || '',
      });
      if (token !== sugToken) { return; }
      this.setData({ suggestions: result || [] });
    } catch (e) { /* 静默 */ }
  },

  onSugTap(e) {
    const { name } = e.currentTarget.dataset;
    this.setData({ keyword: name, suggestions: [] });
    this.searchAround(name);
  },

  /* ================= 场景检索（周边 POI） ================= */

  onSceneTap(e) {
    const scene = e.currentTarget.dataset.scene;
    this.setData({ activeScene: scene, showDetail: false, suggestions: [] });
    this.searchAround(scene);
  },

  async searchAround(query) {
    const q = (query || '').trim() || '美食';
    this.setData({ searching: true, activeScene: this.data.scenes.indexOf(q) >= 0 ? q : '', error: '' });
    try {
      const { wxMarkerData } = await invoke('search', {
        query: q,
        location: `${this.data.latitude},${this.data.longitude}`,
        iconPath: RED_ICON,
        iconTapPath: RED_ICON,
      });
      const pois = (wxMarkerData || []).map((m, i) => {
        const dist = distanceKm(this.data.latitude, this.data.longitude, m.latitude, m.longitude);
        return {
          id: i,
          title: m.title,
          address: m.address,
          telephone: m.telephone,
          dist,
          distText: distText(dist),
        };
      });
      this.setData({
        markers: wxMarkerData || [],
        pois,
        searching: false,
        polyline: [],
        routeInfo: null,
      });
    } catch (err) {
      this.setData({ searching: false, error: '检索失败：' + errMsg(err) });
    }
  },

  /* ================= POI 详情弹层 ================= */

  onPoiTap(e) {
    this.showDetailById(e.currentTarget.dataset.id);
  },

  onMarkerTap(e) {
    this.showDetailById(e.markerId);
  },

  showDetailById(id) {
    const poi = this.data.pois[id];
    const marker = this.data.markers[id];
    if (!poi || !marker) { return; }
    // 路径式更新图标（不整组重建 markers，避免地图闪烁）
    this.setData(Object.assign(markerIconPatch(this.data.markers, id), {
      detail: {
        id: poi.id,
        title: poi.title,
        address: poi.address,
        telephone: poi.telephone,
        dist: poi.dist,
        distText: poi.distText || '',
        latitude: marker.latitude,
        longitude: marker.longitude,
      },
      showDetail: true,
      callable: !!poi.telephone,
      routeInfo: null, // 切换目标清空旧路线，面板内显示占位而非旧数据
      polyline: [],
      error: '',
    }));
  },

  closeDetail() {
    this.setData({ showDetail: false, poster: '' });
  },

  noop() {},

  callPoi() {
    const tel = this.data.detail && this.data.detail.telephone;
    if (!tel) { return; }
    wx.makePhoneCall({ phoneNumber: tel, fail: () => {} });
  },

  /* ================= 路线规划 ================= */

  onModeTap(e) {
    const mode = e.currentTarget.dataset.key;
    if (mode === this.data.routeMode) { return; }
    // 先清空旧结果，避免展示上一种方式的详情造成误导
    this.setData({ routeMode: mode, routeInfo: null, polyline: [] });
    // 已有规划目标时，切换方式自动重新规划
    if (this.data.detail) { this.planRoute(); }
  },

  async planRoute() {
    const d = this.data.detail;
    if (!d) { return; }
    const params = {
      origin: `${this.data.latitude},${this.data.longitude}`,
      destination: `${d.latitude},${d.longitude}`,
    };
    const mode = this.data.routeMode;
    if (mode === 'transit' && this.data.weather) { params.region = this.data.weather.currentCity; }
    // 面板首次挂载后常驻，切换方式只在内部切换加载/数据态，避免卸载重建闪烁
    this.setData({ routing: true, showPanel: true, error: '' });
    try {
      const { routes, wxPolylineData } = await invoke(mode, params);
      if (!routes.length) {
        this.setData({ routing: false, showDetail: false, poster: '', error: '未规划出路线方案' });
        return;
      }
      const best = routes[0];
      this.setData({
        polyline: [{ points: wxPolylineData, color: '#4db900', width: 5, arrowLine: true }],
        routeInfo: {
          mode: this.data.modes.find(m => m.key === mode).label,
          distance: (best.distance / 1000).toFixed(1) + ' 公里',
          duration: '约 ' + Math.max(1, Math.round(best.duration / 60)) + ' 分钟',
          count: routes.length + ' 套方案',
        },
        routing: false,
        showDetail: false, // 收起弹层，把画面让给地图上的路线
        poster: '',
      });
    } catch (err) {
      this.setData({ routing: false, showDetail: false, poster: '', error: '路线规划失败：' + errMsg(err) });
    }
  },

  /* ================= 地图海报（静态图） ================= */

  async makePoster() {
    const d = this.data.detail;
    if (!d) { return; }
    this.setData({ posterLoading: true, error: '' });
    try {
      const { url } = await invoke('staticMap', {
        center: `${d.longitude},${d.latitude}`,
        // 文字标注官方格式：labels 传坐标，labelStyles 传内容与样式
        labels: `${d.longitude},${d.latitude}`,
        labelStyles: `${d.title.slice(0, 8)},1,18,0x006600,0xFFFFFF,1`,
        width: 750,
        height: 500,
      });
      this.setData({ poster: url, posterLoading: false });
    } catch (err) {
      this.setData({ posterLoading: false, error: '海报生成失败：' + errMsg(err) });
    }
  },

  savePoster() {
    if (!this.data.poster) { return; }
    wx.showToast({ title: '长按上方图片可保存', icon: 'none' });
  },
});