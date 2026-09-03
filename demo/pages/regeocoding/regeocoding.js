const {
  invoke,
  errMsg,
  RED_ICON,
  markerIconPatch,
  distText,
} = require('../../utils/bmap');

Page({
  data: {
    markers: [],
    latitude: '',
    longitude: '',
    address: '', // formatted_address
    infoData: [], // [{ label, value }] 描述 / 商圈
    pois: [], // [{ uid, name, addr, distText }] 周边 POI
    loading: true,
    error: '',
  },

  /** 页面加载即对当前定位做逆地理编码 */
  onLoad() {
    this.locate();
  },

  /** 逆地理编码当前定位 */
  async locate() {
    this.setData({ loading: true, error: '' });
    try {
      const { wxMarkerData, originalData } = await invoke('reverseGeocoding', {
        iconPath: RED_ICON,
        iconTapPath: RED_ICON,
      });
      const m = wxMarkerData && wxMarkerData[0];
      if (!m) { throw new Error('未解析到定位信息'); }
      const resultPois = (originalData && originalData.result && originalData.result.pois) || [];
      this.setData({
        markers: wxMarkerData,
        latitude: m.latitude,
        longitude: m.longitude,
        address: m.address || '',
        infoData: [
          { label: '描述', value: m.desc || '暂无' },
          { label: '商圈', value: m.business || '暂无' },
        ],
        pois: resultPois.slice(0, 5).map(p => ({
          uid: p.uid,
          name: p.name,
          addr: p.addr || '',
          distText: p.distance != null ? distText(Number(p.distance) / 1000) : '',
        })),
        loading: false,
      });
    } catch (err) {
      this.setData({ loading: false, error: '逆地理编码失败：' + errMsg(err) });
    }
  },

  /** 复制完整地址 */
  copyAddress() {
    if (!this.data.address) { return; }
    wx.setClipboardData({
      data: this.data.address,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    });
  },

  /** 点击 marker：高亮 */
  onMarkerTap(e) {
    const marker = this.data.markers[e.markerId];
    if (!marker) { return; }
    this.setData(markerIconPatch(this.data.markers, e.markerId));
  },
});