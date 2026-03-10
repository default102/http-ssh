# Web SSH Client

这是一个基于 Node.js 和 React 构建的现代化 Web SSH 客户端，允许您通过浏览器直接连接和管理多台远程服务器。

## ✨ 特性

- **现代化精美 UI**：采用响应式暗黑主题与毛玻璃 (Glassmorphism) 效果，支持在移动设备（iPad/iPhone）上使用。
- **多标签页并发支持**：可以同时开启多个 SSH 会话，任意切换标签页而不断开连接。
- **完善的终端体验**：由 `xterm.js` 驱动，支持彩色输出及终端窗口自动适应大小 (Resize)。
- **双重认证方式**：支持通过 **密码** 或 **SSH 私钥 (PEM 格式)** 进行安全登录。
- **轻量且本地化编排**：服务器与密钥配置通过本地 SQLite 存储，不依赖外部大型数据库，开箱即用。
- **自动化容器部署**：提供 Dockerfile 和 GitHub Actions workflow 支持，自动打包为前后端一体的极简容器。

## 🚀 快速运行

因为前后端通过 API 和 WebSocket 进行通讯，您可以选择源码本地运行，或通过 Docker 直接拉起：

### 方式一：本地源码运行 (开发环境)

1. 克隆项目后，首先安装后端依赖：
```bash
cd backend
npm install
```

2. 安装前端依赖并构建前端产物：
```bash
cd ../frontend
npm install
npm run build
# 将生成好的构建产物放入后端的 public 文件夹中供 Express 托管
cp -r dist/* ../backend/public/
```

3. 启动后端服务器：
```bash
cd ../backend
npm start
```
*启动后，在浏览器中访问 http://localhost:3001 即可体验。*

### 方式二：Docker 容器运行 (生产环境)

项目内已经提供了经过优化的 Multi-stage `Dockerfile`，只需两条命令即可完整运行：

```bash
# 1. 构建 Docker 镜像
docker build -t web-ssh-client .

# 2. 运行容器 (将内部的 3001 端口映射至宿主机)
docker run -d -p 3001:3001 --name web-ssh web-ssh-client
```

*如果你想持久化保存添加的服务器和密钥数据，请将宿主机的目录挂载到 `/app/backend/data`：*
```bash
docker run -d -p 3001:3001 -v /path/to/your/db:/app/backend/data --name web-ssh web-ssh-client
```

## 🔐 安全与隐私须知

本项目已配置了严密的 `.gitignore`。您的 `/backend/data/` 目录（包含存储所有服务器与 SSH 私钥记录的本地 SQLite 数据库）**不会**被提交到代码仓库中，确保敏感信息仅在您的本地设备或部署的环境中可用。

## 🛠️ 技术栈

- **前端**：Vite, React, Vanilla CSS, xterm.js, feather-icons
- **后端**：Node.js, Express, ws (WebSockets), ssh2, sqlite3
- **DevOps**：Docker, GitHub Actions

---
*Developed with AI Assistant (Antigravity).*
