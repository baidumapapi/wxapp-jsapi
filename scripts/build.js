/**
 * 构建脚本
 *
 * 构建管线：src/bmap-wx.js
 *   → babel（ES6+ 语法降级 ES5：let/const、箭头函数、class、async/await→Promise 链）
 *   → terser（压缩）
 *   → 产物输出到 dist/bmap-wx.min.js（发布产物）并同步 demo/libs/bmap-wx.min.js
 *     （demo 引用的压缩包，开箱即用）
 * 产物为 ES5 语法，不依赖 regenerator 运行时，可直接在微信小程序中运行。
 *
 * 用法：
 *   npm install        # 首次安装依赖
 *   npm run build      # 一次性构建
 *   npm run watch      # 监听 src/bmap-wx.js，变更后自动构建
 */
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const presetEnv = require('@babel/preset-env');
const terser = require('terser');

const root = path.resolve(__dirname, '..');
const pkg = require('../package.json');
const srcFile = path.join(root, 'src', 'bmap-wx.js');
const outputFiles = [
  path.join(root, 'dist', 'bmap-wx.min.js'), // 发布产物（独立目录，供使用者引入）
  path.join(root, 'demo', 'libs', 'bmap-wx.min.js'), // demo 引用的压缩包（开箱即用）
];
const banner = `/*! ${pkg.name} v${pkg.version} | 百度地图微信小程序 JS API */`;

/** 小程序运行环境：按 ES5 目标降级（Android 5+/iOS 9+ 的 JSCore/V8） */
const BABEL_OPTIONS = {
  babelrc: false,
  configFile: false,
  presets: [[
    presetEnv,
    {
      targets: { browsers: ['iOS >= 9', 'Android >= 5'] },
      modules: false,
    },
  ]],
  plugins: [require('babel-plugin-transform-async-to-promises')],
};

/**
 * 转译 + 压缩 src -> 产物，并自检方法完整性。
 * @returns {Promise<number>} 产物字节数
 */
async function compile() {
  const source = fs.readFileSync(srcFile, 'utf8');
  const { code } = await babel.transformAsync(source, BABEL_OPTIONS);
  const result = await terser.minify(code, { compress: true, mangle: true });
  if (result.error) { throw result.error; }
  const output = banner + '\n' + result.code;

  for (const file of outputFiles) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, output);
  }

  // 自检：产物可被引用、方法完整
  delete require.cache[require.resolve(outputFiles[0])];
  const lib = require(outputFiles[0]);
  const bmap = new lib.BMapWX({ ak: 'test' });
  const methods = [
    'search', 'suggestion', 'reverseGeocoding', 'regeocoding', 'geocoding',
    'driving', 'walking', 'transit', 'riding', 'weather', 'weatherAbroad',
    'staticMap',
  ];
  const missing = methods.filter(m => typeof bmap[m] !== 'function');
  if (missing.length) {
    throw new Error('产物缺少方法：' + missing.join(', '));
  }
  return output.length;
}

let building = false; // watch 串行标志：构建中忽略新触发，避免并发覆写产物

function runOnce(label, onDone) {
  if (building) {
    onDone && onDone();
    return;
  }
  building = true;
  compile()
    .then(size => {
      building = false;
      for (const file of outputFiles) {
        console.log(`[${label}] ${path.relative(root, file)}  ${size} bytes`);
      }
      onDone && onDone();
    })
    .catch(err => {
      building = false;
      console.error(`[${label}] 构建失败：`, err);
      onDone && onDone(err);
    });
}

if (process.argv.includes('--watch')) {
  // 监听依赖仅在 watch 模式加载（非 watch 构建不需要 chokidar）
  const chokidar = require('chokidar');
  console.log('[watch] 监听中：' + path.relative(root, srcFile) + '（Ctrl+C 退出）');
  runOnce('watch', undefined);

  let timer = null;
  chokidar.watch(srcFile, { ignoreInitial: true }).on('all', event => {
    if (event !== 'change' && event !== 'add') { return; }
    // 防抖：编辑器保存可能触发多次 change；building 标志避免并发覆写
    clearTimeout(timer);
    timer = setTimeout(() => {
      const t = new Date().toTimeString().slice(0, 8);
      runOnce(`watch ${t}`);
    }, 150);
  });
} else {
  runOnce('build', err => {
    if (err) { process.exit(1); }
  });
}