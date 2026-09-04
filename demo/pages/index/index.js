const { invoke, weatherTheme, formatForecast, weatherDotColor } = require('../../utils/bmap');

const DEMOS = [
  {
    path: '/pages/explore/explore',
    title: '周边探索',
    desc: '定位 → 场景检索 → POI 详情 → 一键路线 → 地图海报，全能力产品化演示',
  },
  {
    path: '/pages/search/search',
    title: 'POI 周边检索',
    desc: 'search()：检索当前位置周边美食 POI 并展示在地图上',
  },
  {
    path: '/pages/suggestion/suggestion',
    title: '关键词建议',
    desc: 'suggestion()：输入关键字实现地点联想补全',
  },
  {
    path: '/pages/geocoding/geocoding',
    title: '地理编码',
    desc: 'geocoding()：地址与建筑名 -> 经纬度',
  },
  {
    path: '/pages/regeocoding/regeocoding',
    title: '逆地理编码',
    desc: 'reverseGeocoding()：经纬度 -> 地址、商圈等描述信息',
  },
  {
    path: '/pages/route/route',
    title: '路线规划',
    desc: 'driving/walking/transit/riding：起终点路线并绘制折线',
  },
  {
    path: '/pages/staticmap/staticmap',
    title: '静态图',
    desc: 'staticMap()：生成地图图片 URL，直接用于 image 组件',
  },
  {
    path: '/pages/weather/weather',
    title: '天气查询',
    desc: 'weather()：按当前定位查询实时天气',
  },
];

Page({
  data: {
    demos: DEMOS,
    weather: null, // 主页顶部天气摘要：{ currentCity, district, weatherDesc, temperature }
    forecast: [], // 7 天迷你预报
    theme: '', // 天气主题类名（空=保持默认深色 Hero）
    weatherDot: '', // 摘要小圆点颜色
  },

  onLoad() {
    this.fetchWeather();
  },

  /** 拉取当前定位天气；失败时静默隐藏，不影响主页 */
  async fetchWeather() {
    try {
      const { weatherData } = await invoke('weather', {});
      const theme = weatherTheme(weatherData.weatherDesc);
      this.setData({
        weather: weatherData,
        forecast: formatForecast(weatherData),
        theme,
        weatherDot: weatherDotColor(theme),
      });
    } catch (err) {
      /* 忽略：天气取不到时顶部不展示 */
    }
  },

  /** 点击天气摘要进入天气详情页 */
  onWeatherTap() {
    wx.navigateTo({ url: '/pages/weather/weather' });
  },

  /** 点击卡片进入对应示例 */
  onDemoTap(e) {
    wx.navigateTo({ url: e.currentTarget.dataset.path });
  },
});