var bmap = require('../../libs/bmap-wx.min.js');
var wxMarkerData = [];
Page({
  data: {
    markers: [],
    latitude: '',
    longitude: ''
  },

  onLoad: function () {
    var that = this;
    var BMap = new bmap.BMapWX({
      ak: '您的AK'
    });

    var fail = function (data) {
      console.log(data)
    };
    var success = function (data) {
      wxMarkerData = data.wxMarkerData;
      that.setData({
        markers: wxMarkerData
      });
      that.setData({
        latitude: wxMarkerData[0].latitude
      });
      that.setData({
        longitude: wxMarkerData[0].longitude
      });  
    }
    BMap.geocoding({
      address: '北京市海淀区上地十街10号',
      fail: fail,
      success: success,
      iconPath: '../../img/marker_red.png',
      iconTapPath: '../../img/marker_red.png'
    });
  }

})