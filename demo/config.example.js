/**
 * 百度地图开放平台配置（模板）
 *
 * 使用方式：
 *   1. 复制本文件为 demo/config.js：  cp demo/config.example.js demo/config.js
 *   2. 在 demo/config.js 中填入你在 https://lbsyun.baidu.com/ 控制台申请的 ak
 *   3. （可选）配置 SN 签名：追加 sk: '你的SK'，SDK 会自动生成签名
 *
 * demo/config.js 已被 .gitignore 忽略，真实密钥不会进入仓库；
 * 本模板（config.example.js）随仓库发布，只含占位符。
 *
 * AK 类型选择：
 * - 开发调试（开发者工具）：优先「微信小程序」类型 AK（绑定 AppID；工具直连模式下请求
 *   Referer 即 https://servicewechat.com/wx{appid}，可正常通过）。若遇 220「APP Referer
 *   校验失败」，多为工具走本地代理转发（Referer 变 127.0.0.1），可切工具网络设置或改用
 *   【服务端】类型 AK（IP 白名单留空/SN 校验）兜底。
 * - 无论哪种类型，小程序调用 Web 服务 API 都需在小程序后台将 https://api.map.baidu.com
 *   加入 request 合法域名；开发阶段可勾选"不校验合法域名"（本项目已默认关闭 urlCheck）。
 * - 天气接口（weather / weatherAbroad）与其它 Web 服务 API 一致；接口路径需带末尾斜杠
 *   （`/weather/v1/`，SDK 已内置）。
 * - 路线规划（direction/v2）等配额服务需在控制台开通（否则 240）。
 */
module.exports = {
  // TODO: 填入你在 https://lbsyun.baidu.com/ 控制台申请的服务端 AK
  ak: '',
  hint: '未配置 AK：请将 demo/config.example.js 复制为 demo/config.js 并填写百度地图开放平台的 ak（https://lbsyun.baidu.com/）'
};