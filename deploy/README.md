# Docker 与 GitHub Actions 部署说明

目标：在域名（例如 `www.xinde8888.com`）后通过 Nginx 反代本 API，容器内监听 `3000`，宿主机 `127.0.0.1:3000`。

## 1. 服务器准备

- 安装 Docker 与 Docker Compose 插件（`docker compose`）。
- 克隆或同步本仓库到服务器；至少包含 `Dockerfile`、`docker-compose.prod.yml`。
- 在部署目录（例如 `/opt/lims-uniapp-server`）放置：

  - `docker-compose.prod.yml`（来自本仓库）
  - `.env`（参考仓库根目录 `.env.example`，**勿提交真实密钥**）

`.env` 中请将 `DATABASE_URL` 指向你的 MySQL（云 RDS 或自建）；`NEXT_PUBLIC_API_BASE` 设为对外 HTTPS 地址，例如 `https://www.xinde8888.com`。

**Docker 里 Prisma 报 `Can't reach database server at localhost:3306`（P1001）**  
容器里的 `localhost` 是容器自己，不是宿主机。请把 **`DATABASE_URL` 里的主机**改成：

| 场景 | `DATABASE_URL` 里主机应写 |
|------|---------------------------|
| MySQL 与 API 同一 `docker compose`，且服务名为 `mysql` | `mysql`（推荐用 `docker compose -f docker-compose.yml -f docker-compose.mysql.yml up -d`，compose 会注入带 `mysql` 的 URL） |
| MySQL 跑在**宿主机**、且监听 **`0.0.0.0:3306`**（或 docker 网桥可达的网卡） | **`host.docker.internal`**（本仓库 compose 已配 `extra_hosts`） |
| MySQL 跑在宿主机、**仅监听 127.0.0.1** | 先改 MySQL `bind-address=0.0.0.0` 再用上一行；**或**单用 **`docker-compose.prod.hostnetwork.yml`** + `DATABASE_URL` 里 **`127.0.0.1:3306`** |
| 云 RDS / 远程库 | RDS 提供的主机名 |
| 未用本仓库 compose、无 `extra_hosts` | Linux 常用 **`172.17.0.1`**（默认 bridge 网关）或宿主机内网 IP |

改完 `.env` 后执行 `docker compose up -d`（或 `pull` + `up`）使 API 容器重新加载环境变量。

**宿主机 MySQL 仍连不上时**：先确认 MySQL 监听地址：

- 若 `bind-address` / `skip-networking` 导致 **只监听 `127.0.0.1:3306`**，从 Docker 网桥访问 `host.docker.internal` / `172.17.0.1` **往往仍连不上**（连的不是回环口上的 mysqld）。任选其一：
  - **推荐（改 MySQL）**：把 `bind-address` 设为 **`0.0.0.0`**（或注释掉），放行防火墙后仍用 `DATABASE_URL=@host.docker.internal:3306`；
  - **不改 MySQL**：改用 **`docker-compose.prod.hostnetwork.yml`**（API 使用 `network_mode: host`），`.env` 里 **`DATABASE_URL` 使用 `@127.0.0.1:3306`**，且**不要**与带 `ports` 的 `docker-compose.prod.yml` 叠在同一 `api` 上。示例：  
    `DOCKER_IMAGE=ghcr.io/你的镜像:tag docker compose -f docker-compose.prod.hostnetwork.yml up -d`

其它排查：`docker compose` 是否已更新到含 `extra_hosts: host.docker.internal:host-gateway` 的版本；宿主机 `ss -tlnp | grep 3306`；容器内 `getent hosts host.docker.internal` 是否有 IP。

## 2. 数据库

当前仓库未包含 `prisma/migrations` 时，需在具备 `DATABASE_URL` 的环境执行一次结构同步（任选其一，按团队规范）：

- 开发机：`npx prisma db push`（仅适合初次/非严格迁移场景），或
- 生成迁移后再在生产执行 `npx prisma migrate deploy`。

生产数据请自行备份。

## 3. Nginx

参考 `deploy/nginx-api.conf.example`，将 HTTP/HTTPS 请求反代到 `http://127.0.0.1:3000`。证书可使用 Certbot。上传目录通过 API 写在容器内 `/app/uploads`，已由命名卷持久化。

## 4. GitHub Actions

工作流文件：`.github/workflows/deploy-lims-server.yml`（相对**当前服务端仓库**根目录）。假定远程仓库根目录即为本后端项目；构建上下文默认为 `.`（变量 `DOCKER_CONTEXT` 可覆盖为 monorepo 子目录路径）。

**Variables**（Settings → Secrets and variables → Actions → **Variables**）— 用于 SSH 地址与路径，且便于在工作流 `if` 中判断是否执行 deploy：

| 名称 | 说明 |
|------|------|
| `DEPLOY_HOST` | 服务器主机名或 IP（**必填**才会执行 deploy；未设置则只构建推送镜像） |
| `DEPLOY_USER` | SSH 用户（需能执行 `docker` / `docker compose`） |
| `DEPLOY_PATH` | 服务器上包含 `docker-compose.prod.yml` 与 `.env` 的绝对路径 |

**Secrets**（仅敏感项）：

| 名称 | 说明 |
|------|------|
| `DEPLOY_SSH_PASSWORD` | SSH 密码 |

若曾把 `DEPLOY_HOST` 建在 **Secrets** 里，`host` 在部分情况下不会参与 `if` 判断，且漏配时会报 `missing server host`；请改用上表 **Variables** 填写 `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_PATH`。

推送至 `main` / `master` 且变更 `src/`、`prisma/`、`Dockerfile`、`package.json` 等时会构建镜像并推送至  
`ghcr.io/<小写 owner>/lims-uniapp-server`（`:latest` 与 `:<git-sha>`）。若已配置 Variable **`DEPLOY_HOST`**，则会继续 SSH 到服务器执行 `pull` → `prisma migrate deploy` → `up -d`；否则仅完成镜像推送。

**CI / Drone 迁移报 `Can't reach database server at host.docker.internal:3306`（P1001）**  
多为宿主机 MySQL **只监听 `127.0.0.1`**。`deploy/remote-deploy.sh` 在检测到 `.env` 里 `DATABASE_URL` 使用 `host.docker.internal` 时，会对 **migrate** 自动改用 `--network host` 并把主机改为 `127.0.0.1`。GitHub Actions 与 Drone 的 SSH 步骤均应调用该脚本（示例：`cd "${DEPLOY_PATH}" && export DOCKER_IMAGE=... && bash deploy/remote-deploy.sh`）。若 **长期运行的 API** 仍连不上库，请任选其一：

1. MySQL `bind-address=0.0.0.0`，继续用 `docker-compose.prod.yml` + `host.docker.internal`；或  
2. `.env` 中 `DATABASE_URL` 改为 `@127.0.0.1:3306`，日常用 `docker-compose.prod.hostnetwork.yml` 启动 API。

**若镜像为私有仓库**：在服务器执行一次 `docker login ghcr.io`（使用 GitHub 用户名 + 具有 `read:packages` 的 PAT）。

**Monorepo**：将工作流放在**整个 monorepo 仓库根**的 `.github/workflows/` 下，并把 Variables 里 `DOCKER_CONTEXT` 设为服务端子目录名（例如 `lims-uniapp-server`）。

## 5. 本地验证镜像

```bash
cd lims-uniapp-server
docker compose build
docker compose up -d
```

访问 `http://127.0.0.1:3000/` 应返回接口根响应（需配置有效 `.env` 与数据库）。
