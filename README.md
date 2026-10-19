# aiyunxiao_leave_remake
A project aiming to provide "freedom" in campus.

## 手机端请假记录前端

按提供的截图实现请假记录列表。无后端、无登录、无外部接口，所有修改只保存在当前浏览器的 `localStorage`，不改变爱云校系统中的任何记录。

界面随手机屏幕宽度自适应，支持横竖屏、文字放大和设备安全区；不模拟系统时间、信号、Wi-Fi、电量或底部系统栏。

### freecampus 手机在线访问（推荐 iOS）

站点名为 **freecampus**。可使用 Netlify 免费静态托管，GitHub 仓库保持私有；无需购买域名。

下载 **[freecampus-site.zip](./freecampus-site.zip)**，登录 [Netlify Drop](https://app.netlify.com/drop) 上传。若上传界面要求文件夹，先解压并上传含 `index.html` 的文件夹。上传成功后，在项目设置的 **Project name / Site name** 中尝试设为 `freecampus`。

期望地址为 `https://freecampus.netlify.app/`，**尚未注册或验证，名称被占用时需要另选名称**。上传与设置名称需要在自己的 Netlify 账号内完成。修改本地代码或推送 GitHub 本身不会更新手动上传的站点，后续需重新上传新版部署包。也可连接私有仓库自动构建，配置已包含在 `netlify.toml`。

线上页面也没有后端，编辑数据仅保存在当前浏览器，不会上传到 GitHub，也不会跨设备自动同步。可在 Safari 分享菜单选择“添加到主屏幕”，方便下次打开。

更换域名后，浏览器本地数据不会自动迁移。若旧页面已有修改，请先导出 JSON，再到新地址导入。

### 直接使用（无需安装）

下载 **[leave-offline.zip](./leave-offline.zip)**，解压后用浏览器打开里面的 **leave.html**。不需要 Node.js、命令行或服务器，断网也能使用。所有样式和脚本都已包含在这一个文件里。

请不要把 GitHub 的源码文本预览当作网页。ZIP 下载可保留正确的 `.html` 扩展名；文件内部已采用 HTML 字符实体和 JavaScript Unicode 转义，避免本地查看器猜错中文编码。

编辑入口仍是右上角 **… → 管理请假记录 → 编辑**。使用同一个文件和浏览器，可保留已保存的数据；也可导出备份。

手机需用支持运行本地 HTML 的浏览器打开；部分系统“文件预览”不执行脚本。

### 开发运行（可选）

需要 Node.js 20.19+ 或 22.12+（推荐 Node.js 24）。

```sh
npm ci
npm run dev
```

页面路径：`/leave/vacationList`，根路径也可访问。手机与开发机处于同一网络时，可使用开发机的 IP 和开发服务器端口访问。

```sh
npm run build     # 生成 dist/、单文件 HTML 及 leave-offline.zip 下载包
npm run preview   # 本地查看构建产物
```

### 使用

- 保留列表界面，点击右上角 **… → 管理请假记录 → 编辑** 修改记录，或新增、删除记录。
- 支持姓名、开始/结束日期、可选具体时间、开始/结束节次、审核状态、事由、病假/事假。
- 修改任意记录的姓名并保存后，全部记录同步更名，新记录也使用该姓名。也可在 **… → 统一更改姓名** 一次修改。修改仅存于当前浏览器，不会写回 GitHub。
- 第一条初始记录默认为“已批准”，起止日期按设备当地当天生成。未手动改过的默认日期在次日重新打开时更新；手动设置日期后保留设置。
- 支持周期请假：指定星期、节次，按起止日期自动计算总节数。
- 搜索按姓名匹配；筛选可组合审核状态和请假类型。待审核记录可确认撤销。
- **… → 导出本地数据 / 导入本地数据** 可备份或迁移数据。导入前会要求确认替换。
- 关闭编辑面板或取消编辑不会保存修改；保存后刷新页面仍保留。清除浏览器站点数据会删除本地记录，不同设备间不会自动同步。
- 本地数据没有应用层过期时间；浏览器仍可能因清理站点数据、无痕模式或系统回收而删除数据，请使用导出功能备份。旧版数组 JSON 和新版包含统一姓名的备份均可导入。

### 验证

```sh
npx playwright install chromium   # 已有 /usr/bin/chromium 时可跳过
npm test
```

测试自动启动开发服务器，覆盖手机布局、字段编辑、刷新持久化、搜索筛选、撤销、新增删除、周期节数、导入导出、异常数据和存储写入失败。可用 `CHROMIUM_PATH` 指定系统 Chromium 路径。

### 开发服务器访问（可选）

不需要购买域名、服务器或部署服务。先安装 Node.js（推荐 24），然后在自己的电脑终端运行：

```sh
git clone https://github.com/Evan-S17/aiyunxiao_leave_remake.git
cd aiyunxiao_leave_remake
npm ci
npm run dev
```

电脑浏览器访问 `http://localhost:5173/leave/vacationList`。如果端口被占用，请使用终端实际显示的端口。

手机与电脑连接同一 Wi-Fi，手机浏览器访问 `http://电脑的局域网IP:5173/leave/vacationList`（将地址替换为电脑的实际局域网 IP，例如 `192.168.1.100`）。运行期间保持电脑和终端开启；若无法连接，检查电脑防火墙是否允许该端口的局域网访问。

手机上的 `localhost` 指手机自身，不能用来访问电脑上的服务。云端工作区的 `localhost` 也不是自己电脑的地址。

本仓库提供 Netlify 部署配置、freecampus 部署包、单文件下载和本地运行方式。
