# === 前端构建阶段 ===
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
# 缓存安装依赖
COPY frontend/package*.json ./
RUN npm install
# 复制源码并构建
COPY frontend/ ./
RUN npm run build


# === 后端与最终运行阶段 ===
FROM node:20-alpine
WORKDIR /app/backend

# 安装编译 SQLite 支持库所需的环境
RUN apk add --no-cache python3 make g++

# 缓存安装后端依赖
COPY backend/package*.json ./
RUN npm install --production

# 复制后端源码
COPY backend/ ./

# 从前端构建阶段复制静态产物到后端的 public 目录
COPY --from=frontend-builder /app/frontend/dist ./public

# 暴露端口
EXPOSE 3001

# 启动服务
CMD ["npm", "start"]
