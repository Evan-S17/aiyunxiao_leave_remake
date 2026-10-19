# aiyunxiao_leave_remake
A project aiming to provide "freedom" in campus.

## 手机端请假记录前端

按提供的截图实现请假记录列表。无后端、无登录、无外部接口，所有修改只保存在当前浏览器的 `localStorage`，不改变爱云校系统中的任何记录。

### 运行

需要 Node.js 20.19+ 或 22.12+（推荐 Node.js 24）。

```sh
npm ci
npm run dev
```

页面路径：`/leave/vacationList`，根路径也可访问。手机与开发机处于同一网络时，可使用开发机的 IP 和开发服务器端口访问。

```sh
npm run build     # 生成 dist/，可部署到静态站点托管
npm run preview   # 本地查看构建产物
```

静态托管若需要直接访问 `/leave/vacationList`，请配置该路径回退至 `index.html`。

### 使用

- 保留列表界面，点击右上角 **… → 管理请假记录 → 编辑** 修改记录，或新增、删除记录。
- 支持姓名、开始/结束日期、可选具体时间、开始/结束节次、审核状态、事由、病假/事假。
- 支持周期请假：指定星期、节次，按起止日期自动计算总节数。
- 搜索按姓名匹配；筛选可组合审核状态和请假类型。待审核记录可确认撤销。
- **… → 导出本地数据 / 导入本地数据** 可备份或迁移数据。导入前会要求确认替换。
- 关闭编辑面板或取消编辑不会保存修改；保存后刷新页面仍保留。清除浏览器站点数据会删除本地记录，不同设备间不会自动同步。

### 验证

```sh
npx playwright install chromium   # 已有 /usr/bin/chromium 时可跳过
npm test
```

测试自动启动开发服务器，覆盖手机布局、字段编辑、刷新持久化、搜索筛选、撤销、新增删除、周期节数、导入导出、异常数据和存储写入失败。可用 `CHROMIUM_PATH` 指定系统 Chromium 路径。

### 在线访问（GitHub Pages）

首次启用：在仓库 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**，再到 **Actions → Deploy GitHub Pages → Run workflow** 执行部署。

部署成功后的网址：

https://evan-s17.github.io/aiyunxiao_leave_remake/

也可直接访问：

https://evan-s17.github.io/aiyunxiao_leave_remake/leave/vacationList/

以后推送到 `main` 会自动重新部署。网址在首次部署成功后才可访问；若显示 404，请检查 Pages 设置和 Actions 执行结果。
