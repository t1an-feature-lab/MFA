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
# 按下文生成密钥并填写 .env 中的 PASSWORD_ENCRYPTION_KEY
pnpm db:up
pnpm dev
```

前端默认地址为 `http://localhost:5173`，服务端为 `http://[::1]:3100`。
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

## 登录与鉴权

- `/login` 使用统一的账号、密码表单，账号支持 11 位中国大陆手机号或 `admin`，登录后跳转 `/permissions` 后台。
- 新手机号首次登录时创建用户并保存密码哈希；已有账户必须通过密码校验，登录不会更改已保存的密码。
- 内置管理员账号为 `admin`，初始密码为 `admin`，权限固定；修改密码后，重启不会重置密码。
- 服务端启动时自动创建 `users`、`sessions` 表、添加密码字段并初始化管理员。
- 密码使用随机盐和 scrypt 哈希校验，并使用 AES-256-GCM 加密保存一份展示副本。已登录账户可在权限列表查看明文密码，登录与会话接口不返回密码。
- 会话保存在 PostgreSQL，通过有效期为 7 天的 HttpOnly、SameSite=Lax Cookie 识别；退出时撤销。
- 前端加载页面、重新获得焦点时检查登录状态，未登录会跳转 `/login`；已登录访问 `/login` 会跳转首页。
- 新手机号默认为“仅查看”；管理员可修改其他手机号账户的权限，不能修改内置 `admin` 的权限。服务端每次请求读取最新角色，仅查看账户不能写入业务数据，可修改自己的密码。
- 修改密码需校验当前密码，成功后保留当前会话并撤销该账户的其他会话。

| 接口 | 请求 | 用途 |
| --- | --- | --- |
| `POST /api/auth/login` | `{ "account": "13800138000", "password": "your-password" }` 或 `{ "account": "admin", "password": "admin" }` | 登录；新手机号自动创建用户 |
| `GET /api/auth/me` | — | 获取当前用户，未登录返回 401 |
| `POST /api/auth/logout` | — | 撤销会话并清除 Cookie |
| `POST /api/auth/password` | `{ "currentPassword": "old-password", "newPassword": "new-password" }` | 修改当前账户密码 |
| `GET /api/users` | — | 获取用户手机号、明文密码及当前权限 |
| `PATCH /api/users/:id/role` | `{ "role": "admin" }` 或 `{ "role": "user" }` | 管理员切换账户为管理员或仅查看 |
| `GET /api/orders` | — | 获取订单及商品、支付、收货和物流明细 |
| `GET /api/orders/export` | — | 导出全部订单为 Excel 文件，需登录 |

新增 `/api/*` 接口默认需要登录，处理函数通过 `c.get('user')` 获取当前用户。
公开入口在 `apps/server/src/app.ts` 的鉴权中间件中列出。开发代理保留原始 Host，配合后端的同源请求校验。

尚未设置密码的历史手机号账户需先完成密码设置，否则返回 409，原有用户与数据保留。
本地开发默认管理员密码为 `admin`。部署前需更换管理员凭据并验证注册手机号归属；
生产环境使用 HTTPS，设置 `NODE_ENV=production` 启用 Secure Cookie。前端使用 BrowserRouter 路径路由，部署时需将 `/permissions`、`/orders`、`/security/*`、`/login` 等页面请求回退到 `index.html`，`/api/*` 继续代理到后端。

## 后台界面

- 侧边栏提供 `/permissions` 权限列表、`/orders` 订单数据，均使用 Primer DataTable 展示数据库记录；访问 `/` 默认进入权限列表。
- 权限操作使用 Primer Select；仅查看账户的操作和内置 `admin` 行的操作禁用。已登录账户可在密码列查看明文密码。
- 历史账户只有不可还原的密码哈希，再次成功登录或修改密码时补充加密副本，随后可在权限列表中显示。
- 底部头像菜单进入修改密码（`/security/password`）、双重身份验证（`/security/mfa`），也可以退出登录。
- 修改密码调用真实接口；Passkey 与身份验证器应用（TOTP）仍为前端交互预览，仅使用当前页面的本地状态。身份验证器绑定使用六位 OTP 输入组件，支持粘贴及验证码自动填充。
- 移动端通过菜单按钮打开 Primer Dialog 导航抽屉。

## 订单数据

- 数据库初始化时创建订单表并写入 100 条模拟订单，使用固定的 `MOCK` 订单号避免重复插入，重新启动不会覆盖已有记录。
- 模拟数据包含客户联系方式、商品与规格、整数分金额、支付方式、收货地址、物流信息、备注及订单各阶段时间，覆盖六种订单状态。
- 订单页面每页展示 20 条，呈现订单、客户、商品、金额、状态及支付来源；仅查看账户也可读取和导出订单。
- “导出 Excel”下载真实 `.xlsx` 文件，包含“订单明细”和“商品明细”两张表，金额以元展示，时间统一为北京时间。表头支持筛选并冻结，手机号及订单号保留为文本。

## 部署

前端静态文件位于 `apps/web/dist`，服务端入口为 `apps/server/dist/index.js`。
部署时配置 `DATABASE_URL`，并将前端站点的 `/api` 请求反向代理到 server。
`PASSWORD_ENCRYPTION_KEY` 为用于密码展示副本的 32 字节密钥，以 64 位十六进制填写；可使用
`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` 生成。
密钥需与数据库分开保存并妥善备份，丢失或直接替换密钥会导致已有副本无法解密。
