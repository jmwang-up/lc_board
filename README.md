# LC Board

LC Board 是一个本地优先的 LeetCode 练习看板。算法分类、题目和练习记录保存在当前浏览器的 IndexedDB 中；Node API 只代理公开题目元数据，不保存练习数据。

## Local development

```sh
npm install
npm run dev
```

Web 开发服务器默认使用 Vite 地址，元数据 API 默认监听 `127.0.0.1:8787`。通过 `PORT` 修改 API 端口；同时需要调整 Vite 或部署环境的 `/api` 代理目标。

## Verification

```sh
npm test
npm run test:e2e
npm run build
npm run lint
```

端到端测试会模拟元数据响应，但使用 Chromium 真实的 IndexedDB。首次运行前如本机缺少浏览器，请执行 `npx playwright install chromium`。

## Deployment

构建产物位于 `dist/`。生产环境必须把同源 `/api` 请求路由到 Node API，并将其他路径回退到 `index.html`。元数据自动读取失败时，记录对话框会保留规范化后的题目链接并开放手动填写字段；`leetcode.cn` 的上游接口契约可能变化，因此部署时应保留并监控这一回退路径。

## Backup and restore

Personal data is stored in this browser's IndexedDB. Export a JSON backup before clearing browser site data. The Node API stores no practice data.

在“数据管理”中选择“导出数据”保存 JSON。恢复时选择该 JSON 文件；导入会校验格式并合并题目、练习和算法，不覆盖已有记录。导出后再清空数据，可用同一文件恢复实体及练习关系。
