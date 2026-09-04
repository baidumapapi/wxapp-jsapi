# 贡献指南（CONTRIBUTING）

本指南面向**仓库维护者与代码贡献者**；SDK 的使用方法见 [README.md](./README.md)。

## 项目结构

```
src/        SDK 源码（ES2017+ / async-await，唯一的编辑对象）
dist/       发布产物（bmap-wx.min.js，随构建生成并提交）
demo/       完整示例小程序（微信开发者工具导入运行，引用 demo/libs 下的产物）
scripts/    构建与测试脚本（build.js / smoke.js / staticmap-live.js）
index.d.ts  TypeScript 类型声明（需与 src 同步维护）
```

## 构建

依赖 Node.js >= 14：

```bash
npm install    # 首次安装依赖
npm run build  # 转译 + 压缩，输出到 dist/ 与 demo/libs/，并自检 12 个方法齐全
npm run watch  # 监听 src/bmap-wx.js 变更自动构建
```

构建管线：`src/bmap-wx.js` → **babel**（@babel/preset-env 降级到 ES5，目标 iOS 9+/Android 5+，不依赖 regenerator 运行时）→ **terser** 压缩 → 产物。

**产物同步约定**：`dist/bmap-wx.min.js`（发布）与 `demo/libs/bmap-wx.min.js`（demo 引用）由构建生成并**随提交入库**——改动 `src/` 后必须重新 `npm run build`，确保产物与源码一致（提交前用 `git status` 确认无意外差异）。

## 测试

```bash
npm test               # 本地用例（签名/坐标转换/解析/错误兜底/截断，无网络依赖）
BMAP_AK=<ak> npm test  # 追加真实接口用例
```

新增功能时请在 `scripts/smoke.js` 补充用例（用例风格：`test('描述', async () => {...})`，请求通过 mock `global.wx` 注入）。

## 运行 Demo

1. 用微信开发者工具导入 `demo` 目录
2. `cp demo/config.example.js demo/config.js` 后填入你的 AK（`demo/config.js` 已被 git 忽略，仅存本地）
3. 开发阶段可在工具中勾选"不校验合法域名"；正式发布前需在小程序后台将 `https://api.map.baidu.com` 加入 request 合法域名
4. 建议使用「微信小程序」类型 AK（绑定 AppID）；遇 220「APP Referer 校验失败」可改用**服务端**类型 AK（IP 白名单留空或配 `sk` SN 签名）

## 开发约定

- **只改 `src/`**：`dist/` 与 `demo/libs/` 是生成物，不要手工修改（改完 `npm run build`）
- **类型同步**：改公开方法/参数/返回字段时同步更新 `index.d.ts`
- **Demo 页面**：demo 页面引用 `demo/utils/bmap.js` 的 Promise 化封装（`invoke`），页面统一 `async/await` + `setData`；公共逻辑（色板、POI 映射、格式化、MARKER 图标）收敛在 `demo/utils/bmap.js`，不要在页面重复实现
- **坐标系**：SDK 输出统一为 GCJ-02（`ret_coordtype=gcj02ll` 强制）；后续接口需保持
- **提交信息**：`type(scope): 描述` 风格（如 `fix(sdk):`、`feat(demo):`、`docs(readme):`、`refactor:`、`types:`）

## 提交流程（PR）

1. 从 `master` 切出功能分支；`src/`、`demo/`、`dist/`、`index.d.ts` 的改动随提交一并入库
2. 提交前：`npm run build` + `npm test` 全绿（改 `src/` 时）
3. 推送分支并开 **Pull Request**（目标默认 `master`）；重大功能建议先在 `dev` 分支沉淀验证后再提 PR
4. 本仓库通过 GitHub 合并（rebase / squash 由维护者定）；合并前确保产物与类型声明已同步

## 发布检查（发版前逐项确认）

1. **AK 安全**：`demo/config.js`（本地真实密钥）与 `demo/project.private.config.json` 已被 `.gitignore` 忽略，不得提交；仓库只发布 `demo/config.example.js` 占位模板（`ak: ''`）
2. **产物同步**：`npm run build` 后确认 `dist/`、`demo/libs/` 与源码一致（`git status` 干净）
3. **回归**：`npm test` 全绿；有条件时 `BMAP_AK=<正式ak> npm test` 跑真实接口
4. **类型同步**：`index.d.ts` 与 `src/` 公开 API 对齐（`npx -y -p typescript tsc --noEmit --strict index.d.ts` 验证）
5. **文档**：README（使用者视角）内容与实现一致；本文件与流程一致
6. **Demo 完整性**：`demo/app.json` 注册的每个页面四件套（.js/.json/.wxml/.wxss）齐全；WXML 标签配平、绑定 handler 存在