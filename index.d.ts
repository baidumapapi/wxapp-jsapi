/**
 * 百度地图微信小程序 JS API（bmap-wx）类型声明
 *
 * 回调式 API：各方法 success 回调入参见各 Success 类型（由对应 Param 的泛型携带）；
 * fail 回调统一为 FailResult。所有解析输出的坐标均为 GCJ-02（微信小程序坐标系）。
 */
export interface BMapWXOptions {
  /** 百度地图开放平台密钥（必填） */
  ak: string;
  /** 服务密钥；配置后自动按官方 SN 签名机制生成 timestamp+sn（ak 保留且参与签名） */
  sk?: string;
  /** 自定义 API 域名，默认 https://api.map.baidu.com */
  serviceHost?: string;
}

/** 失败回调统一入参 */
export interface FailResult {
  /** 后端原文（展示用，超长截断 160 字符并加 …） */
  errMsg: string;
  /** 错误码映射的中文文案 */
  message: string;
  /** 百度状态码 */
  statusCode: number;
  /** 完整原文（未截断，供诊断排查） */
  rawMessage: string;
}

/**
 * 参数基类：success 回调携带本接口的成功入参类型 T。
 * 保持泛型避免 success 推断被 unknown 吞掉；各业务 Param 必须显式传入 T。
 */
export interface ParamBase<T> {
  success?: (data: T) => void;
  fail?: (err: FailResult) => void;
  [key: string]: unknown;
}

/** 折线坐标点（gcj02） */
export interface PolylinePoint {
  latitude: number;
  longitude: number;
}

/** 小程序 map markers 规范元素（SDK 解析字段，坐标 gcj02） */
export interface MarkerItem extends PolylinePoint {
  id: number;
  title?: string;
  address?: string;
  telephone?: string;
  desc?: string;
  business?: string;
  iconPath?: string;
  iconTapPath?: string;
  width?: number;
  height?: number;
  alpha?: number;
  [key: string]: unknown;
}

/** 路线方案元素（routes 数组元素） */
export interface RouteItem {
  /** 距离（米） */
  distance: number;
  /** 耗时（秒） */
  duration: number;
  prefer?: string;
  /** 本方案折线（gcj02） */
  polyline: PolylinePoint[];
  /** 分步指引（步骤均为 JSON 对象，结构随接口浮动，见官方 direction/v2 文档） */
  steps: Array<Record<string, unknown>>;
}

/* ---------------- 成功回调返回类型 ---------------- */

/** search 成功回调入参 */
export interface SearchSuccess {
  /** 百度 Place API 原始响应 */
  originalData: Record<string, unknown>;
  /** 小程序 marker 数组（POI） */
  wxMarkerData: MarkerItem[];
}

/** suggestion 成功回调入参 */
export interface SuggestionSuccess {
  /** Place Suggestion API 原始响应 */
  originalData: Record<string, unknown>;
  /** 联想结果数组 */
  result: SuggestionItem[];
}

/** suggestion 结果元素（result 数组） */
export interface SuggestionItem {
  name?: string;
  address?: string;
  city?: string;
  district?: string;
  /** 经纬度（gcj02；SDK 已固定 ret_coordtype=gcj02ll，可直接用于小程序地图） */
  location?: { lat: number; lng: number };
  [key: string]: unknown;
}

/** reverseGeocoding / geocoding 成功回调入参 */
export interface GeocodingSuccess {
  originalData: Record<string, unknown>;
  wxMarkerData: MarkerItem[];
}

/** 路线规划成功回调入参（driving / walking / transit / riding） */
export interface RouteSuccess {
  /** direction/v2 原始响应（注意：transit 的原始 origin/destination 等字段为百度坐标系） */
  originalData: Record<string, unknown>;
  /** 规范化的路线方案数组 */
  routes: RouteItem[];
  /** 主方案折线（routes[0].polyline），可直接用于 <map polyline> 的 points */
  wxPolylineData: PolylinePoint[];
}

/** 天气成功回调入参（weather / weatherAbroad） */
export interface WeatherSuccess {
  originalData: Record<string, unknown>;
  weatherData: WeatherData;
  /** 兼容旧版调用：值为 [weatherData] */
  wxMarkerData: WeatherData[];
}

/* ---------------- 天气数据 ---------------- */

/** 7 天天气预报条目 */
export interface WeatherForecastItem {
  /** 日期（yyyy-MM-dd） */
  date: string;
  /** 星期（如"星期四"） */
  week: string;
  /** 白天天气现象（如"晴"） */
  textDay: string;
  /** 最高温（℃） */
  high: number | string;
  /** 最低温（℃） */
  low: number | string;
}

/** 解析后的天气对象 */
export interface WeatherData {
  country: string;
  province: string;
  currentCity: string;
  /** 区县（location.name，可能为空） */
  district?: string;
  /** 天气描述（如"多云"） */
  weatherDesc: string;
  /** 当前温度（数字，摄氏度） */
  temperature: number;
  /** 体感温度（摄氏度） */
  feelsLike?: number;
  /** 相对湿度（数字，如 23 表示 23%，不带 % 后缀） */
  humidity: number;
  /** 风力等级描述 */
  windClass: string;
  /** 风向 */
  windDir: string;
  /** 空气质量指数 */
  aqi?: number;
  /** 能见度（米） */
  vis?: number;
  /** 更新时间（接口原始格式，如 "20260903171500"，展示需自行格式化） */
  updatedAt: string;
  /** 7 天预报（data_type=all 时返回） */
  forecast?: WeatherForecastItem[];
  /** 兼容旧版调用：与 updatedAt 相同 */
  updatetime: string;
}

/** wx.getLocation 定位结果（getWXLocation 回调入参） */
export interface LocationResult {
  latitude: number;
  longitude: number;
  /** 位置精度（米） */
  accuracy?: number;
  /** 海拔（米） */
  altitude?: number;
  /** 垂直精度（米） */
  verticalAccuracy?: number;
  /** 水平精度（米） */
  horizontalAccuracy?: number;
  /** 速度（米/秒） */
  speed?: number;
  [key: string]: unknown;
}

/* ---------------- 各方法参数（param extends ParamBase<对应 success 类型>） ---------------- */

/** search 检索参数 */
export interface SearchParam extends ParamBase<SearchSuccess> {
  /** 中心点"纬度,经度"，默认当前定位 */
  location?: string;
  /** 检索关键词，默认 "生活服务$美食&酒店" */
  query?: string;
  /** 检索半径（米），默认 2000 */
  radius?: number;
  /** 分页：每页条数（默认 10）与页码（默认 0） */
  page_size?: number;
  page_num?: number;
  /** 检索范围：scope=1 取默认字段，2 返回附加信息 */
  scope?: number;
  /** 过滤条件（如 "sort=distance"） */
  filter?: string;
  /** 输入坐标类型，默认 2（gcj02） */
  coord_type?: number;
  /* marker 样式透传：iconPath / iconTapPath / width / height / alpha */
}

/** suggestion 检索参数 */
export interface SuggestionParam extends ParamBase<SuggestionSuccess> {
  /** 输入的关键字 */
  query?: string;
  /** 检索城市，默认全国 */
  region?: string;
  city_limit?: boolean;
  /** 返回格式（默认 json） */
  output?: string;
}

/** 逆地理编码参数 */
export interface ReverseGeocodingParam extends ParamBase<GeocodingSuccess> {
  /** 待解析经纬度"纬度,经度"，默认当前定位 */
  location?: string;
  /** 输入坐标类型，默认 gcj02ll（与小程序坐标系一致） */
  coordtype?: string;
  /** 是否返回周边 POI（0/1），默认 1 */
  extensions_poi?: 0 | 1;
  /** 是否返回周边道路（默认 false） */
  extensions_road?: boolean;
  /** 是否返回乡镇街道（默认 false） */
  extensions_town?: boolean;
  /** 检索半径（米），默认 1000 */
  radius?: number;
  /** 返回语言（如 zh-CN），默认 zh-CN */
  language?: string;
  language_auto?: 0 | 1;
  /** 返回格式（默认 json） */
  output?: string;
}

/** 地理编码参数 */
export interface GeocodingParam extends ParamBase<GeocodingSuccess> {
  /** 待解析地址（必填），如"北京市海淀区上地十街10号" */
  address: string;
  /** 返回坐标类型，默认 gcj02ll（旧键 coordtype 兼容） */
  ret_coordtype?: string;
  /** 地址所在城市，默认空 */
  city?: string;
  /** 返回格式（默认 json） */
  output?: string;
}

/** 路线规划通用参数（driving / walking / transit / riding 共用） */
export interface RouteParam extends ParamBase<RouteSuccess> {
  /** 起点，"纬度,经度"或地点名称（必填） */
  origin: string;
  /** 终点，"纬度,经度"或地点名称（必填） */
  destination: string;
  /** 策略值（见官方 direction/v2 文档），默认 0 */
  tactics?: number;
  /** 输出坐标类型，默认 gcj02（支持 gcj02 / bd09ll / wgs84） */
  ret_coordtype?: string;
  /** 输入坐标类型（driving / walking / riding），默认 gcj02；公交接口不支持，SDK 自动换算 */
  coord_type?: string;
  /** 起点城市（transit 常用，如"北京市"；名称形式起点时需提供） */
  region?: string;
  /** 终点城市（transit 跨城时） */
  region_d?: string;
  /** 途经城市（driving / riding） */
  city?: string;
  /** 车牌号（driving 限行策略/riding 用） */
  plate?: string;
  /** 路线宽度（riding，像素） */
  width?: number;
  /** 返回格式（默认 json） */
  output?: string;
}

/** 天气检索参数（weather / weatherAbroad 共用） */
export interface WeatherParam extends ParamBase<WeatherSuccess> {
  /** 天气地点，"经度,纬度"（注意与其余接口顺序相反，天气接口约定），默认当前定位 */
  location?: string;
  /** 区域 ID（与 location 二选一，同时传时官方按 district_id 优先）；不传按经纬度查询 */
  district_id?: string;
  /** 返回内容：all 实况+7天预报（默认）/ now 仅实况 */
  data_type?: 'all' | 'now';
  /** 返回格式（默认 json） */
  output?: string;
  /** 坐标类型（默认 gcj02） */
  coordtype?: string;
}

/** 静态图成功回调入参 */
export interface StaticMapSuccess {
  /** 可直接用于 <image src> 的图片地址 */
  url: string;
  /** 已发送的完整请求参数 */
  originalData: Record<string, unknown>;
}

/** 静态图参数（本地拼装 URL，不发起网络请求） */
export interface StaticMapParam extends ParamBase<StaticMapSuccess> {
  /** 中心点"经度,纬度"或地点名，默认北京 */
  center?: string;
  /** 宽度 px（默认 400，scale=2 时 ≤512） */
  width?: number;
  /** 高度 px（默认 300） */
  height?: number;
  /** 地图级别 [3,19]（scale=2 高清图上限 18），默认 11 */
  zoom?: number;
  /** 1 普通 / 2 高清（输出 2 倍像素；宽高 ≤512、zoom ≤18） */
  scale?: 1 | 2;
  /** 坐标类型，默认 gcj02ll */
  coordtype?: string;
  /** 标注点坐标，如 "lng,lat|lng2,lat2"（多点用竖线 | 分隔，样式经 markerStyles） */
  markers?: string;
  /** 标注点样式：size,label,color，多组用竖线 | 分隔，与 markers 一一对应 */
  markerStyles?: string;
  /** 标签坐标，如 "lng,lat"（仅坐标，多点用竖线 | 分隔，文字经 labelStyles） */
  labels?: string;
  /** 标签样式：content,fontWeight,fontSize,fontColor,bgColor,border（content 为标签文字） */
  labelStyles?: string;
  /** 折线/多边形：多条折线用竖线 | 分隔，每条折线的点用分号 ; 分隔，如 "lng,lat;lng2,lat2|..." */
  paths?: string;
  /** 折线样式：color,weight,opacity[,fillColor]，多组用竖线 | 分隔 */
  pathStyles?: string;
  /** 版权样式：0 log+文字 / 1 纯文字（默认 0） */
  copyright?: number | string;
  /** 地图视野范围（与 center 二选一）："minX,minY;maxX,maxY" */
  bbox?: string;
  /** ph（高清屏）/ pl（低分屏），自 V3 起已废弃（服务端不再区分，保留兼容） */
  dpiType?: 'ph' | 'pl';
}

/* ---------------- 类 ---------------- */

export class BMapWX {
  constructor(options: BMapWXOptions);

  search(param: SearchParam): void;
  suggestion(param: SuggestionParam): void;
  reverseGeocoding(param: ReverseGeocodingParam): void;
  /** @deprecated 请使用 reverseGeocoding */
  regeocoding(param: ReverseGeocodingParam): void;
  geocoding(param: GeocodingParam): void;
  driving(param: RouteParam): void;
  walking(param: RouteParam): void;
  transit(param: RouteParam): void;
  riding(param: RouteParam): void;
  weather(param: WeatherParam): void;
  weatherAbroad(param: WeatherParam): void;
  staticMap(param: StaticMapParam): void;

  /**
   * 低级定位接口（兼容旧版公开调用）
   */
  getWXLocation(
    type?: string,
    success?: (res: LocationResult) => void,
    fail?: (err: { errMsg: string }) => void,
    complete?: () => void
  ): void;
}