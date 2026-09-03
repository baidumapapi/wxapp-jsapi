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
 
## 快速开始

1. **引入**：将 `demo/libs/bmap-wx.min.js` 复制到你的小程序目录（纯 ES5，可直接运行；或使用 `src/bmap-wx.js` 源码，ES2017+ 语法，需自备转译）：

```js
const { BMapWX } = require('./libs/bmap-wx.min.js');
const bmap = new BMapWX({ ak: '你的AK' }); // 服务端 AK 可另传 sk，SDK 自动生成 SN 签名

bmap.search({
  query: '天安门',
  success(res) {
    console.log(res.wxMarkerData); // 小程序 map markers（gcj02），可直接用于 <map markers>
  },
  fail(err) {
    console.log(err.message, err.statusCode);
  },
});
```

2. **AK 申请**：在[百度地图开放平台](https://lbsyun.baidu.com/)控制台创建应用。开发调试优先用「微信小程序」类型 AK（绑定项目 AppID）；若遇 220「APP Referer 校验失败」可改用**服务端**类型 AK（IP 白名单留空或配 SN 签名兜底，SK 填入 `sk` 字段）。
3. **合法域名**：正式发布前在小程序后台把 `https://api.map.baidu.com` 加入 request 合法域名（开发阶段可先在开发者工具中勾选"不校验合法域名"）。
4. **调用**：方法均为回调式（`success` / `fail`），详见下方[类参考](#类参考)；成功入参统一为 `{ originalData, ...规范字段 }`，失败入参为 `{ errMsg, message, statusCode, rawMessage }`。

## Demo

`demo` 目录为完整示例小程序，包含周边探索（explore）、周边检索、关键词联想、地理编码、逆地理编码、路线规划（多方案）、静态图（取景联动）、天气（国际城市切换）等页面。运行前复制 `demo/config.example.js` 为 `demo/config.js` 并填入你的 AK（该文件已被 git 忽略，密钥不会入库）。

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

 示例（driving / walking / transit / riding 用法相同）：

 ```js
 bmap.driving({ // 换成 walking / transit / riding 即切换方式
   origin: '39.908823,116.397470', // "纬度,经度" 或地点名称
   destination: '39.915119,116.403963',
   success(res) {
     console.log(res.routes);          // 方案数组（多套方案时多条）
     console.log(res.wxPolylineData);  // 主方案折线（gcj02），用于 <map polyline>
   },
 });
 ```

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
 
 其他参数和[Place Suggestion API](http://lbsyun.baidu.com/index.php?title=webapi/place-suggestion-api)请求参数一致（SDK 已固定 `ret_coordtype=gcj02ll`，返回坐标可直接用于小程序地图）。

 示例：

 ```js
 bmap.suggestion({
   query: '天安门',
   region: '北京市',
   success(res) {
     console.log(res.result); // [{ name, address, city, district, location: { lat, lng }(gcj02) }]
   },
 });
 ```
 
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
 location               | Object             | 经纬度 { lat, lng }（**gcj02**，SDK 已固定 ret_coordtype=gcj02ll，可直接用于小程序地图）
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

 示例：

 ```js
 bmap.reverseGeocoding({
   location: '39.915,116.404', // "纬度,经度"；默认当前定位
   success(res) {
     console.log(res.wxMarkerData[0].address); // 完整地址
   },
 });
 ```
 
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

 示例：

 ```js
 bmap.geocoding({
   address: '北京市海淀区上地十街10号',
   success(res) {
     console.log(res.wxMarkerData[0]); // { latitude, longitude }（gcj02）
   },
 });
 ```

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
 location              | string             | 否      |天气地点，"经度,纬度"（注意与其余接口顺序相反，天气接口约定；**weatherAbroad 仅接受经纬度，不支持城市名**）；默认当前定位
 district_id           | string             | 否      |区域 ID（与 location 二选一，同时传时官方按 district_id 优先）；不传按经纬度查询
 data_type             | string             | 否      |数据类型：all 实况+7天预报（默认）/ now 仅实况
 output                | string             | 否      |返回格式，默认 json
 coordtype             | string             | 否      |坐标类型，默认 gcj02
 success               | Function([weatherSuccess](#7.2)) | 否 | 成功回调，入参 { originalData, weatherData, wxMarkerData(兼容) }
 fail                  | Function([weatherFail](#7.3)) | 否 | 失败回调，入参 { errMsg, message, statusCode, rawMessage }

> ⚠️ 接口地址须为 `https://api.map.baidu.com/weather/v1/`（**末尾带斜杠**），省略斜杠会返回 302；SDK 已内置正确地址。

 示例：

 ```js
 bmap.weather({
   // location: '116.397470,39.908823', // "经度,纬度"（与其余接口顺序相反）；默认当前定位
   success(res) {
     console.log(res.weatherData.currentCity, res.weatherData.temperature);
   },
 });

 // 海外天气：仅接受"经度,纬度"，不支持城市名
 bmap.weatherAbroad({
   location: '139.7671,35.6812', // 东京
   success: res => console.log(res.weatherData.currentCity),
 });
 ```

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
 updatedAt              | string             | 更新时间（接口原始格式，如 "20260903171500"；demo 展示层已格式化，SDK 原样透传）

 <h4 id="7.3">weatherFail: Object</h4>
 天气检索失败回调函数的参数

  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 errMsg                | string             | 是     |错误信息（后端原文，超长截断）
 message               | string             | 是     |错误码映射的中文文案
 statusCode            | number             | 是     |错误状态码
 rawMessage            | string             | 是     |与 errMsg 相同

 <h4 id="8.1">staticMapParam: Object</h4>
 静态图参数（本地拼装 URL，**不发起网络请求**；得到 url 后直接用于 &lt;image src="..."&gt; 组件）

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



