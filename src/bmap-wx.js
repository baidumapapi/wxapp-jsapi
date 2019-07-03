/**
 * @file 微信小程序JSAPI
 * @author 崔健 cuijian03@baidu.com 2017.01.10
 * @update 邓淑芳 623996689@qq.com 2019.07.03
 */

/**
 * 百度地图微信小程序API类
 *
 * @class
 */
class BMapWX {

    /**
     * 百度地图微信小程序API类
     *
     * @constructor
     */
    constructor(param) {
      this.ak = param["ak"];
    }
  
    /**
     * 使用微信接口进行定位
     *
     * @param {string} type 坐标类型
     * @param {Function} success 成功执行
     * @param {Function} fail 失败执行
     * @param {Function} complete 完成后执行
     */
    getWXLocation(type, success, fail, complete) {
      type = type || 'gcj02',
      success = success || function () { };
      fail = fail || function () { };
      complete = complete || function () { };
      wx.getLocation({
        type: type,
        success: success,
        fail: fail,
        complete: complete
      });
    }
  
    /**
     * POI周边检索
     *
     * @param {Object} param 检索配置
     * 参数对象结构可以参考
     * http://lbsyun.baidu.com/index.php?title=webapi/guide/webservice-placeapi
     */
    search(param) {
      var that = this;
      param = param || {};
      let searchparam = {
        query: param["query"] || '生活服务$美食&酒店',
        scope: param["scope"] || 1,
        filter: param["filter"] || '',
        coord_type: param["coord_type"] || 2,
        page_size: param["page_size"] || 10,
        page_num: param["page_num"] || 0,
        output: param["output"] || 'json',
        ak: that.ak,
        sn: param["sn"] || '',
        timestamp: param["timestamp"] || '',
        radius: param["radius"] || 2000,
        ret_coordtype: 'gcj02ll'
      };
      let otherparam = {
        iconPath: param["iconPath"],
        iconTapPath: param["iconTapPath"],
        width: param["width"],
        height: param["height"],
        alpha: param["alpha"] || 1,
        success: param["success"] || function () { },
        fail: param["fail"] || function () { }
      };
      let type = 'gcj02';
      let locationsuccess = function (result) {
        searchparam["location"] = result["latitude"] + ',' + result["longitude"];
        wx.request({
          url: 'https://api.map.baidu.com/place/v2/search',
          data: searchparam,
          header: {
            "content-type": "application/json"
          },
          method: 'GET',
          success(data) {
            let res = data["data"];
            if (res["status"] === 0) {
              let poiArr = res["results"];
              // outputRes 包含两个对象，
              // originalData为百度接口返回的原始数据
              // wxMarkerData为小程序规范的marker格式
              let outputRes = {};
              outputRes["originalData"] = res;
              outputRes["wxMarkerData"] = [];
              for (let i = 0; i < poiArr.length; i++) {
                outputRes["wxMarkerData"][i] = {
                  id: i,
                  latitude: poiArr[i]["location"]["lat"],
                  longitude: poiArr[i]["location"]["lng"],
                  title: poiArr[i]["name"],
                  iconPath: otherparam["iconPath"],
                  iconTapPath: otherparam["iconTapPath"],
                  address: poiArr[i]["address"],
                  telephone: poiArr[i]["telephone"],
                  alpha: otherparam["alpha"],
                  width: otherparam["width"],
                  height: otherparam["height"]
                }
              }
              otherparam.success(outputRes);
            } else {
              otherparam.fail({
                errMsg: res["message"],
                statusCode: res["status"]
              });
            }
          },
          fail(data) {
            otherparam.fail(data);
          }
        });
      }
      let locationfail = function (result) {
        otherparam.fail(result);
      };
      let locationcomplete = function (result) {
      };
      if (!param["location"]) {
        that.getWXLocation(type, locationsuccess, locationfail, locationcomplete);
      } else {
        let longitude = param.location.split(',')[1];
        let latitude = param.location.split(',')[0];
        let errMsg = 'input location';
        let res = {
          errMsg: errMsg,
          latitude: latitude,
          longitude: longitude
        };
        locationsuccess(res);
      }
    }
  
    /**
     * sug模糊检索
     *
     * @param {Object} param 检索配置
     * 参数对象结构可以参考
     * http://lbsyun.baidu.com/index.php?title=webapi/place-suggestion-api
     */
    suggestion(param) {
      var that = this;
      param = param || {};
      let suggestionparam = {
        query: param["query"] || '',
        region: param["region"] || '全国',
        city_limit: param["city_limit"] || false,
        output: param["output"] || 'json',
        ak: that.ak,
        sn: param["sn"] || '',
        timestamp: param["timestamp"] || '',
        ret_coordtype: 'gcj02ll'
      };
      let otherparam = {
        success: param["success"] || function () { },
        fail: param["fail"] || function () { }
      };
      wx.request({
        url: 'https://api.map.baidu.com/place/v2/suggestion',
        data: suggestionparam,
        header: {
          "content-type": "application/json"
        },
        method: 'GET',
        success(data) {
          let res = data["data"];
          if (res["status"] === 0) {
            otherparam.success(res);
          } else {
            otherparam.fail({
              errMsg: res["message"],
              statusCode: res["status"]
            });
          }
        },
        fail(data) {
          otherparam.fail(data);
        }
      });
    }
  
    /**
     * rgc检索（逆地理编码：经纬度->地点描述）
     * 
     * @param {Object} param 检索配置
     * 参数对象结构可以参考
     * https://lbs.baidu.com/index.php?title=webapi/guide/webservice-geocoding-abroad
     * 
     */
    regeocoding (param) {
      var that = this;
      param = param || {};
      let regeocodingparam = {
        coordtype: param["coordtype"] || 'gcj02ll',         
        ret_coordtype: 'gcj02ll',                          
        radius: param["radius"] || 1000,                    
        ak: that.ak,                                        
        sn: param["sn"] || '',                              
        output: param["output"] || 'json',                 
        callback: param["callback"] || function () { },     
        extensions_poi: param["extensions_poi"] || 1,      
        extensions_road: param["extensions_road"] || false, 
        extensions_town: param["extensions_town"] || false, 
        language: param["language"] || 'zh-CN',             
        language_auto: param["language_auto"] || 0        
      };
      let otherparam = {
        iconPath: param["iconPath"],
        iconTapPath: param["iconTapPath"],
        width: param["width"],
        height: param["height"],
        alpha: param["alpha"] || 1, 
        success: param["success"] || function () { },
        fail: param["fail"] || function () { }
      };
      let type = 'gcj02';
      let locationsuccess = function (result) {
        regeocodingparam["location"] = result["latitude"] + ',' + result["longitude"];
        wx.request({
          url: 'https://api.map.baidu.com/reverse_geocoding/v3',
          data: regeocodingparam,
          header: {
            "content-type": "application/json"
          },
          method: 'GET',
          success(data) {
            let res = data["data"];
            if (res["status"] === 0) {
              let poiObj = res["result"];
              // outputRes 包含两个对象：
              // originalData为百度接口返回的原始数据
              // wxMarkerData为小程序规范的marker格式
              let outputRes = {};
              outputRes["originalData"] = res;
              outputRes["wxMarkerData"] = [];
              outputRes["wxMarkerData"][0] = {
                id: 0,
                latitude: result["latitude"],
                longitude: result["longitude"],
                address: poiObj["formatted_address"],
                iconPath: otherparam["iconPath"],
                iconTapPath: otherparam["iconTapPath"],
                desc: poiObj["sematic_description"],
                business: poiObj["business"],
                alpha: otherparam["alpha"],
                width: otherparam["width"],
                height: otherparam["height"]
              }
              otherparam.success(outputRes);
            } else {
              otherparam.fail({
                errMsg: res["message"],
                statusCode: res["status"]
              });
            }
          },
          fail(data) {
            otherparam.fail(data);
          }
        });
      };
      let locationfail = function (result) {
        otherparam.fail(result);
      }
      let locationcomplete = function (result) {
      };
      if (!param["location"]) {
        that.getWXLocation(type, locationsuccess, locationfail, locationcomplete);
      } else {
        let longitude = param.location.split(',')[1];
        let latitude = param.location.split(',')[0];
        let errMsg = 'input location';
        let res = {
          errMsg: errMsg,
          latitude: latitude,
          longitude: longitude
        };
        locationsuccess(res);
      }
    }
  
    /**
     * gc检索（地理编码：地点->经纬度）
     *
     * @param {Object} param 检索配置
     * 参数对象结构可以参考
     * https://lbs.baidu.com/index.php?title=webapi/guide/webservice-geocoding
     * 
     */
    geocoding(param) {
      var that = this;
      param = param || {};
      let geocodingparam = {
        address: param["address"] || '',                    
        city: param["city"] || '',                          
        ret_coordtype: param["coordtype"] || 'gcj02ll',     
        ak: that.ak,                                        
        sn: param["sn"] || '',                              
        output: param["output"] || 'json',                  
        callback: param["callback"] || function () { }
      };
      let otherparam = {
        iconPath: param["iconPath"],
        iconTapPath: param["iconTapPath"],
        width: param["width"],
        height: param["height"],
        alpha: param["alpha"] || 1, 
        success: param["success"] || function () { },
        fail: param["fail"] || function () { }
      };
      if (param["address"]) {
        wx.request({
          url: 'https://api.map.baidu.com/geocoding/v3',
          data: geocodingparam,
          header: {
            "content-type": "application/json"
          },
          method: 'GET',
          success(data) {
            let res = data["data"];
            if (res["status"] === 0){
              let poiObj = res["result"];
              // outputRes 包含两个对象：
              // originalData为百度接口返回的原始数据
              // wxMarkerData为小程序规范的marker格式
              let outputRes = res;
              outputRes["originalData"] = res;
              outputRes["wxMarkerData"] = [];
              outputRes["wxMarkerData"][0] = {
                id: 0,
                latitude: poiObj["location"]["lat"],
                longitude: poiObj["location"]["lng"],
                iconPath: otherparam["iconPath"],
                iconTapPath: otherparam["iconTapPath"],
                alpha: otherparam["alpha"],
                width: otherparam["width"],
                height: otherparam["height"]
              }
              otherparam.success(outputRes);
            } else {
              otherparam.fail({
                errMsg: res["message"],
                statusCode: res["status"]
              });
            }
          },
          fail(data) {
            otherparam.fail(data);
          }
        });
      } else {
        let errMsg = 'input address!';
        let res = {
          errMsg: errMsg
        };
        otherparam.fail(res);
      }
    } 
  
    /**
     * 天气检索
     *
     * @param {Object} param 检索配置
     */
    weather(param) {
      var that = this;
      param = param || {};
      let weatherparam = {
        coord_type: param["coord_type"] || 'gcj02',
        output: param["output"] || 'json',
        ak: that.ak,
        sn: param["sn"] || '',
        timestamp: param["timestamp"] || ''
      };
      let otherparam = {
        success: param["success"] || function () { },
        fail: param["fail"] || function () { }
      };
      let type = 'gcj02';
      let locationsuccess = function (result) {
        weatherparam["location"] = result["longitude"] + ',' + result["latitude"];
        wx.request({
          url: 'https://api.map.baidu.com/telematics/v3/weather',
          data: weatherparam,
          header: {
            "content-type": "application/json"
          },
          method: 'GET',
          success(data) {
            let res = data["data"];
            if (res["error"] === 0 && res["status"] === 'success') {
              let weatherArr = res["results"];
              // outputRes 包含两个对象，
              // originalData为百度接口返回的原始数据
              // wxMarkerData为小程序规范的marker格式
              let outputRes = {};
              outputRes["originalData"] = res;
              outputRes["currentWeather"] = [];
              outputRes["currentWeather"][0] = {
                currentCity: weatherArr[0]["currentCity"],
                pm25: weatherArr[0]["pm25"],
                date: weatherArr[0]["weather_data"][0]["date"],
                temperature: weatherArr[0]["weather_data"][0]["temperature"],
                weatherDesc: weatherArr[0]["weather_data"][0]["weather"],
                wind: weatherArr[0]["weather_data"][0]["wind"]
              };
              otherparam.success(outputRes);
            } else {
              otherparam.fail({
                errMsg: res["message"],
                statusCode: res["status"]
              });
            }
          },
          fail(data) {
            otherparam.fail(data);
          }
        });
      }
      let locationfail = function (result) {
        otherparam.fail(result);
      }
      let locationcomplete = function (result) {
      }
      if (!param["location"]) {
        that.getWXLocation(type, locationsuccess, locationfail, locationcomplete);
      } else {
        let longitude = param.location.split(',')[0];
        let latitude = param.location.split(',')[1];
        let errMsg = 'input location';
        let res = {
          errMsg: errMsg,
          latitude: latitude,
          longitude: longitude
        };
        locationsuccess(res);
      }
    }
  }
  
  module.exports.BMapWX = BMapWX;