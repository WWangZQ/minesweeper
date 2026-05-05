# 扫雷对战 · Minesweeper Battle

多人联机扫雷游戏，支持三种对战模式。Claude 风格暖色 UI。

## 快速开始

### 开发模式

```bash
npm install

# 终端 1：WebSocket 服务器
npm run dev:server

# 终端 2：Vite 前端
npm run dev
```

打开 `http://localhost:5173`。多人测试开两个标签页即可联机。

### 生产模式（单进程）

```bash
npm install
npm run build
npm start
```

打开 `http://localhost:3001`，前后端一体运行。

## 游戏模式

| 模式 | 说明 |
|------|------|
| **实时对战** | 同一张棋盘，抢格子。踩雷淘汰，最后存活者胜 |
| **竞速比拼** | 相同雷布局各自独立操作，先完成者胜 |
| **合作模式** | 共享棋盘和旗帜标记，协力排雷通关 |

## 操作方式

| 操作 | 效果 |
|------|------|
| 左键点击 | 揭开格子 |
| 右键点击 | 标记 / 取消旗帜 🚩 |

## 难度

| 难度 | 棋盘 | 雷数 |
|------|------|------|
| 初级 | 9×9 | 10 |
| 中级 | 16×16 | 40 |
| 高级 | 30×16 | 99 |

## 部署

### Docker Compose 部署（推荐）

```bash
# 构建并启动（后台运行）
docker compose up -d

# 查看日志
docker compose logs -f

# 停止
docker compose down
```

端口映射在 `compose.yaml` 中配置，默认 `宿主机3002 → 容器3001`，按需修改：

```yaml
ports:
  - "3002:3001"   # 宿主机端口:容器端口
```

### Docker 部署（单容器）

```bash
# 构建镜像
docker build -t minesweeper .

# 启动（自定义端口，比如 3002）
docker run -d --name minesweeper -p 3002:3001 minesweeper
```

环境变量 `PORT` 可修改应用监听端口（默认 3001）。

### Nginx 反代配置

如果 3001 已被占用，换个端口启动，然后用 Nginx 反代：

```nginx
upstream minesweeper {
    server 127.0.0.1:3002;   # 改成你实际启动的端口
}

server {
    listen 80;
    server_name your-domain.com;

    # WebSocket 需要 Upgrade 头
    location /ws {
        proxy_pass http://minesweeper;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # 其他请求走正常 HTTP
    location / {
        proxy_pass http://minesweeper;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
# 换个端口启动（比如 3002）
PORT=3002 npm start
# 或用 Docker
docker run -d --name minesweeper -p 3002:3001 minesweeper
```

### Railway / Render 等平台

这些平台支持 Node.js 项目，自动运行 `npm start`：

| 设置项 | 值 |
|--------|----|
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Port | 3001（或平台自动分配的 `PORT` 环境变量） |

### 手动部署到服务器

```bash
# 上传项目到服务器后
npm install
npm run build

# 换个端口启动
PORT=3002 npm start &

# 或使用 PM2
PORT=3002 pm2 start dist-server/server/index.js --name minesweeper
```

## 技术栈

- **前端**: React 18 + Vite + TypeScript + Zustand + Tailwind CSS
- **后端**: Node.js + WebSocket (`ws`)
- **通信协议**: JSON over WebSocket，服务端权威状态
