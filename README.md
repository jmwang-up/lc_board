# LC Board

LC Board 是一个本地优先的 LeetCode 练习看板。算法分类、题目和练习记录保存在当前浏览器的 IndexedDB 中；Node API 只代理公开题目元数据，不保存练习数据。

## Runtime prerequisites

- Node.js 22 or newer (the supported range is `>=22`).
- npm, included with the supported Node.js distribution.
- A deployment capable of serving static files and reverse-proxying same-origin `/api` requests to the metadata API.

## Local development

```sh
npm install
npm run dev
```

Web 开发服务器默认使用 Vite 地址。元数据 API 使用 `HOST` 和 `PORT` 配置；默认监听 `0.0.0.0:8787`。本地 Vite 代理仍将 `/api` 转发到 `localhost:8787`。

## Verification

```sh
npm test
npm run test:e2e
npm run build
npm run lint
```

端到端测试会模拟元数据响应，但使用 Chromium 真实的 IndexedDB。首次运行前如本机缺少浏览器，请执行 `npx playwright install chromium`。

## Deployment

安装生产与构建依赖并同时构建 SPA 和 API：

```sh
npm ci
npm run build
```

SPA 构建产物位于 `dist/`，可编译的 Node API 产物位于 `dist-api/server/`。启动 API：

```sh
HOST=0.0.0.0 PORT=8787 npm run start:api
```

`HOST` 默认为可部署的 `0.0.0.0`，`PORT` 默认为 `8787` 且必须是 1–65535 的整数。生产环境必须将同源 `/api` 请求反向代理到该 Node 进程，静态托管 `dist/`，并将所有非 `/api` SPA 路径回退到 `dist/index.html`。API 进程需要出站 HTTPS 访问 `https://leetcode.cn/graphql/`；它不保存个人数据。

元数据自动读取失败时，记录对话框会保留规范化后的题目链接并开放手动填写字段；`leetcode.cn` 的上游接口契约可能变化，因此部署时应保留并监控这一回退路径。

## Backup and restore

Personal data is stored in this browser's IndexedDB. Export a JSON backup before clearing browser site data. The Node API stores no practice data.

在“数据管理”中选择“导出数据”保存 JSON。恢复时选择该 JSON 文件；导入会校验格式并合并题目、练习和算法，不覆盖已有记录。导出后再清空数据，可用同一文件恢复实体及练习关系。
