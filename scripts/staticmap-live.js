/**
 * 静态图（staticimage/v2）全入参验证 —— 真实 API 探测
 *
 * 用法：node scripts/staticmap-live.js
 * AK 来源：环境变量 BMAP_AK，或 demo/config.js（已 gitignore，本地生效）。
 *
 * 判定口径：
 *  - 返回图片（HTTP 200 且 body 为 PNG/JPEG）= API 接受该入参组合
 *  - 图片 md5 与基线不同 = 该入参确实影响渲染（生效）
 *
 * 注意：请求需保持间隔（快速连发时 CDN 会返回错位缓存图，产生误判）；
 * 官方分隔符：markers/labels 多点用竖线 "|"，paths 的点用分号 ";"。
 */
const https = require('https');
const crypto = require('crypto');
const { BMapWX } = require('../src/bmap-wx.js');

let ak = process.env.BMAP_AK || '';
if (!ak) {
  try {
    ak = require('../demo/config.js').ak || '';
  } catch (e) { /* 无本地配置 */ }
}
if (!ak) {
  console.error('未找到 AK（设置 BMAP_AK 或提供 demo/config.js）');
  process.exit(1);
}

const CENTER = '116.397470,39.908823'; // 天安门（gcj02）
const COMMON = { center: CENTER, width: 500, height: 300, zoom: 12, coordtype: 'gcj02ll' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 解析 PNG/JPEG 实际输出尺寸（图片显示尺寸） */
function imgSize(buf) {
  if (buf.length > 24 && buf[0] === 0x89) {
    return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`; // PNG IHDR
  }
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    return 'JPEG'; // 尺寸在 APP0 后，非本脚本关注
  }
  return '?';
}

/** 经 SDK 生成 URL 并请求，返回 { ok, size, dim, md5, err } */
function fetchImage(params) {
  const client = new BMapWX({ ak });
  return new Promise((resolve) => {
    client.staticMap(Object.assign({}, params, {
      success({ url }) {
        https.get(url, (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const buf = Buffer.concat(chunks);
            const isImg = buf.length > 8 && (buf[0] === 0x89 || (buf[0] === 0xFF && buf[1] === 0xD8) || (buf[0] === 0x47 && buf[1] === 0x49));
            if (isImg) {
              resolve({ ok: true, size: buf.length, dim: imgSize(buf), md5: crypto.createHash('md5').update(buf).digest('hex'), url });
            } else {
              let msg = buf.toString('utf8').slice(0, 160);
              try {
                const j = JSON.parse(buf.toString('utf8'));
                msg = `status=${j.status} message=${j.message}`;
              } catch (e) { /* 非 JSON 错误体 */ }
              resolve({ ok: false, err: msg, url });
            }
          });
        }).on('error', (e) => resolve({ ok: false, err: e.message, url }));
      },
      fail(err) { resolve({ ok: false, err: (err && err.errMsg) || 'SDK fail' }); },
    }));
  });
}

const CASES = [
  { name: '基线（500x300 @ zoom12）', params: {} },
  { name: 'zoom=13', params: { zoom: 13 } },
  { name: 'width/height=600x400', params: { width: 600, height: 400 } },
  { name: 'scale=2 高清（512x320）', params: { scale: 2, dpiType: 'ph', width: 512, height: 320 } },
  { name: 'coordtype=wgs84ll', params: { coordtype: 'wgs84ll' } },
  { name: 'label 文字标注', params: { labels: CENTER, labelStyles: '天安门,1,18,0x006600,0xFFFFFF,1' } },
  { name: 'label 多标签（竖线）', params: { labels: `${CENTER}|116.403,39.915`, labelStyles: '天安门,1,18,0x006600,0xFFFFFF,1|故宫,1,14,0xFFFFFF,0x0066CC,1' } },
  { name: 'marker 单点', params: { markers: CENTER, markerStyles: '16,天安门,0xFF6600' } },
  { name: 'marker 多点（竖线）', params: { markers: `${CENTER}|116.403,39.915`, markerStyles: '16,天安门,0xFF6600|16,故宫,0x0066CC' } },
  { name: 'marker 多点（分号，应为单个生效）', params: { markers: `${CENTER};116.403,39.915`, markerStyles: '16,天安门,0xFF6600' } },
  { name: 'path 折线', params: { paths: `${CENTER};116.403,39.915;116.403,39.903`, pathStyles: '0xFF0000,5,0.8' } },
  { name: 'path 闭合多边形+fillColor', params: { paths: '116.39,39.90;116.40,39.90;116.40,39.91;116.39,39.90', pathStyles: '0x0066FF,4,0.6,0x00A0E9' } },
  { name: 'path 多折线（竖线）', params: { paths: `${CENTER};116.403,39.915|116.40,39.90;116.41,39.90`, pathStyles: '0xFF0000,5,0.8|0x0066FF,4,0.6' } },
  { name: 'copyright=1 纯文字', params: { copyright: 1 } },
  { name: 'bbox 视野（替代 center）', params: { center: undefined, bbox: '116.39,39.90;116.41,39.92' } },
  { name: '已知废弃：dpiType=pl（应与 ph 相同）', params: { scale: 2, dpiType: 'pl', width: 512, height: 320 } },
  { name: '边界：scale=2 + zoom=19（高清上限18）', params: { scale: 2, dpiType: 'ph', width: 512, height: 320, zoom: 19 } },
  { name: '边界：scale=2 且 800x600 >512', params: { scale: 2, dpiType: 'ph', width: 800, height: 600 } },
  { name: '边界：zoom=25 越界', params: { zoom: 25 } },
];

(async () => {
  const base = await fetchImage(COMMON);
  if (!base.ok) {
    console.error('基线请求失败：' + (base.err || ''));
    process.exit(1);
  }
  console.log(`AK: ${ak.slice(0, 8)}…  基线：${base.dim} ${base.size} bytes md5=${base.md5.slice(0, 12)}\n`);
  let diff = 0;
  for (const c of CASES) {
    const params = Object.assign({}, COMMON, c.params);
    // 仅 bbox 等显式传 center: undefined 的 case 才移除 center
    if (Object.prototype.hasOwnProperty.call(c.params, 'center') && c.params.center === undefined) {
      delete params.center;
    }
    const r = await fetchImage(params);
    if (!r.ok) {
      console.log(`✗ ${c.name}\n    ${r.err}`);
      await sleep(1200);
      continue;
    }
    const same = r.md5 === base.md5;
    console.log(`✓ ${c.name}\n    ${r.dim} ${r.size} bytes  ${same ? '⚠ 与基线相同（参数未生效）' : '与基线不同（生效）'}`);
    if (!same) { diff++; }
    await sleep(1200);
  }
  console.log(`\n${diff}/${CASES.length} 个入参组合与基线渲染不同`);
})();