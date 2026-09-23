/**
 * Place API V3 接口测试页
 *
 * 覆盖 SDK V3 路径：/place/v3/around（周边检索）、/place/v3/region（城市检索）、
 * /place/v3/suggestion（输入联想）。每次点击在控制台打印完整入参与返回结果，
 * 页面同步展示最近一次调用的摘要。
 */
const { invoke, errMsg, RED_ICON } = require('../../utils/bmap');

Page({
  data: {
    running: false,
    activeId: '',
    /** 最近一次调用摘要 */
    log: null, // { label, paramsText, result, error }
    /** 结果预览（POI 名称，最多 5 条） */
    preview: [],
    /** 测试用例 */
    cases: [
      {
        id: 'around',
        method: 'search',
        label: '周边检索 /place/v3/around',
        desc: 'query + location（北京天安门）',
        params: { query: '美食', location: '39.915,116.404', iconPath: RED_ICON, iconTapPath: RED_ICON },
      },
      {
        id: 'around-v3',
        method: 'search',
        label: '周边检索（V3 参数透传）',
        desc: 'tag / type / radius_limit / is_light_version',
        params: {
          query: '美食',
          location: '39.915,116.404',
          tag: '美食',
          type: '火锅',
          radius_limit: true,
          is_light_version: true,
          iconPath: RED_ICON,
          iconTapPath: RED_ICON,
        },
      },
      {
        id: 'region',
        method: 'search',
        label: '城市检索 /place/v3/region',
        desc: 'query + region（南昌大学，无需定位）',
        params: { query: '南昌大学', region: '南昌', iconPath: RED_ICON, iconTapPath: RED_ICON },
      },
      {
        id: 'region-center',
        method: 'search',
        label: '城市检索（距离排序）',
        desc: 'query + region + center',
        params: { query: '美食', region: '南昌', center: '28.68,115.86', iconPath: RED_ICON, iconTapPath: RED_ICON },
      },
      {
        id: 'suggestion',
        method: 'suggestion',
        label: '输入联想 /place/v3/suggestion',
        desc: 'query + region + city_limit',
        params: { query: '天安门', region: '北京', city_limit: true },
      },
      {
        id: 'around-min',
        method: 'search',
        label: '周边检索（仅 query，最简）',
        desc: '只传 query：location 取当前定位，radius 不传由服务端默认（需定位授权）',
        params: { query: '咖啡' },
      },
      {
        id: 'region-min',
        method: 'search',
        label: '城市检索（仅 query+region，最简）',
        desc: '只传必填项：query + region，其余全走默认',
        params: { query: '小吃', region: '成都' },
      },
      {
        id: 'suggestion-min',
        method: 'suggestion',
        label: '输入联想（仅必填，最简）',
        desc: '只传 query + region（region 为必选，未传服务端报参数错）',
        params: { query: '故宫', region: '北京' },
      },
    ],
  },

  /** 点击测试按钮：打印入参 → 调用 → 打印结果（成功/失败） */
  onCaseTap(e) {
    const { id } = e.currentTarget.dataset;
    const item = this.data.cases.find(c => c.id === id);
    if (!item || this.data.running) { return; }
    const params = Object.assign({}, item.params);

    console.log(`\n[v3test] ================= ${item.label} =================`);
    console.log(`[v3test] 入参:\n${JSON.stringify(params, null, 2)}`);
    this.setData({ activeId: id, running: true, log: null, preview: [] });

    invoke(item.method, params)
      .then(res => {
        const list = res.wxMarkerData || res.result || [];
        console.log('[v3test] 原始响应:', res.originalData);
        console.log(`[v3test] 命中 ${list.length} 条:\n`, list);
        this.setData({
          running: false,
          log: {
            label: item.label,
            paramsText: JSON.stringify(params),
            result: `成功，命中 ${list.length} 条`,
            error: '',
          },
          preview: list.slice(0, 5),
        });
      })
      .catch(err => {
        console.error('[v3test] 失败:', err);
        this.setData({
          running: false,
          log: { label: item.label, paramsText: JSON.stringify(params), result: '', error: errMsg(err) },
          preview: [],
        });
      });
  },
});