# 百度地图微信小程序JS API v1.2

## 相关链接
[百度地图开放平台](https://lbs.baidu.com/)  
[百度地图微信小程序JSAPI服务](https://lbs.baidu.com/index.php?title=wxjsapi)  

## 更新日志
* 2017.01.11：发布v1.0版本，支持search、suggestion、regeocoding和weather四种接口。

* 2017.02.15：修复location参数无效的bug。

* 2019.07.03：发布v1.1版本，增加geocoding接口，支持地址信息到经纬度的转换。

* 2026.09：确认天气服务可通过 `https://api.map.baidu.com/weather/v1/` 直接调用——关键在于**接口路径末尾必须带斜杠**（无斜杠返回 302）。此前记录的各版本"小程序端天气不可用"即为该路径问题所致，SDK 已修正。

* 2020.09：~~由于ak鉴权限制，小程序端jsapi暂不支持天气服务~~（2026.09 已确认为接口路径缺末尾斜杠的问题，见上）。

* 2026.08（v1.2）：工程化重构。统一请求管线（定位→参数→SN 签名→请求→错误码映射→回调），
  新增路线规划（driving / walking / transit / riding），方法名规范化
  （`regeocoding` → `reverseGeocoding`，旧名保留为兼容别名），增加失败回调结构化字段
  （`message` / `rawMessage`）、坐标系自动适配（gcj02，公交自动换算百度坐标）、
  构建链（babel 转 ES5 + terser，`npm run build` / `npm run watch`），demo 全面现代化。
  ⚠️ 接口参数/返回值语义不兼容变化见各小节；`request 域名` 要求不变。

## 概述
百度地图微信小程序JavaScript API（下文简称小程序JSAPI），对百度地图Web服务API中的部分lbs接口，按照微信小程序的规范进行了前端JS封装，以方便微信小程序开发者的调用。

部分接口对返回的POI等数据按照微信小程序的数据格式进行了处理，可直接用于小程序的map中。

目前开放的小程序JSAPI接口和调用的WebAPI接口对应关系为：

 小程序JSAPI            | Web服务API        
---------------------- | -------------
 search                | Place API的周边检索部分
 suggestion            | Place Suggestion API
 reverseGeocoding      | Geocoding API的逆地址解析部分（旧名 regeocoding 兼容）
 geocoding             | Geocoding API的正地址解析部分
 driving               | 路线规划 API 驾车（direction/v2/driving）
 walking               | 路线规划 API 步行（direction/v2/walking）
 transit               | 路线规划 API 公交（direction/v2/transit）
 riding                | 路线规划 API 骑行（direction/v2/riding）
 weather               | 天气服务（weather/v1/，路径需带末尾斜杠，SDK 已内置）
 weatherAbroad         | 海外天气服务（weather_abroad/v1/，同上）
 
## 目录结构
>demo ------------- 小程序JSAPI完整DEMO  
>src  --------------- 小程序JSAPI源码  
>scripts ------------ 构建脚本（src -> bmap-wx.min.js 并同步 demo/libs）  
>package.json ------- 依赖与构建命令  

## 构建
依赖 Node.js（>= 14）：

```bash
npm install   # 首次安装依赖
npm run build # 构建 src/bmap-wx.js 并同步 demo
npm run watch # 监听 src/bmap-wx.js，变更后自动构建并同步 demo
```

构建管线：`src/bmap-wx.js`（ES6+ / async-await 源码）
→ **babel** 转译为 ES5（let/const、箭头函数、class、async/await 均降级，不依赖 regenerator 运行时）
→ **terser** 压缩 → 产物。

构建产物：
- `demo/libs/bmap-wx.min.js` —— demo 引用的压缩包（纯 ES5 语法，可直接在小程序中运行）

> 旧版仓库根目录的 `bmap-wx.min.js` 已随本次重构删除：通过 `require('<旧路径>')` 接入的旧代码，
> 请改引 `demo/libs/bmap-wx.min.js`（或自行将产物复制到原位置）。`package.json` 的 `main`
> 指向未转译的 `src/bmap-wx.js`（ES2017 语法，TS 类型声明见根目录 `index.d.ts`）；node/npm 侧
> 消费请自行转译或改用产物文件。

测试：
```bash
npm test              # 本地用例（签名 / 坐标转换 / 解析 / 错误兜底，无网络依赖）
BMAP_AK=<ak> npm test # 追加 8 个真实接口用例（search/suggestion/geocoding/逆编码/4 种路线）
```

修改 `src/bmap-wx.js` 后重新执行 `npm run build` 即可，脚本内置自检（校验产物 12 个方法齐全）。

## Demo 运行说明
1. 使用微信开发者工具导入 `demo` 目录打开本项目。
2. 配置 ak：先执行 `cp demo/config.example.js demo/config.js` 复制模板，再填入你在[百度地图开放平台](https://lbsyun.baidu.com/)控制台申请的 ak（`demo/config.js` 已被 git 忽略，仅存于本地，不会随仓库泄露）。**AK 类型选择（重要）**：
   - **开发调试（开发者工具）**：优先用「微信小程序」类型 AK（绑定项目 AppID，工具直连模式即可通过校验）；若遇到 220「APP Referer 校验失败」，多为工具走了本地代理转发（请求 Referer 变成 127.0.0.1），可尝试刷新工具/切换代理设置，或改用**服务端**类型 AK（IP 白名单留空或 SN 校验，后者把 SK 填入 `demo/config.js` 的 `sk` 字段，SDK 自动签名）兜底；
   - **发布真机**：可用「微信小程序」类型 AK（需绑定小程序的真实 AppID），或沿用服务端 AK（需配 SN 签名/合法域名）。
3. 本项目已关闭 `urlCheck`（开发者工具中"不校验合法域名"），可直接请求 `https://api.map.baidu.com`；正式发布前请在小程序后台将 `https://api.map.baidu.com` 加入 request 合法域名。
4. demo 以引导页（pages/index）为入口，点击卡片进入 7 个示例页面：检索（search 周边检索）、联想（suggestion 关键词建议）、解析（geocoding 地理编码）、逆解析（reverseGeocoding 逆地理编码）、路线规划（driving/transit/walking/riding 四种方式，折线绘制在地图上）、静态图（staticMap 生成地图图片）、天气（weather 按当前定位查询实时天气）。页面代码为最新小程序风格（ES2017+ / async-await / rpx）。
5. 天气接口（weather / weatherAbroad）与其它 Web 服务 API 一致；若手工拼 URL 遇到 302，请确认路径是否带了末尾斜杠（`/weather/v1/`，SDK 已内置）。

## 上线检查清单
提交前/发版前逐项确认：

1. **AK 安全**：`demo/config.js` 中不提交真实 ak/sk（本次重构已将其置为占位符）；真实密钥通过本地修改或构建注入。
2. **AK 类型与配额**：正式环境使用已开通所需服务（含路线规划等配额服务）的 AK。
3. **合法域名**：小程序后台「开发管理 → 服务器域名」将 `https://api.map.baidu.com` 加入 request 合法域名（演示阶段可用工具内"不校验合法域名"替代）。
4. **隐私声明**：小程序后台「设置 → 服务内容声明 → 用户隐私保护指引」中声明位置信息用途（`getLocation` 权限）；`demo/app.json` 的 `permission` / `requiredPrivateInfos` 已就位，需与后台声明保持一致。
5. **审核类目**：涉及地图/位置能力的类目需与小程序主体资质匹配（个人主体对地图类目限制较多，请以微信审核规则为准）。
6. **产物同步**：改动 `src/bmap-wx.js` 后执行 `npm run build`，确认 `demo/libs/bmap-wx.min.js` 为最新（提交产物保证 demo 开箱即用）。
7. **回归**：`npm test` 全绿；有条件时用 `BMAP_AK=<正式ak> npm test` 跑真实接口用例。

## 类参考
<h3>BMapWX</h3>
此类是小程序JSAPI的核心类。  

 ### 构造函数:

 构造函数                | 描述          
---------------------- | -------------
 BMapWX(options: Object)    | 创建 BMapWX 对象。`options.ak` 必填；可选 `options.sk`（服务密钥，配置后自动按官方《Web 服务 API 签名机制》生成 timestamp+sn，ak 保留且参与签名）与 `options.serviceHost`（自定义 API 域名，默认 https://api.map.baidu.com）
 
### 方法:

方法名                | 返回值          | 描述
---------------------- | -------------------| -----
 getWXLocation(type, success, fail, complete)| none | 低级定位接口（兼容旧版公开调用），默认返回 gcj02 坐标
 search([searchParam](#1.1): Object)| none（结果经 success 回调）| 进行search检索，检索周边POI信息
 suggestion([suggestionParam](#2.1): Object)| none | 进行suggestion检索，根据内容进行模糊检索匹配，输入补全
 reverseGeocoding([reverseGeocodingParam](#3.1): Object)| none | 逆地理编码，根据经纬度获得对应的地理描述信息
 regeocoding            | 同上 | @deprecated，同 reverseGeocoding（兼容旧调用）
 geocoding([geocodingParam](#5.1): Object)| none | 进行geocoding检索，根据地址获得对应的经纬度信息
 driving([routeParam](#6.2): Object)| none | 驾车路线规划（Web 服务 direction/v2/driving）
 walking([routeParam](#6.2): Object)| none | 步行路线规划（direction/v2/walking）
 transit([routeParam](#6.2): Object)| none | 公交（含地铁）路线规划（direction/v2/transit）
 riding([routeParam](#6.2): Object)| none | 骑行路线规划（direction/v2/riding）
 weather([weatherParam](#7.1): Object)| none | 国内天气（weather/v1/，路径斜杠已内置）
 weatherAbroad([weatherParam](#7.1): Object)| none | 海外天气（同上）
 staticMap([staticMapParam](#8.1): Object)| none | 生成静态图 URL（可直接用于 &lt;image src&gt;）

 > **所有接口成功回调入参统一为 `{ originalData, ...规范字段 }`**：
> - 地图类接口（search / reverseGeocoding / geocoding）返回 `wxMarkerData`（小程序 marker 数组）；
> - 路线类接口返回 `routes`（规范化方案数组，含 distance / duration / polyline / steps）与
>   `wxPolylineData`（主方案折线坐标，可直接用于小程序 `<map polyline>`）；
> - 天气接口返回 `weatherData` 与 `wxMarkerData`（兼容旧版）。
>
> **失败回调统一为 `{ errMsg, message, statusCode, rawMessage }`**：
> `errMsg` 为后端原文（超长时截断 160 字符），`message` 为错误码映射的中文文案，
> `statusCode` 为百度状态码，`rawMessage` 与 `errMsg` 相同。常用状态码文案：2 参数错误、
> 3 权限校验失败、4 配额校验失败、5 ak 不存在或非法、6 接口无访问权限、10 服务已下线、
> 220 Referer 校验失败（多因 AK 类型与应用来源不匹配）、221 IP 校验失败、
> 240 APP 服务被禁用（该服务未开通）、301 服务端错误、302 当日配额用完、
> 401 鉴权失败（ak 无效或 sn 校验不通过）、403 请求被拒绝。

 <h4 id="6.2">routeParam: Object</h4>
 路线规划（driving / walking / transit / riding）通用参数：

  属性名 | 类型 | 是否必须| 描述
---------------------- | -------------------|--------| -----
 origin | string | 是 | 起点，"纬度,经度" 或地点名称；名称形式部分接口需配合城市参数
 destination | string | 是 | 终点，"纬度,经度" 或地点名称
 tactics | number | 否 | 策略值，各交通方式不同（见官方 direction/v2 文档，默认 0）
 ret_coordtype | string | 否 | 返回坐标类型，默认 gcj02（direction 系仅支持 gcj02 / bd09ll / wgs84）
 coord_type | string | 否 | 输入坐标类型（driving / walking / riding），默认 gcj02（与小程序坐标系一致）；公交接口不支持该参数，SDK 会对 gcj02 经纬度输入自动转换为百度坐标
 transit 额外 | string | 否 | region / region_d：起终点所在城市（如"北京市"）
 success | Function([routeSuccess](#6.3)) | 否 | 成功回调，入参 { originalData, routes, wxPolylineData }
 fail | Function | 否 | 失败回调，入参 { errMsg, message, statusCode, rawMessage }

 <h4 id="6.3">routeSuccess: Object</h4>
 路线规划成功回调函数的参数

  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 originalData          | Object             | 是      |direction/v2 接口返回的原始数据
 routes                | Array              | 是      |规划方案数组（百度返回多方案时多套，元素结构见下）
 wxPolylineData        | Array              | 是      |主方案（routes[0]）折线坐标数组，元素为 { latitude, longitude }（gcj02），可直接用于 `<map polyline>` 的 points

 routes 数组元素字段：

  字段名                | 类型                | 描述
---------------------- | -------------------| -----
 distance              | number             | 方案总距离（米）
 duration              | number             | 方案总耗时（秒）
 prefer                | string             | 方案偏好描述（如有）
 polyline              | Array              | 本方案折线坐标，元素 { latitude, longitude }
 steps                 | Array              | 分步指引（含 path/road_name/instruction 等，结构随接口浮动，详情见官方 direction/v2 文档）

 ### 参数:
 
 <h4 id="1.1">searchParam: Object</h4>
 search检索参数对象结构
 
  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 location              | string             | 否      |经纬度例如：39.915,116.404 默认值为当前定位点
 iconPath              | string             | 否      |小程序marker图标
 iconTapPath           | string             | 否      |小程序点击后图标
 width                 | number             | 否      |marker宽，新版基础库必填，未传时 SDK 默认 30
 height                | number             | 否      |marker高，新版基础库必填，未传时 SDK 默认 30 
 alpha                 | number             | 否      |marker透明度，默认为1
 query                 | string             | 否      | 检索关键字，默认 "生活服务$美食&酒店"
 success               | Function([searchSuccess](#1.2))|否   | 检索成功后回调回调函数
 fail                  | Function([searchFail](#1.3))|否      | 检索失败后回调函数
 
 其他参数和[Place API](http://lbsyun.baidu.com/index.php?title=webapi/guide/webservice-placeapi)请求参数一致。
 
 <h4 id="1.2">searchSuccess: Object</h4>
 search检索成功回调函数的参数 
   
 
  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 wxMarkerData          | Array              | 是      |小程序格式的marker对象数组，元素结构见下
 originalData          | Object             | 是      |Place API请求返回[全部原始数据](http://lbsyun.baidu.com/index.php?title=webapi/guide/webservice-placeapi)

 wxMarkerData 数组元素字段（按微信 map markers 规范）：

  字段名                | 类型                | 描述
---------------------- | -------------------| -----
 id                    | number             | marker 序号（0 起）
 title                 | string             | POI 名称
 latitude              | number             | 纬度（gcj02）
 longitude             | number             | 经度（gcj02）
 address               | string             | 地址
 telephone             | string             | 电话

 另透传调用方传入的 marker 样式字段：iconPath / iconTapPath / width / height / alpha 等。
 
<h4 id="1.3">searchFail: Object</h4>
 search检索失败回调函数的参数  

  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 errMsg                | string             | 是     |错误信息（后端原文，超长截断）
 message               | string             | 是     |错误码映射的中文文案
 statusCode            | number             | 是     |错误状态码
 rawMessage            | string             | 是     |与 errMsg 相同
 
 
 <h4 id="2.1">suggestionParam: Object</h4>
 suggestion检索参数对象结构
 
  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 success               | Function([suggestionSuccess](#2.2))|否   | 检索成功后回调函数
 fail                  | Function([suggestionFail](#2.3))|否      | 检索失败后回调函数
 
 其他参数和[Place Suggestion API](http://lbsyun.baidu.com/index.php?title=webapi/place-suggestion-api)请求参数一致。
 
<h4 id="2.2">suggestionSuccess: Object</h4>
 suggestion检索成功回调函数的参数  

  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 originalData          | Object             | 是      |Place Suggestion API请求返回[全部原始数据](http://lbsyun.baidu.com/index.php?title=webapi/place-suggestion-api)
 result                | Array              | 是      |联想结果数组（从 originalData.result 读取的便捷字段），元素常见字段见下

 result 数组元素常见字段：

  字段名                | 类型                | 描述
----------------------- | -------------------| -----
 name                   | string             | 地点名称
 address                | string             | 地址描述
 city                   | string             | 所属城市
 district               | string             | 所属区县
 location               | Object             | 经纬度 { lat, lng }（百度坐标，非 gcj02）
 其余字段                | -                  | 与 Place Suggestion API 返回一致（如 uid、province、cityid 等），建议直接以 originalData 为准
 
<h4 id="2.3">suggestionFail: Object</h4>
 suggestion检索失败回调函数的参数  

  属性名                | 类型                | 是否必须| 描述
----------------------| -------------------|--------| -----
 errMsg                | string             | 是     |错误文案（后端原文，超长截断）
 message               | string             | 是     |错误码映射的中文文案
 statusCode            | number             | 是     |错误状态码
 rawMessage            | string             | 是     |与 errMsg 相同
 
 <h4 id="3.1">reverseGeocodingParam: Object</h4>
 reverseGeocoding检索参数对象结构（旧名 regeocoding 参数相同）
 
  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 location              | string             | 否      |要解析的经纬度例如：39.915,116.404 默认值为当前定位点
 iconPath              | string             | 否      |小程序marker图标
 iconTapPath           | string             | 否      |小程序点击后图标
 width                 | number             | 否      |marker宽，新版基础库必填，未传时 SDK 默认 30
 height                | number             | 否      |marker高，新版基础库必填，未传时 SDK 默认 30 
 alpha                 | number             | 否      |marker透明度，默认为1
 success               | Function([regeocodingSuccess](#3.2))|否   | 检索成功后回调函数
 fail                  | Function([regeocodingFail](#3.3))|否      | 检索失败后回调函数
 
 其他参数和[Geocoding](https://lbs.baidu.com/index.php?title=webapi/guide/webservice-geocoding-abroad)请求参数一致。
 
 <h4 id="3.2">reverseGeocodingSuccess: Object</h4>
 reverseGeocoding检索成功回调函数的参数  
 
  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 wxMarkerData          | Array              | 是      |小程序格式的marker对象数组，元素结构见下
 originalData          | Object             | 是      |Geocoding API请求返回[全部原始数据](http://lbs.baidu.com/index.php?title=webapi/guide/webservice-geocoding-abroad)

 wxMarkerData 数组元素字段：

  字段名                | 类型                | 描述
---------------------- | -------------------| -----
 id                    | number             | marker 序号（固定 0）
 latitude              | number             | 纬度（gcj02）
 longitude             | number             | 经度（gcj02）
 address               | string             | 完整地址（formatted_address）
 desc                  | string             | 语义化描述（sematic_description）
 business              | string             | 所在商圈

 另透传调用方传入的 marker 样式字段：iconPath / iconTapPath / width / height / alpha 等。
 
<h4 id="3.3">reverseGeocodingFail: Object</h4>
 reverseGeocoding检索失败回调函数的参数  

  属性名                | 类型 | 是否必须| 描述
---------------------- | -------------------|--------| -----
 errMsg                | string             | 是     |错误信息（后端原文，超长截断）
 message               | string             | 是     |错误码映射的中文文案
 statusCode            | number             | 是     |错误状态码
 rawMessage            | string             | 是     |与 errMsg 相同
 
<h4 id="5.1">geocodingParam: Object</h4>
 geocoding检索参数对象结构

  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 address               | string             | 是      |待解析地址，如"北京市海淀区上地十街10号"
 ret_coordtype         | string             | 否      |返回坐标类型，默认 gcj02ll（旧键 coordtype 兼容）
 iconPath              | string             | 否      |小程序marker图标
 iconTapPath           | string             | 否      |小程序点击后图标
 width                 | number             | 否      |marker宽，新版基础库必填，未传时 SDK 默认 30
 height                | number             | 否      |marker高，新版基础库必填，未传时 SDK 默认 30 
 alpha                 | number             | 否      |marker透明度，默认为1
 success               | Function([geocodingSuccess](#5.2))|否   | 检索成功后回调函数
 fail                  | Function([geocodingFail](#5.3))|否      | 检索失败后回调函数

 其他参数和[Geocoding](https://lbs.baidu.com/index.php?title=webapi/guide/webservice-geocoding)请求参数一致。

 <h4 id="5.2">geocodingSuccess: Object</h4>
 geocoding检索成功回调函数的参数  

  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 wxMarkerData          | Array              | 是      |小程序格式的marker对象数组，元素结构见下
 originalData          | Object             | 是      |Geocoding API请求返回[全部原始数据](http://lbs.baidu.com/index.php?title=webapi/guide/webservice-geocoding)

 wxMarkerData 数组元素字段：

  字段名                | 类型                | 描述
---------------------- | -------------------| -----
 id                    | number             | marker 序号（固定 0）
 latitude              | number             | 纬度（gcj02）
 longitude             | number             | 经度（gcj02）

 另透传调用方传入的 marker 样式字段：iconPath / iconTapPath / width / height / alpha 等。

 <h4 id="5.3">geocodingFail: Object</h4>
 geocoding检索失败回调函数的参数  

  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 errMsg                | string             | 是     |错误信息（后端原文，超长截断）
 message               | string             | 是     |错误码映射的中文文案
 statusCode            | number             | 是     |错误状态码
 rawMessage            | string             | 是     |与 errMsg 相同

 <h4 id="7.1">weatherParam: Object</h4>
 天气检索参数对象结构（weather 国内 / weatherAbroad 海外共用）

  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 location              | string             | 否      |天气地点，"经度,纬度"（注意与其余接口顺序相反，天气接口约定）；默认当前定位
 district_id           | string             | 否      |区域 ID（与 location 二选一，同时传时官方按 district_id 优先）；不传按经纬度查询
 data_type             | string             | 否      |数据类型，默认 all
 success               | Function([weatherSuccess](#7.2)) | 否 | 成功回调，入参 { originalData, weatherData, wxMarkerData(兼容) }
 fail                  | Function([weatherFail](#7.3)) | 否 | 失败回调，入参 { errMsg, message, statusCode, rawMessage }

> ⚠️ 接口地址须为 `https://api.map.baidu.com/weather/v1/`（**末尾带斜杠**），省略斜杠会返回 302；SDK 已内置正确地址。

 <h4 id="7.2">weatherSuccess: Object</h4>
 天气检索成功回调函数的参数

  属性名                | 类型                | 描述
---------------------- | -------------------| -----
 originalData           | Object             | 天气 API 返回的原始数据
 weatherData            | Object             | 解析后的天气对象（字段见下）
 wxMarkerData           | Array              | 兼容旧版：值为 [weatherData]

 weatherData 字段：

  字段名                | 类型                 | 描述
---------------------- | ------------------- | -----
 country                | string             | 国家
 province               | string             | 省份
 currentCity            | string             | 城市
 district               | string             | 区县（location.name，可能为空）
 weatherDesc            | string             | 天气描述（如"多云"）
 temperature            | string             | 当前温度（摄氏度）
 feelsLike              | number             | 体感温度（摄氏度）
 humidity               | string             | 相对湿度（%）
 aqi                    | number             | 空气质量指数（data_type=now/all 时返回）
 vis                    | number             | 能见度（米）
 forecast               | Array              | 7 天预报（data_type=all 时返回），元素含 date / week / textDay / high / low
 windClass              | string             | 风力等级描述
 windDir                | string             | 风向
 updatedAt              | string             | 更新时间

 <h4 id="7.3">weatherFail: Object</h4>
 天气检索失败回调函数的参数

  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 errMsg                | string             | 是     |错误信息（后端原文，超长截断）
 message               | string             | 是     |错误码映射的中文文案
 statusCode            | number             | 是     |错误状态码
 rawMessage            | string             | 是     |与 errMsg 相同

 <h4 id="8.1">staticMapParam: Object</h4>
 静态图参数（本地拼装 URL，**不发起网络请求**；得到 url 后直接用于 `<image src="...">`）

  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 center                | string             | 否      |中心点 "经度,纬度" 或地点名，默认北京
 width / height        | number             | 否      |图片宽高 px（默认 400×300；scale=2 时宽高 ≤512）
 zoom                  | number             | 否      |地图级别 [3,19]（scale=2 高清图上限 18），默认 11
 scale                 | 1\|2               | 否      |1 普通 / 2 高清（输出 2 倍像素；宽高 ≤512、zoom ≤18）
 coordtype             | string             | 否      |坐标类型，默认 gcj02ll（与小程序坐标系一致）
 markers               | string             | 否      |标注点坐标："lng,lat\|lng2,lat2"（多点用竖线 \| 分隔），样式经 markerStyles（size,label,color）
 labels                | string             | 否      |标签坐标："lng,lat"（仅坐标，多点用竖线 \| 分隔），文字内容经 labelStyles（content,fontWeight,fontSize,fontColor,bgColor,border）
 markerStyles          | string             | 否      |标注点样式：size,label,color，多组用竖线 \| 分隔，与 markers 一一对应
 labelStyles           | string             | 否      |标签样式：content,fontWeight,fontSize,fontColor,bgColor,border（content 为标签文字）
 paths                 | string             | 否      |折线/多边形：多条折线用竖线 \| 分隔，每条折线的点用分号 ; 分隔："lng,lat;lng2,lat2\|..."
 pathStyles            | string             | 否      |折线样式：color,weight,opacity[,fillColor]，多组用竖线 \| 分隔
 copyright             | number\|string      | 否      |版权样式：0 log+文字 / 1 纯文字（默认 0）
 bbox                  | string             | 否      |地图视野范围（与 center 二选一）："minX,minY;maxX,maxY"
 dpiType               | string             | 否      |ph（高清屏）/ pl（低分屏），自 V3 起已废弃（服务端不再区分，保留兼容）
 success               | Function([staticMapSuccess](#8.2)) | 否 | 成功回调，入参 { url, originalData }
 fail                  | Function             | 否      |失败回调，入参 { errMsg, statusCode, message, rawMessage }

 示例：

 ```js
 const bmap = new BMapWX({ ak });
 bmap.staticMap({
   center: '116.397470,39.908823',
   labels: '116.397470,39.908823',
   labelStyles: '天安门,1,18,0x006600,0xFFFFFF,1',
   success: res => this.setData({ mapUrl: res.url }), // <image src="{{mapUrl}}">
 });
 ```

 <h4 id="8.2">staticMapSuccess: Object</h4>
 静态图成功回调入参

  属性名                 | 类型                 | 描述
---------------------- | -------------------| -----
 url                    | string              | 图片地址（https，含 ak/sn 校验参数）
 originalData           | Object              | 生成的完整请求参数



