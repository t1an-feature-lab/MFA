# Monorepo

基于 pnpm workspace 的全栈项目模板，前后端均使用 TypeScript。

```text
apps/
  web/       Vite + React + Tailwind CSS + Primer React
  server/    Hono + PostgreSQL
compose.yaml PostgreSQL 本地开发环境
```

## 环境要求

- Node.js 24 或更高版本
- pnpm 10.33.2
- Docker 与 Docker Compose

## 开始开发

```sh
pnpm install
cp .env.example .env
pnpm db:up
pnpm dev
```

前端默认地址为 `http://localhost:5173`，服务端为 `http://localhost:3000`。
前端开发环境将 `/api` 代理到服务端，`GET /api/health` 会检查数据库连接。

`.env` 中的数据库账号与密码用于本地开发。修改数据库账号、数据库名或端口后，
同步更新 `DATABASE_URL`。PostgreSQL 使用命名卷保存数据，`pnpm db:down` 会保留数据。
数据库账号与密码在数据卷首次初始化时生效，已有数据卷需通过 SQL 修改。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 同时启动 web 与 server |
| `pnpm --filter web dev` | 单独启动前端 |
| `pnpm --filter server dev` | 单独启动服务端 |
| `pnpm typecheck` | 检查全部 TypeScript 类型 |
| `pnpm build` | 编译前后端，分别输出到各自的 dist 目录 |
| `pnpm --filter server start` | 启动编译后的服务端 |
| `pnpm db:up` | 启动 PostgreSQL 并等待健康检查通过 |
| `pnpm db:down` | 停止数据库 |
| `pnpm db:logs` | 查看数据库日志 |

## 样式与组件

组件使用 [Primer React](https://primer.style/product/getting-started/react/)，
主题由 Primer 的 CSS 变量提供，Tailwind CSS 负责布局与工具类。
Tailwind 按[官方方式](https://tailwindcss.com/docs/preflight#disabling-preflight)单独导入 theme 和 utilities，
由 Primer 统一管理组件基础样式。

## 部署

前端静态文件位于 `apps/web/dist`，服务端入口为 `apps/server/dist/index.js`。
部署时配置 `DATABASE_URL`，并将前端站点的 `/api` 请求反向代理到 server。
