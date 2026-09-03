const { invoke, errMsg } = require('../../utils/bmap');

let searchTimer = null;
let requestToken = 0; // 请求序号：用于丢弃过期响应，避免输入竞态

Page({
  data: {
    keyword: '',
    suggestions: [], // [{ name, city, district, address }]
    error: '',
    loading: false,
  },

  /** 输入防抖 300ms 后发起联想检索 */
  onKeywordInput(e) {
    const keyword = e.detail.value;
    clearTimeout(searchTimer);
    this.setData({ keyword, error: '', loading: false });
    if (!keyword.trim()) {
      this.setData({ suggestions: [] });
      return;
    }
    searchTimer = setTimeout(() => this.fetchSuggestions(keyword.trim()), 300);
  },

  async fetchSuggestions(keyword) {
    const token = ++requestToken;
    this.setData({ loading: true });
    try {
      const { result } = await invoke('suggestion', {
        query: keyword,
        region: '北京',
        city_limit: true,
      });
      if (token !== requestToken) { return; }
      this.setData({ suggestions: result || [], loading: false });
      if (!result.length) {
        this.setData({ error: '未找到相关地点建议，请尝试其他关键词' });
      }
    } catch (err) {
      if (token !== requestToken) { return; }
      this.setData({ error: '建议检索失败：' + errMsg(err), loading: false });
    }
  },
});