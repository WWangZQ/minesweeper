# 部署到真实服务器

CI（`.cnb.yml`）每次 push 到 `main` 都会构建镜像并推送到 CNB 制品库：
`docker.cnb.cool/wl_11111010110/minesweeper:latest`。
服务器上**不需要 node、不用编译**，直接拉镜像跑即可。

## 前置

- 一台装好 **Docker** + **Docker Compose** 的 Linux 服务器
- 一个 CNB **访问令牌**（读制品库权限即可）
- 可选：域名 + Nginx（对外加 TLS）

## 步骤

### 1. 登录 CNB 制品库（私有仓库需要）

```bash
docker login docker.cnb.cool -u cnb -p <你的访问令牌>
```

### 2. 拉取并启动

```bash
# 把仓库的 deploy/ 目录拷到服务器，或只拷 docker-compose.yml
docker compose -f deploy/docker-compose.yml pull
docker compose -f deploy/docker-compose.yml up -d
```

容器监听 `127.0.0.1:3001`。验证：

```bash
curl -I http://127.0.0.1:3001        # 应返回 200
docker compose -f deploy/docker-compose.yml logs -f
```

### 3. Nginx 反代 + 域名（对外暴露）

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/minesweeper
sudo ln -s /etc/nginx/sites-available/minesweeper /etc/nginx/sites-enabled/
# 编辑文件把 server_name 改成你的域名
sudo nginx -t && sudo systemctl reload nginx
```

### 4. 开启 HTTPS

```bash
sudo certbot --nginx -d your-domain.com
```

完成后访问 `https://your-domain.com` 即可，前端会自动用 `wss://` 连 WebSocket。

## 更新到新版本

push 新代码 → CI 自动出新 `:latest` 镜像 → 服务器上：

```bash
docker compose -f deploy/docker-compose.yml pull
docker compose -f deploy/docker-compose.yml up -d   # 滚动替换为新镜像
```

> 想要可回滚，建议给镜像打版本 tag（如按 commit），而不是只用 `:latest`。需要的话我可以把 `.cnb.yml` 改成同时推 `:latest` 和 `:<commit>` 两个 tag。

## 不想用 Nginx？

把 `deploy/docker-compose.yml` 里的 `127.0.0.1:3001:3001` 改成 `3001:3001`，
直接用 `http://服务器IP:3001` 访问（无 TLS，WebSocket 走 `ws://`）。
