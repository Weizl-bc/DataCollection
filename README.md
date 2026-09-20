# agDataCollection

一个 React + TypeScript + Vite + Ant Design 前端和 Node.js + TypeScript + Express 后端组成的任务管理项目。

## 目录结构

```text
agDataCollection/
├─ front/       # React + TypeScript + Vite + Ant Design
├─ backend/     # Node.js + TypeScript + Express
├─ start.cmd    # Windows 启动脚本
├─ start.sh     # macOS / Linux 启动脚本
└─ package.json # 根目录统一脚本
```

## 安装依赖

在项目根目录执行：

```bash
npm run install:all
```

也可以分别进入 `front` 和 `backend` 目录执行 `npm install`。

## 启动开发环境

在根目录执行以下任一方式：

```bash
npm run dev
```

Windows 也可以双击或在当前控制台执行：

```cmd
start.cmd
```

macOS / Linux：

```bash
./start.sh
```

启动后：

- 前端：http://localhost:5173
- 后端健康检查：http://localhost:3002/api/health
- 任务接口：http://localhost:3002/api/tasks
- 记录接口：http://localhost:3002/api/api_call_record

`concurrently` 会在同一个控制台中并行显示前端和后端日志。Windows 脚本不会使用 `start` 命令，因此不会额外打开窗口。

## 构建

```bash
npm run build
```

本地开发后端默认监听 `3002` 端口。Docker 镜像固定监听 `3001` 端口；配置示例见 `backend/.env.example`。

## 使用 Docker 部署后端

在项目根目录执行：

```bash
docker build -t ag-data-collection-backend ./backend
docker run --name ag-data-collection-backend -p 3001:3001 ag-data-collection-backend
```

Docker 构建时会把本地的 `backend/.env` 复制到镜像中的 `/app/.env`，因此构建前请确认该文件已经填写完整。`.env` 包含数据库密码和接口凭据，生成的镜像也会包含这些敏感配置，请妥善保存和分发镜像。

`backend/.env` 用于保存数据库、接口凭据和任务参数，已被 `.gitignore` 忽略。首次使用时复制 `backend/.env.example` 并填写本地配置。

远端接口的加密协议参数也只配置在 `backend/.env` 的 `TASK_CRYPTO_*` 变量中，示例文件不包含具体协议值。部署前请按照远端接口协议补齐这些变量；其中 `TASK_CRYPTO_PAYLOAD_IV` 为空或填写 `none` 表示不使用 IV，非空时还需要填写对应的 `TASK_CRYPTO_PAYLOAD_IV_ENCODING`。不要把真实的 `.env` 文件提交到 GitHub。

后端启动时会自动创建 `task_run`，并为已有的 `api_call_record` 增加任务编号和序号字段。服务重启时，未结束的任务会标记为失败。

任务页面支持参数提交、执行进度、成功失败统计、停止任务和历史查看。执行状态通过实时连接更新，记录页面支持按任务编号、请求编号和调用状态筛选。

前端统一使用 Ant Design 组件库，后续新增的表单、按钮、表格、弹窗、提示、布局等 UI 组件应优先使用 Ant Design，统一通过 `ConfigProvider` 管理主题。

## GitHub Pages

推送到 `main` 分支后，`.github/workflows/deploy-front.yml` 会自动构建并发布 `front`。
项目站点地址为：<https://weizl-bc.github.io/agDataCollection/>。

GitHub Pages 只托管静态前端。如果要让线上页面的后端健康检查正常工作，请单独部署 `backend`，然后在仓库的 Actions Variables 中设置 `VITE_API_BASE_URL` 为后端公开地址。
