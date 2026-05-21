# MySQL 迁移历史（已归档）

此目录为切换 PostgreSQL 前的 Prisma MySQL 迁移，**勿**对 PostgreSQL 库执行 `migrate deploy`。

当前有效迁移见 `prisma/migrations/`（`provider = postgresql`）。

数据从 MySQL 迁入 PostgreSQL 请使用 `deploy/postgresql/` 下脚本。
