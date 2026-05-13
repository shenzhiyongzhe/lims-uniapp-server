# Docker 与 GitHub Actions 部署说明

目标：在域名（例如 `www.xinde8888.com`）后通过 Nginx 反代本 API，容器内监听 `3000`，宿主机 `127.0.0.1:3000`。

## 1. 服务器准备

- 安装 Docker 与 Docker Compose 插件（`docker compose`）。
- 克隆或同步本仓库到服务器；至少包含 `Dockerfile`、`docker-compose.prod.yml`。
- 在部署目录（例如 `/opt/lims-uniapp-server`）放置：

  - `docker-compose.prod.yml`（来自本仓库）
  - `.env`（参考仓库根目录 `.env.example`，**勿提交真实密钥**）

`.env` 中请将 `DATABASE_URL` 指向你的 MySQL（云 RDS 或自建）；`NEXT_PUBLIC_API_BASE` 设为对外 HTTPS 地址，例如 `https://www.xinde8888.com`。

## 2. 数据库

当前仓库未包含 `prisma/migrations` 时，需在具备 `DATABASE_URL` 的环境执行一次结构同步（任选其一，按团队规范）：

- 开发机：`npx prisma db push`（仅适合初次/非严格迁移场景），或
- 生成迁移后再在生产执行 `npx prisma migrate deploy`。

生产数据请自行备份。

## 3. Nginx

参考 `deploy/nginx-api.conf.example`，将 HTTP/HTTPS 请求反代到 `http://127.0.0.1:3000`。证书可使用 Certbot。上传目录通过 API 写在容器内 `/app/uploads`，已由命名卷持久化。

## 4. GitHub Actions

工作流文件：`.github/workflows/deploy-lims-server.yml`（相对**当前服务端仓库**根目录）。假定远程仓库根目录即为本后端项目；构建上下文默认为 `.`（变量 `DOCKER_CONTEXT` 可覆盖为 monorepo 子目录路径）。

**Secrets**（Settings → Secrets and variables → Actions）：

| 名称 | 说明 |
|------|------|
| `DEPLOY_HOST` | 服务器主机名或 IP |
| `DEPLOY_USER` | SSH 用户（需能执行 `docker` / `docker compose`） |
| `DEPLOY_SSH_PASSWORD` | SSH **密码**登录（已不使用密钥） |
| `DEPLOY_PATH` | 服务器上包含 `docker-compose.prod.yml` 与 `.env` 的绝对路径 |

推送至 `main` / `master` 且变更 `src/`、`prisma/`、`Dockerfile`、`package.json` 等时会构建镜像并推送至  
`ghcr.io/<小写 owner>/lims-uniapp-server`（`:latest` 与 `:<git-sha>`），随后 SSH 登录服务器执行 `docker compose -f docker-compose.prod.yml pull` 与 `up -d`。

**若镜像为私有仓库**：在服务器执行一次 `docker login ghcr.io`（使用 GitHub 用户名 + 具有 `read:packages` 的 PAT）。

**Monorepo**：将工作流放在**整个 monorepo 仓库根**的 `.github/workflows/` 下，并把 Variables 里 `DOCKER_CONTEXT` 设为服务端子目录名（例如 `lims-uniapp-server`）。

## 5. 本地验证镜像

```bash
cd lims-uniapp-server
docker compose build
docker compose up -d
```

访问 `http://127.0.0.1:3000/` 应返回接口根响应（需配置有效 `.env` 与数据库）。
