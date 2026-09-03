const { invoke, errMsg } = require('../../utils/bmap');

Page({
  data: {
    /* 取景地图初始位置：地图为单向输入源，拖动/缩放后不再回写，避免受控属性导致跳动 */
    mapLat: 39.908823,
    mapLng: 116.397470,
    mapZoom: 11,
    /* 随地图拖动更新，作为生成中心与面板展示 */
    centerLat: 39.908823,
    centerLng: 116.397470,
    zoom: 11,
    /* ---- 基础参数 ---- */
    labelText: '我的位置',
    scale: 1, // 1 普通 / 2 高清
    width: 750,
    height: 460,
    /* ---- 高级参数 ---- */
    showAdvanced: false,
    markers: '', // 标注点坐标："lng,lat|lng2,lat2"（多个用竖线 | 分隔）
    markerStyles: '', // size,label,color（label 为标注文字）
    paths: '', // 折线/"lng,lat;lng2,lat2|..."
    pathStyles: '', // color,weight,opacity[,fillColor]
    coordtype: 'gcj02ll', // gcj02ll / bd09ll / wgs84ll
    dpiType: 'ph', // ph 高清屏 / pl 低分屏（自 V3 起已废弃，保留兼容）
    copyright: 0, // 0 log+文字 / 1 纯文字
    /* ---- 结果 ---- */
    mapUrl: '',
    loading: false,
    error: '',
    imgError: '',
  },

/**
   * 同步取景参数：经 MapContext 读取地图实际视野（与操作方式无关，幂等）。
   * 返回 Promise，便于生成前强制同步一次。
   */
  _syncView() {
    const ctx = wx.createMapContext('staticmap-map', this);
    const patch = {};
    let pending = 2;
    return new Promise((resolve) => {
      const done = () => {
        if (--pending <= 0) {
          // 仅实际值变化才 setData（500ms 轮询下避免持续整页 diff 重渲染）
          const dirty = Object.keys(patch).some(k => this.data[k] !== patch[k]);
          if (dirty) { this.setData(patch); }
          resolve();
        }
      };
      ctx.getScale({
        success: (r) => {
          if (r && r.scale != null) {
            let z = Math.round(Number(r.scale));
            if (Number.isFinite(z)) {
              if (z < 3) { z = 3; }
              if (z > 19) { z = 19; }
              patch.zoom = z;
            }
          }
        },
        complete: done,
      });
      ctx.getCenterLocation({
        success: (r) => {
          if (r && r.longitude != null && r.latitude != null) {
            patch.centerLng = r.longitude;
            patch.centerLat = r.latitude;
          }
        },
        complete: done,
      });
    });
  },

  /** 地图视野变化结束（拖动/缩放） */
  onMapRegionChange(e) {
    if (e.type !== 'end') { return; }
    this._syncView();
  },

  /** 触摸结束：双指缩放可能不触发 regionchange 的 end，此处兜底同步 */
  onMapTouchEnd() {
    this._syncView();
  },

  /**
   * 轮询同步视野：模拟器/部分基础库下缩放（+/- 控件、滚轮、双指）的事件
   * 不可靠，页面显示期间每 500ms 查询一次实际视野，保证面板与地图一致。
   */
  onShow() {
    if (!this._viewTimer) {
      this._viewTimer = setInterval(() => this._syncView(), 500);
    }
  },

  onHide() { this._clearViewTimer(); },

  onUnload() { this._clearViewTimer(); },

  _clearViewTimer() {
    if (this._viewTimer) {
      clearInterval(this._viewTimer);
      this._viewTimer = null;
    }
  },

  onLabelInput(e) { this.setData({ labelText: e.detail.value }); },
  onScaleTap(e) { this.setData({ scale: Number(e.currentTarget.dataset.scale) }); },
  onWidthInput(e) { this.setData({ width: Number(e.detail.value) || 0 }); },
  onHeightInput(e) { this.setData({ height: Number(e.detail.value) || 0 }); },
  onMarkersInput(e) { this.setData({ markers: e.detail.value }); },
  onMarkerStylesInput(e) { this.setData({ markerStyles: e.detail.value }); },
  onPathsInput(e) { this.setData({ paths: e.detail.value }); },
  onPathStylesInput(e) { this.setData({ pathStyles: e.detail.value }); },

  onCoordtypeTap(e) { this.setData({ coordtype: e.currentTarget.dataset.value }); },
  onDpiTap(e) { this.setData({ dpiType: e.currentTarget.dataset.value }); },
  onCopyrightTap(e) { this.setData({ copyright: Number(e.currentTarget.dataset.value) }); },

  toggleAdvanced() { this.setData({ showAdvanced: !this.data.showAdvanced }); },

  /** 以当前地图视野中心生成静态图（scale=2 时宽高须 ≤512，接口自动降级） */
  async generate() {
    if (this.data.loading) { return; }
    // 生成前强制同步一次实际视野，保证生成参数与地图所见一致
    await this._syncView();
    const center = `${this.data.centerLng},${this.data.centerLat}`;
    const label = (this.data.labelText || '').trim() || '中心点';
    const hd = this.data.scale === 2;
    let width = this.data.width || (hd ? 512 : 750);
    let height = this.data.height || (hd ? 320 : 460);
    let zoom = this.data.zoom;
    if (hd) {
      // 高清图：宽高 ≤512、zoom ≤18（低清为 [3,19]）
      if (width > 512) { width = 512; }
      if (height > 512) { height = 512; }
      if (zoom > 18) { zoom = 18; }
    }
    const params = {
      center,
      zoom,
      scale: this.data.scale,
      width,
      height,
      coordtype: this.data.coordtype,
      dpiType: this.data.dpiType,
      copyright: this.data.copyright,
      // 文字标注官方用法：labels 传坐标，labelStyles 传内容与样式（content,fontWeight,fontSize,fontColor,bgColor,border）
      labels: center,
      labelStyles: `${label},1,18,0x006600,0xFFFFFF,1`,
    };
    // 高级参数：仅传入非空的
    if (this.data.markers.trim()) { params.markers = this.data.markers.trim(); }
    if (this.data.markerStyles.trim()) { params.markerStyles = this.data.markerStyles.trim(); }
    if (this.data.paths.trim()) { params.paths = this.data.paths.trim(); }
    if (this.data.pathStyles.trim()) { params.pathStyles = this.data.pathStyles.trim(); }
    this.setData({ loading: true, error: '', imgError: '' });
    try {
      const { url } = await invoke('staticMap', params);
      this.setData({ mapUrl: url, loading: false });
    } catch (err) {
      this.setData({ loading: false, error: '静态图生成失败：' + errMsg(err) });
    }
  },

  /** 图片加载失败：明示原因（网络/域名），并提示可用浏览器验证 URL */
  onImgError(e) {
    this.setData({
      imgError: '图片加载失败（' + (e.detail && e.detail.errMsg || '网络错误') + '）。已生成 URL 见下方，可复制到浏览器验证；' +
        '若浏览器可显示，请检查工具网络或清缓存重试',
    });
  },

  /** 复制生成 URL（便于外部验证） */
  copyUrl() {
    if (!this.data.mapUrl) { return; }
    wx.setClipboardData({
      data: this.data.mapUrl,
      success: () => wx.showToast({ title: 'URL 已复制', icon: 'none' }),
    });
  },

  /** 点击图片：全屏预览 */
  preview() {
    if (!this.data.mapUrl) { return; }
    wx.previewImage({ urls: [this.data.mapUrl] });
  },
});