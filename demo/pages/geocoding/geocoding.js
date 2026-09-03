const {
  invoke,
  errMsg,
  RED_ICON,
  markerIconPatch
} = require('../../utils/bmap');

Page({
  data: {
    markers: [],
    address: '北京市海淀区上地十街10号',
    latitude: '',
    longitude: '',
    result: null, // { address, lng, lat } 解析结果（6 位精度展示）
    error: '',
    loading: false,
  },

  /** 页面加载即解析默认地址 */
  onLoad() {
    this.resolveAddress();
  },

  onAddressInput(e) {
    this.setData({ address: e.detail.value });
  },

  /** 地址 -> 经纬度（地理编码） */
  async resolveAddress() {
    const address = this.data.address.trim();
    if (!address) {
      this.setData({ error: '请输入待解析地址' });
      return;
    }
    this.setData({ loading: true, error: '' });
    try {
      const { wxMarkerData } = await invoke('geocoding', {
        address,
        iconPath: RED_ICON,
        iconTapPath: RED_ICON,
      });
      if (!wxMarkerData.length) {
        this.setData({ loading: false, error: '未解析出该地址的坐标，请确认地址是否有效' });
        return;
      }
      const m = wxMarkerData[0];
      this.setData({
        markers: wxMarkerData,
        latitude: m.latitude,
        longitude: m.longitude,
        result: {
          address,
          lng: Number(m.longitude).toFixed(6),
          lat: Number(m.latitude).toFixed(6),
        },
        loading: false,
      });
    } catch (err) {
      this.setData({ loading: false, error: '地理编码失败：' + errMsg(err) });
    }
  },

  /** 复制坐标（经度,纬度） */
  copyCoords() {
    const r = this.data.result;
    if (!r) { return; }
    wx.setClipboardData({
      data: `${r.lng},${r.lat}`,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    });
  },

  /** 点击 marker：高亮并更新坐标信息 */
  onMarkerTap(e) {
    const marker = this.data.markers[e.markerId];
    if (!marker) { return; }
    // 路径式更新图标（不整组重建 markers，避免地图闪烁）
    this.setData(Object.assign(markerIconPatch(this.data.markers, e.markerId), {
      latitude: marker.latitude,
      longitude: marker.longitude,
    }));
  },
});