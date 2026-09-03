const {
  invoke,
  errMsg,
  RED_ICON,
  YELLOW_ICON,
} = require('../../utils/bmap');

const MODES = [
  { key: 'driving', label: '驾车' },
  { key: 'transit', label: '公交' },
  { key: 'walking', label: '步行' },
  { key: 'riding', label: '骑行' },
];

let routeToken = 0; // 请求序号：切换模式 / 重新规划时丢弃过期响应

/** turn_type_id -> 转向文案（实测：3=右转 / 6=左转 / 7=直行；骑行接口直接给 turn_type 文本） */
const TURN_TEXT = { 3: '右转', 6: '左转', 7: '直行' };

Page({
  data: {
    modes: MODES,
    activeMode: 'driving',
    origin: '39.908823,116.397470',   // 天安门
    destination: '39.933362,116.380635', // 西直门
    markers: [],
    polyline: [],
    routePoints: [], // include-points 视野采样点（自适应框住整条路线）
    latitude: 39.92,
    longitude: 116.43,
    /* 路线摘要（产品化布局） */
    plans: [], // [{ key, label }] 多方案切换（单一方案时隐藏）
    activePlan: 0,
    planOrigin: '',
    planDestination: '',
    sumDistance: '',
    sumDuration: '',
    sumRoutes: '',
    stepPrev: [], // [{ i, text, dist }] 行程预览（收起时前 3 条）
    stepAll: [], // 全部步骤（展开用）
    stepsExpanded: false,
    extras: [], // [{ label, value }] 打车费/过路费/票价/到达时间
    error: '',
    loading: false,
  },

  /** 切换交通方式：已有路线时自动重新规划 */
  onModeTap(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.activeMode) { return; }
    routeToken++;
    this.setData({ activeMode: key, error: '' });
    if (this.data.sumDistance) { this.planRoute(); }
  },

  onOriginInput(e) {
    this.setData({ origin: e.detail.value });
  },

  onDestinationInput(e) {
    this.setData({ destination: e.detail.value });
  },

  /** 交换起终点：已有路线时自动重新规划 */
  swapEndpoints() {
    const { origin, destination } = this.data;
    this.setData({ origin: destination, destination: origin });
    if (this.data.sumDistance) { this.planRoute(); }
  },

  /** 切换方案：摘要/行程/费用/地图折线全套联动 */
  onPlanTap(e) {
    this._applyPlan(e.currentTarget.dataset.index);
  },

  /** 展开/收起行程预览 */
  toggleSteps() {
    const expanded = !this.data.stepsExpanded;
    this.setData({
      stepsExpanded: expanded,
      stepPrev: expanded ? this.data.stepAll : this.data.stepAll.slice(0, 3),
    });
  },

  /** 发起路线规划 */
  async planRoute() {
    const mode = this.data.activeMode;
    const origin = this.data.origin.trim();
    const destination = this.data.destination.trim();
    if (!origin || !destination) {
      this.setData({ error: '请输入起点和终点（支持"纬度,经度"或地点名称）' });
      return;
    }
    if (this.data.loading) { return; } // 防止快速连点重复发起
    const token = ++routeToken;
    this.setData({ loading: true, error: '' });
    try {
      const params = { origin, destination };
      if (mode === 'transit') {
        params.region = '北京市';
      }
      const { routes } = await invoke(mode, params);
      if (token !== routeToken) { return; } // 过期响应直接丢弃
      if (!routes.length) {
        this.setData({ loading: false, error: '未规划出路线方案，请检查起终点后重试' });
        return;
      }
      // 起终点 marker：仅"纬度,经度"输入可精确标注，地点名交由接口解析，不画 marker
      const start = this._coord(origin);
      const end = this._coord(destination);
      const markers = [];
      if (start) {
        markers.push({
          id: 0,
          latitude: start.latitude,
          longitude: start.longitude,
          iconPath: RED_ICON,
          width: 30,
          height: 30,
        });
      }
      if (end) {
        markers.push({
          id: 1,
          latitude: end.latitude,
          longitude: end.longitude,
          iconPath: YELLOW_ICON,
          width: 30,
          height: 30,
        });
      }
      // 多方案缓存到实例（不进 setData），由 _applyPlan 按选中方案渲染
      this._allRoutes = routes;
      this.setData({
        markers,
        latitude: (start || end || {}).latitude || 39.915,
        longitude: (start || end || {}).longitude || 116.404,
        planOrigin: origin,
        planDestination: destination,
        plans: routes.map((r, i) => ({ key: i, label: r.tag || '方案' + (i + 1) })),
        loading: false,
      });
      this._applyPlan(0);
    } catch (err) {
      if (token !== routeToken) { return; }
      let message = '路线规划失败：' + errMsg(err);
      // status 240 = APP 服务被禁用：路线规划为独立配额服务，当前 ak 未开通
      if (err.statusCode === 240 || message.indexOf('服务被禁用') >= 0) {
        message += '；请在 https://lbsyun.baidu.com/ 控制台为当前 ak 开通「路线规划」服务，或换用已开通的服务端类型 ak';
      }
      this.setData({ loading: false, error: message });
    }
  },

  /** 按方案索引渲染：摘要 + 行程 + 费用 + 地图折线/视野 */
  _applyPlan(index) {
    const routes = this._allRoutes;
    const r = routes && routes[index];
    if (!r) { return; }
    const all = [];
    this._collectSteps(r.steps, all, 0);
    this.setData({
      activePlan: index,
      sumDistance: (r.distance / 1000).toFixed(1) + ' 公里',
      sumDuration: '约 ' + Math.max(1, Math.round(r.duration / 60)) + ' 分钟',
      sumRoutes: routes.length + ' 套',
      stepAll: all,
      stepPrev: this.data.stepsExpanded ? all : all.slice(0, 3),
      extras: this._planExtras(r),
      polyline: [{
        points: r.polyline || [],
        color: '#4db900',
        width: 5,
        arrowLine: true,
      }],
      routePoints: this._sample(r.polyline),
    });
  },

  /** 附加信息：不同交通方式字段不同（打车费/过路费/票价/到达时间） */
  _planExtras(r) {
    const extras = [];
    if (r.taxi_fee != null) { extras.push({ label: '打车费', value: '约 ' + r.taxi_fee + ' 元' }); }
    if (r.toll != null) { extras.push({ label: '过路费', value: r.toll + ' 元' }); }
    if (r.price != null) { extras.push({ label: '票价', value: r.price + ' 元' }); }
    if (r.arrive_time) { extras.push({ label: '到达', value: r.arrive_time }); }
    return extras;
  },

  /** 递归收集全部步进文案（transit 为嵌套数组，与 SDK 折线收集同源思路）
   *  字段差异：driving 用 road_name；transit/walking/riding 用 instructions（可能含 <b> 标签，需清洗）
   *  上限 50 条防畸形响应撑爆卡片 */
  _collectSteps(nodes, out, depth) {
    if (depth > 8 || out.length >= 50) { return; }
    (nodes || []).forEach(node => {
      if (out.length >= 50) { return; }
      if (Array.isArray(node)) {
        this._collectSteps(node, out, depth + 1);
        return;
      }
      if (!node || typeof node !== 'object') { return; }
      const raw = node.instructions || node.instruction || node.road_name || node.stepOriginInstruction;
      if (raw) {
        out.push({
          i: out.length,
          text: String(raw).replace(/<[^>]*>/g, ''),
          dist: node.distance,
          turn: node.turn_type || TURN_TEXT[node.turn_type_id] || '',
        });
      }
      this._collectSteps(node.steps, out, depth + 1);
    });
  },

  /** 折线采样：均匀取 ~24 点（含首尾），供 include-points 视野自适应 */
  _sample(pts) {
    if (!pts || !pts.length) { return []; }
    const step = Math.max(1, Math.floor(pts.length / 24));
    const sampled = [];
    for (let i = 0; i < pts.length; i += step) { sampled.push(pts[i]); }
    if (sampled[sampled.length - 1] !== pts[pts.length - 1]) {
      sampled.push(pts[pts.length - 1]);
    }
    return sampled;
  },

  /** 解析 "纬度,经度" 输入；无法解析（如地点名称）返回 null */
  _coord(str) {
    const parts = String(str).split(',');
    const lat = Number(parts[0]);
    const lng = Number(parts[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { return null; }
    return { latitude: lat, longitude: lng };
  },
});