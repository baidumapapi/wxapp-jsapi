# 百度地图微信小程序JavaScript API v1.0
**相关链接：**  
[百度地图开放平台](http://lbsyun.baidu.com/)  
[百度地图微信小程序JSAPI服务](http://lbsyun.baidu.com/index.php?title=wxjsapi)  
##更新日志##
2017.01.11:发布v1.0版本，支持search、suggestion、regeocoding和weather四种接口。  
2017.02.15:修复location参数无效的bug
##概述
百度地图微信小程序JavaScript API（下文简称小程序JSAPI）的作用是对百度地图Web服务API中的部分接口按照微信小程序的规范进行了前端JS封装，方便了微信小程序开发者的调用。部分接口对返回的POI等数据按照微信小程序的数据格式进行了处理，可直接用于小程序的map中。目前开放的小程序JSAPI接口和调用的WebAPI接口对应关系为：

 小程序JSAPI            | Web服务API        
---------------------- | -------------
 search                | Place API的周边检索部分
 suggestion            | Place Suggestion API
 regeocoding           | Geocoding API的逆地址解析部分
 weather               | 天气 API
 
##目录结构
>demo ------------- 小程序JSAPI完整DEMO  
>src  --------------- 小程序JSAPI源码   
>

##类参考
<h3>BMapWX</h3>
此类是小程序JSAPI的核心类。  
 <h4>**构造函数:**</h4> 

 构造函数                | 描述          
---------------------- | -------------
 BMapWX(ak: string)    | 创建 BMapWX对象时，必须要传入ak
 
 <h4>**方法:**</h4>
 
  方法名                | 返回值              | 描述
---------------------- | -------------------| -----
 search([searchParam](#1.1): Object)| none          | 进行search检索，检索周边POI信息
 suggestion([suggestionParam](#2.1): Object)| none   | 进行suggestion检索，根据内容进行模糊检索匹配，输入补全
 regeocoding([regeocodingParam](#3.1): Object)| none | 进行regeocoding检索，根据经纬度获得对应的地理描述信息
 weather([weatherParam](#4.1): Object)| none          | 进行weather检索，查询指定地点的天气信息
 
  
 
 <h4>**参数:**</h4>
 
 <h5 id="1.1">***searchParam: Object***</h5>
 search检索参数对象结构
 
  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 location              | string             | 否      |经纬度例如：39.915,116.404 默认值为当前定位点
 iconPath              | string             | 是      |小程序marker图标
 iconTapPath           | string             | 否      |小程序点击后图标
 width                 | number             | 否      |marker宽，默认为图片宽度 
 height                | number             | 否      |marker高，默认为图片高度 
 alpha                 | number             | 否      |marker透明度，默认为1
 query                 | string             | 否      | 检索关键字，默认为生活服务、美食、酒店
 success               | Function([searchSuccess](#1.2))|否   | 检索成功后回调回调函数
 fail                  | Function([searchFail](#1.3))|否      | 检索失败后回调函数
 
 其他参数和[Place API](http://lbsyun.baidu.com/index.php?title=webapi/guide/webservice-placeapi)请求参数一致。
 <h5 id="1.2">***searchSuccess: Object***</h5>
 search检索成功回调函数的参数 
   
 
  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 wxMarkerData          | Array              | 是      |小程序格式的marker对象数组，参考[微信文档](https://mp.weixin.qq.com/debug/wxadoc/dev/component/map.html?t=201715#markers)
 originalData          | Object             | 是      |Place API请求返回[全部原始数据](http://lbsyun.baidu.com/index.php?title=webapi/guide/webservice-placeapi)
 
 <h5 id="1.3">***searchFail: Object***</h5>
 search检索失败回调函数的参数  
 
  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 errMsg                | string             | 是     |错误信息
 statusCode            | number             | 是     |错误状态码
 
 
 <h5 id="2.1">***suggestionParam: Object***</h5>
 suggestion检索参数对象结构
 
  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 success               | Function([suggestionSuccess](#2.2))|否   | 检索成功后回调函数
 fail                  | Function([suggestionFail](#2.3))|否      | 检索失败后回调函数
 
 其他参数和[Place Suggestion API](http://lbsyun.baidu.com/index.php?title=webapi/place-suggestion-api)请求参数一致。
 
 <h5 id="2.2">***suggestionSuccess: Object***</h5>
 suggestion检索成功回调函数的参数  
 
  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 originalData          | Object             | 是      |Place Suggestion API请求返回[全部原始数据](http://lbsyun.baidu.com/index.php?title=webapi/place-suggestion-api)
 
 <h5 id="2.3">***suggestionFail: Object***</h5>
 suggestion检索失败回调函数的参数  
 
  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 errMsg                | string             | 是     |错误信息
 statusCode            | number             | 是     |错误状态码
 
 <h5 id="3.1">***suggestionParam: Object***</h5>
 regeocoding检索参数对象结构
 
  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 location              | string             | 否      |要解析的经纬度例如：39.915,116.404 默认值为当前定位点
 iconPath              | string             | 是      |小程序marker图标
 iconTapPath           | string             | 否      |小程序点击后图标
 width                 | number             | 否      |marker宽，默认为图片宽度 
 height                | number             | 否      |marker高，默认为图片高度 
 alpha                 | number             | 否      |marker透明度，默认为1
 success               | Function([regeocodingSuccess](#3.2))|否   | 检索成功后回调函数
 fail                  | Function([regeocodingFail](#3.3))|否      | 检索失败后回调函数
 
 其他参数和[Geocoding](http://lbsyun.baidu.com/index.php?title=webapi/guide/webservice-geocoding#.E9.80.86.E5.9C.B0.E7.90.86.E7.BC.96.E7.A0.81.E6.9C.8D.E5.8A.A1)请求参数一致。
 
 <h5 id="3.2">***regeocodingSuccess: Object***</h5>
 regeocoding检索成功回调函数的参数  
 
  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 wxMarkerData          | Array              | 是      |小程序格式的marker对象数组，参考[微信文档](https://mp.weixin.qq.com/debug/wxadoc/dev/component/map.html?t=201715#markers)
 originalData          | Object             | 是      |Geocoding API请求返回[全部原始数据](http://lbsyun.baidu.com/index.php?title=webapi/guide/webservice-geocoding#.E9.80.86.E5.9C.B0.E7.90.86.E7.BC.96.E7.A0.81.E6.9C.8D.E5.8A.A1)
 
 <h5 id="3.3">***regeocodingFail: Object***</h5>
 regeocoding检索失败回调函数的参数  
 
  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 errMsg                | string             | 是     |错误信息
 statusCode            | number             | 是     |错误状态码
 <h5 id="4.1">***weatherParam: Object***</h5>
 weather检索参数对象结构
 
  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 location              | string             | 否      |要解析的纬经度例如：116.43,40.75 默认值为当前定位点
 success               | Function([weatherSuccess](#4.2))|否   | 检索成功后回调函数
 fail                  | Function([weatherFail](#4.3))|否      | 检索失败后回调函数
 
 其他参数和[天气接口](http://developer.baidu.com/map/wiki/index.php?title=car/api/weather)请求参数一致。
 
 <h5 id="4.2">***weatherSuccess: Object***</h5>
 weather检索成功回调函数的参数  
 
  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 [currentWeather](#4.4)        | Obejct              | 是     | 当前天气的重要信息
 originalData          | Object             | 是      | 天气接口请求返回[全部原始数据](http://developer.baidu.com/map/wiki/index.php?title=car/api/weather)
 
 <h5 id="4.3">***weatherFail: Object***</h5>
 weather检索失败回调函数的参数  
 
  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 errMsg                | string             | 是     |错误信息
 statusCode            | number             | 是     |错误状态码

 <h5 id="4.4">***currentWeather: Object***</h5>
 weather检索结果中的当前重要信息
 
  属性名                | 类型                | 是否必须| 描述
---------------------- | -------------------|--------| -----
 currentCity           | string             | 是     |当前城市
 pm25                  | string             | 是     |PM2.5浓度
 date                  | string             | 是     |日期
 temperature           | string             | 是     |温度
 weatherDesc           | string             | 是     |天气描述
 wind                  | string             | 是     |风力
 
 



