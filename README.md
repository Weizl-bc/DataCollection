# agDataCollection

一个 React + TypeScript + Vite 前端和 Node.js + TypeScript + Express 后端组成的全栈项目起始模板。

## 目录结构

```text
agDataCollection/
├─ front/       # React + TypeScript + Vite
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
- 后端健康检查：http://localhost:3001/api/health

`concurrently` 会在同一个控制台中并行显示前端和后端日志。Windows 脚本不会使用 `start` 命令，因此不会额外打开窗口。

## 构建

```bash
npm run build
```

后端默认监听 `3001` 端口，可通过 `backend/.env` 覆盖，配置示例见 `backend/.env.example`。

## GitHub Pages

推送到 `main` 分支后，`.github/workflows/deploy-front.yml` 会自动构建并发布 `front`。
项目站点地址为：<https://weizl-bc.github.io/agDataCollection/>。

GitHub Pages 只托管静态前端。如果要让线上页面的后端健康检查正常工作，请单独部署 `backend`，然后在仓库的 Actions Variables 中设置 `VITE_API_BASE_URL` 为后端公开地址。
