const {
  invoke,
  errMsg,
  RED_ICON,
  markerIconPatch,
  SCENES,
  toPoiList,
} = require('../../utils/bmap');

Page({
  data: {
    /* 搜索 */
    keyword: '美食',
    scenes: SCENES,
    activeScene: '美食',
    /* 地图 */
    latitude: 39.915,
    longitude: 116.404,
    markers: [],
    /* 结果 */
    pois: [], // [{ id, title, address, telephone, distText }]
    selectedId: -1,
    detail: null, // { title, distText, rows: [{label,value}] }
    loading: true,
    error: '',
  },

  onLoad() {
    this.searchAround('美食');
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  confirmSearch() {
    const q = (this.data.keyword || '').trim();
    if (q) { this.searchAround(q); }
  },

  /** 场景快选 */
  onSceneTap(e) {
    const scene = e.currentTarget.dataset.scene;
    this.setData({ keyword: scene, activeScene: scene });
    this.searchAround(scene);
  },

  /** 关键词周边检索（以当前位置为圆心） */
  async searchAround(query) {
    const q = (query || '').trim() || '美食';
    this.setData({
      loading: true,
      error: '',
      activeScene: this.data.scenes.indexOf(q) >= 0 ? q : '',
    });
    try {
      const { wxMarkerData } = await invoke('search', {
        query: q,
        location: `${this.data.latitude},${this.data.longitude}`,
        iconPath: RED_ICON,
        iconTapPath: RED_ICON,
      });
      const pois = toPoiList(wxMarkerData, this.data.latitude, this.data.longitude);
      this.setData({ markers: wxMarkerData || [], pois, loading: false, selectedId: -1, detail: null });
      if (pois.length) { this.selectPoi(0); }
    } catch (err) {
      this.setData({ loading: false, error: '周边检索失败：' + errMsg(err) });
    }
  },

  /** 选中 POI：高亮 marker + 地图聚焦 + 详情展示 */
  selectPoi(id) {
    const poi = this.data.pois[id];
    const marker = this.data.markers[id];
    if (!poi || !marker) { return; }
    // 路径式更新图标（不整组重建 markers，避免地图闪烁）
    this.setData(Object.assign(markerIconPatch(this.data.markers, id), {
      selectedId: id,
      latitude: marker.latitude,
      longitude: marker.longitude,
      detail: {
        title: poi.title,
        distText: poi.distText,
        rows: [
          { label: '地址', value: poi.address || '暂无' },
          { label: '电话', value: poi.telephone || '暂无' },
        ],
      },
    }));
  },

  onPoiTap(e) {
    this.selectPoi(e.currentTarget.dataset.id);
  },

  onMarkerTap(e) {
    this.selectPoi(e.markerId);
  },
});