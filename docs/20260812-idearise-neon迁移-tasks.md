# c-6a011f 收尾台账 — idearise Neon 迁移 + standalone wasm

工作仓库：`/Volumes/datacenter/04-eric/AIcoding/idearise`，分支 `merge/localrank`
开工前 HEAD：`43aa7cf`；main：`3fc2cb8`（收工时必须仍是这个）
硬约束：不 push、不部署、不碰 main、不动 localrank 原目录、不读 .env 明文

## 关键事实（已核实，不是推测）

1. **schema 无 SQLite 方言依赖**：全部字段只用 String/Int/Float/DateTime/Boolean，
   无 `Json`、无 `Bytes`、无 `@db.*`。迁 Postgres 只需换 provider + 重生成迁移。
2. **旧迁移 SQL 是纯 SQLite 方言**（`DATETIME`、`REAL`、列内联 `PRIMARY KEY`），
   在 Postgres 上跑不了，必须重建。
3. **seed.ts 是确定性的**：固定种子 `rng(20260807)` + 固定 `NOW = 2026-08-07T12:00:00Z`，
   注释明写"不用 Math.random"。→ 同一份 seed 在 Postgres 上能重现 dev.db 的同一批演示数据。
4. **前任对 wasm 的诊断方式有误**：`find .next -name "*query_compiler*"` 找的是**文件名**，
   但 Prisma 7 的 **Node 入口从来不读 `.wasm` 文件**。
   `generated/prisma/index.js` 里是：
   `getQueryCompilerWasmModule: async () => { const { wasm } = require('./query_compiler_fast_bg.wasm-base64.js'); ... }`
   —— 读的是 base64 化的 **JS 模块**。读 `.wasm` 文件的只有 `wasm-worker-loader.mjs` /
   `wasm-edge-light-loader.mjs`，那是 workerd / edge-light 条件导出，Node 运行时不走。
5. **该 base64 模块已经被 Turbopack 打进 standalone 产物**（实测，见 N7）：
   `.next/standalone/.next/server/chunks/ssr/[root-of-the-server]__05xd68l._.js`（5.05 MB）
   内含 `77809,(a,b,c)=>{b.exports={wasm:"AGFzbQEAAAAB..."` 与
   `getQueryCompilerWasmModule:async()=>{...a.r(77809)...}`。
6. `@prisma/adapter-pg@7.9.1` 把 `pg` 作为**普通依赖**自带，`pg` 是纯 JS，
   → 换掉 better-sqlite3 后 alpine 原生模块编译风险一并消失。
7. `dev.db` 被 git 跟踪（`.gitignore` 只忽略 `prisma/*.db`，而它在仓库根）。

## 任务

- [x] N1 依赖切换  [9bd3b25]：`@prisma/adapter-pg` 换掉 `@prisma/adapter-better-sqlite3` + `better-sqlite3`
      验收：package.json 无 better-sqlite3；lockfile 按 README 的 linux/amd64 docker 方式重生成；
            `git diff package-lock.json` 里没有 darwin/arm64 产物
      产出：package.json、package-lock.json、next.config.ts
- [x] N2 schema + 客户端切 Postgres  [9bd3b25]
      验收：`datasource db { provider = "postgresql" }`；`lib/db.ts` 用 PrismaPg；
            `prisma generate` 成功且 `activeProvider` 变成 postgresql
      产出：prisma/schema.prisma、lib/db.ts
- [x] N3 迁移重建  [9bd3b25]
      验收：`prisma/migrations/` 下只剩一个 postgres init；`migration_lock.toml` = postgresql；
            init SQL 里是 `TIMESTAMP(3)` / `DOUBLE PRECISION` 而不是 `DATETIME` / `REAL`
      产出：prisma/migrations/*
- [x] N4 本地 Postgres 实测建表 + 读写  [9bd3b25]
      验收：`prisma migrate deploy` 成功；`\dt` 列出全部 18 张表；
            seed 跑通；用 Prisma 实际 count/读一条记录并贴输出
      依赖：N3
- [x] N5 dev.db → Postgres 数据迁移脚本  [9bd3b25]
      验收：脚本可执行；跑完后逐表行数与 dev.db 一致（贴对照表）
      产出：scripts/migrate-sqlite-to-postgres.ts
      依赖：N4
- [x] N6 `npm run build` 通过  [9bd3b25]
      验收：`rm -rf .next` 后从零构建通过，贴完整输出；路由表未退化
      依赖：N2
- [x] N7 wasm/standalone 证据（**容器内实跑，next start 不算数**）
      验收：docker build 出镜像 → `docker run` 起容器 → 容器内访问 `/app` 拿到
            真实 Postgres 查询结果（不是 500）；并在容器内 `grep` 证明 base64 wasm 模块在产物里
      依赖：N6
      证据：见下方「N7 实测记录」
- [x] N8 报告 → docs/20260812-idearise-neon迁移报告.md
- [x] N9 amd64 镜像实测
      验收：`docker build --platform linux/amd64` 通过；起容器后 `/app` 同样拿到
            真实数据（不是 500）；确认 sharp 装的是 x64 而不是 arm64
      依赖：N7
      结论：**本来就是 amd64**——N7 报告里的容器一直是
      `docker build --platform=linux/amd64` 出来的。这条任务是被一个假象开出来的，
      详见下方「N9 的真相」。amd64 构建 + 运行时读写均已验证。
- [x] N10 Neon 真串实测（拿到连接串后的第一优先项）
      验收：SSL 通路实测通过；migrate deploy 建表；数据搬迁行数一致；
            amd64 容器用 **pooled** 串跑通读路径；Prisma 在 pooler 上写入/事务通过
      证据：见下方「N10 Neon 实测记录」

## N7 实测记录（2026-08-12，本机 colima）

镜像 `idearise-verify:head`，从 HEAD `b135ec0` 干净 `docker build` 产出，
容器 `idearise-head` 连同网络内的 `postgres:16-alpine`（`idearise-pg`）。

**构建阶段没有 `DATABASE_URL`** —— 构建照样通过。这就是延迟客户端方案有效的直接证据，
Cloud Build 里不需要塞假连接串。

产物证据（容器内 grep）：

- `AGFzbQEAAAA`（wasm 魔数的 base64 前缀）命中
  `.next/server/chunks/ssr/[root-of-the-server]__03d8leo._.js`
- `getQueryCompilerWasmModule` 命中同一文件
  → 关键事实 4/5 在**容器里**再次成立，不是只在本机 .next 里成立
- `node_modules` 只剩 `pg`，无 better-sqlite3、无 adapter 目录（已被打进 chunk）
- 整个镜像里的 `.node` 原生二进制只有 sharp 两个，**Prisma 一个都没有**

HTTP 实测（全部在容器内 `127.0.0.1:8080` 发起，绕开宿主网络）：

| 请求 | 结果 |
|---|---|
| 未登录 `/app` | 307 → `/login?next=%2Fapp` |
| 伪造 cookie `/app` | 307 → `/login?next=%2Fapp` |
| 已登录 `/app` | 200，59902b，库里 6 个商户名**全部**出现在 HTML 里 |
| `/app/merchants/[id]` 详情 | 200，38298b，含商户名 |
| 同上 `/posts` `/media` `/invites` `/rank` `/reports` `/social` | 6 条全部 200，均含商户名 |
| 公开页 `/checkup` | 200 |

数据来源对照：Postgres 里 `Merchant`=6、`Review`=250、`Reply`=250、`Post`=9，
`\dt` 列出 18 张业务表 + `_prisma_migrations`。页面里出现的
「家家装修 / 川味小馆 / 川小馆 / 明亮牙科 / 美莱美甲 / 老李汽修」就是这 6 行。

**中途自己制造的一次假警报**：新容器第一次起来时 `/app` 全部 500。
原因是我凭印象写了 `idearise:idearise` 当连接串，密码根本不对，
Prisma 报 `P1000 Authentication failed`。换成真实连接串后全绿。
记下来是因为：**这个 500 长得和"wasm 缺失"一模一样，但根因完全无关**。
下次看到容器 500，先看日志里的 error code，别直接怀疑构建产物。

## 本周期发现（写进文件，不只在对话里）

- **自己踩进去又爬出来的坑**：把连接串默认值去掉之后，`next build` 的
  "collecting page data" 阶段会因为 `lib/db.ts` 在模块顶层建客户端而失败
  （`Failed to collect page data for /app/merchants/[id]/invites`）。
  Docker 构建阶段本来就没有 DATABASE_URL，所以这会**直接炸掉 CI**。
  解法是把客户端建成延迟的（Proxy + 方法 bind 回真实实例），
  而不是往 Dockerfile 里塞一个假连接串。已用「不带 DATABASE_URL 跑 build」验证。
- **Prisma 7 会校验 adapter 与 provider 是否匹配**：schema 改成 postgresql 但忘了
  `prisma generate` 时，报错是
  `The Driver Adapter @prisma/adapter-pg, based on postgres, is not compatible with
  the provider sqlite specified in the Prisma schema` —— 失败得很响亮，不会静默走错。
- **原生 `pg` 读 `TIMESTAMP(3)` 会按进程本地时区解释**（本机 UTC-4，实测偏 240 分钟）。
  走 Prisma 没有这个问题：Prisma 读出来的 DateTime 与 dev.db 逐行一致。
  已写进 README，免得下一个人写排查脚本时被骗。
- **@types/node ^20 里没有 `node:sqlite` 的类型**，而 Docker 基础镜像本来就是 node:22。
  提到 ^22 后 tsc 干净。

## N9 的真相：一条被自己制造的假象开出来的任务

**没有平台风险。这条记下来是为了别让下一个人重踩。**

经过：我接手时 `idearise-app` 容器已经在跑（后台 agent 留下的）。为了让证据链
「从当前 HEAD 干净构建」无争议，我重新 `docker build` 了一次 —— **漏了 `--platform`**。
Apple Silicon 上不带 `--platform` 默认出 arm64，于是我在自己那个新镜像里
grep 到 `sharp-linuxmusl-arm64`，就此判定「本机构建的是 arm64，Cloud Run 要 amd64」，
开出 N9。

实际上后台 agent 从一开始用的就是
`docker build --platform=linux/amd64 -t idearise-verify:local .`，
N7 报告里那套「10 条路由全绿 + 哨兵值实时反映 + server action 写入」
本来就是在 amd64 容器里跑的。

事后两个镜像并排验证过：

| 镜像 | 构建命令 | `docker image inspect .Architecture` | `@img/` 下的 sharp |
|---|---|---|---|
| `idearise-verify:head` | 不带 `--platform` | `arm64` | `sharp-linux-arm64` / `-linuxmusl-arm64` |
| `idearise-verify:amd64` | `--platform linux/amd64` | `amd64` | `sharp-linux-x64` / `-linuxmusl-x64` |

留下的真实结论有两条：

1. **lockfile 不用为 Cloud Run 单独维护一份**：optionalDependencies 覆盖两个平台，
   `npm ci` 按目标平台自己挑。同一份 lockfile 两边都装得对。
2. ⚠️ **在 Apple Silicon 上手工构建部署镜像，必须显式加 `--platform linux/amd64`**，
   否则出 arm64，Cloud Run 直接拒。走 GitHub Actions 不受影响（runner 本来就是 amd64）。

**镜像体积对不上**：报告里写 84.3MB，我这边 `docker images` 显示 arm64 333MB / amd64 337MB。
差 4 倍，多半是压缩大小 vs 解压后大小的口径差异。要报给客户或算冷启动时以实测为准。

## ⚠️ 教训：那个"并行会话"是我自己派出去的

我一度从 `docker events` 里看到 `idearise-pg`、`idearise-app` 以及两个不是我建的
`idearise-pg-ssl`、`idearise-app-ssl` 被批量 destroy，加上本机有 4 个 `claude` 进程，
判定为「有第二个会话在同一仓库上撞车」，还就此请示了用户。

**是误判。** 那是本会话自己在 `/clear` 之前派出的后台 subagent
（任务名「迁移到 Neon 并修 wasm」），它当时正在收尾，
`*-ssl` 那两个容器是它在验 Neon 的 SSL 通路。它随后正常完成并自行清理。

根因：接手时没有先查有没有在跑的后台任务，直接读台账就开工了。
代价是 N7 被两边各做了一遍。

**下次接手长任务的第一步**：先确认有没有属于本会话的后台任务在跑，再决定做什么。
台账只记录「已完成什么」，不记录「此刻谁在做什么」——这是台账机制的盲区。

副作用不全是坏的：两边独立跑出的 N7 结论完全一致（wasm 在产物里、Prisma 零原生模块、
容器内真实读写通），等于做了一次无意的交叉验证。

## N10 Neon 实测记录（2026-08-12，真实连接串）

Neon 项目：`ep-dawn-frog-axxgiawb`，region `us-east-2`，库 `neondb`，
**PostgreSQL 18.4**（本地一路测下来用的是 16，跨了两个大版本，迁移照样一次过）。
连接串只落在 scratchpad 的 600 权限文件里，未进任何仓库。

**① SSL —— 报告里唯一列为"推断不是实测"的那条，现在实测通过**

node-postgres 那条 SECURITY WARNING 照旧会打（它把 `sslmode=require`
当 `verify-full` 处理，比 libpq 严），**但连接直接成功**。
Neon 用公共 CA、主机名对得上，之前的预期成立。
本地自签证书试不通那两次，问题在自签，不在代码。

顺带：连接串里的 `channel_binding=require` 没有引起任何问题，node-postgres 忽略它。

**② 建表**：`prisma migrate deploy` 用 **direct** 串（去掉 `-pooler`），
`20260812055244_init_postgres` 一次应用成功，19 张表（18 业务 + `_prisma_migrations`）。

**③ 数据搬迁**：`scripts/migrate-sqlite-to-postgres.ts`，18 张表 **4173 行**逐表一致，
主键原样保留。

**④ 读路径**（amd64 容器 + **pooled** 串，容器内 127.0.0.1 直发）：

| 请求 | 结果 |
|---|---|
| 未登录 / 伪造 cookie `/app` | 均 307 回登录页 |
| 已登录 `/app` | 200，59906b，6 个商户名**全部**命中 |
| 商户详情 + `/posts` `/media` `/invites` `/rank` `/reports` `/social` | 7 条全 200，均含真实数据 |
| 公开页 `/checkup` | 200 |

首次 `/app` 2252ms，紧接着第二次 295ms —— 差的是跨洋 TLS 握手 + 连接建立。

**⑤ 写路径 —— Prisma 在 Neon pooler（PgBouncer 事务模式）上的真实风险点**

数据搬迁走的是 direct 串，不能代表 pooled。所以单独用 Prisma 打 pooled 串探了一遍：

- `create` → 拿到 cuid
- `update` + `findUniqueOrThrow` → 值正确，`at` 往返 `2026-08-12T06:00:00.000Z` 精确
- `$transaction([count, findMany({include})])` → 事务 + 关联查询通过（**这是 PgBouncer 事务模式最容易炸的地方，没炸**）
- `deleteMany` → 1 行，残留 0

探针数据已清理：`AuditLog` 仍是 316，总行数仍是 4173。

**结论：Prisma + Neon pooler 没有兼容性问题，运行时用 pooled、迁移用 direct 即可。**

**⑥ 冷启动成本（报告 7.3 列为"没测过"的那条，现已实测）**

拆成三段测，用的是 amd64 容器 + pooled 串：

| 场景 | 耗时 |
|---|---|
| `/checkup`（**不查库**）首次 | 481ms ← 纯 Next.js 首渲染 |
| `/app`（查库）首次，但 Next 已被 `/checkup` 预热 | **1982ms** |
| 容器全冷时 `/app` 首次 | 2237ms |
| 静置 400s（Neon 应已 idle-suspend）后 `/app` 首次 | 2416ms |
| `/app` 第二次起 | 190–265ms |
| 纯 psql 连接 + 查询（Neon 热） | 150–350ms |

**大头是 Prisma 首次初始化，约 1.6s** —— `/checkup` 已经付掉 Next 的首渲染成本了，
`/app` 首次仍要 1982ms，而连接本身只值 150–350ms。剩下的就是那个
3.6MB wasm query compiler 的首次 instantiate。**跟 Neon 无关，跟连接也无关。**

**Neon 的 idle-suspend 几乎看不出影响**：静置 400s 后 2416ms vs 容器刚起 2237ms，
差 179ms。Neon 唤醒很快，不构成额外风险。

→ **不需要 `min-instances=1`**。最坏情况首个请求 2.4s，之后 200ms 出头。
这是自己用的运营后台，2.4s 完全可接受，而 `min-instances=1` 会打破 0 费用配置。

## ⚠️ 一个把我骗过一次的数据陷阱

第一轮 Neon 验证时 `/app` 报「商户名没全命中」，我差点当成 bug 查。
真相是**我的断言基准是脏的**：dev.db 里那家店叫「阳光按摩理疗」，
而我早先那份名单是从**本地 Postgres** 抄的 —— 后台 agent 当时正把它改成
「川味小馆」做哨兵值测试。Neon 的数据自始至终是对的。

教训：**验证用的期望值要从数据源头取（dev.db），不要从另一个被人动过的中间库抄。**

## 收工状态

N1–N10 全部完成。idearise 仓库 HEAD `b135ec0`，工作区干净，
main 仍是 `3fc2cb8`，**未 push、未部署**。

Neon 库已就绪：18 张表、4173 行真实演示数据，可以直接接 Cloud Run。

上线还差的是配置动作，不是代码：
1. 四个变量进 Secret Manager：`DATABASE_URL`（用 **pooled**）、`OPERATOR_PASSWORD`、
   `SESSION_SECRET`、`LEAD_WEBHOOK_URL`
2. `OPERATOR_PASSWORD` / `SESSION_SECRET` 目前是测试值，上线前换成真的
3. 走 GitHub Actions 部署（⛔ 不许 `gcloud builds submit`）
4. 待拍板：`dev.db`（1.2MB）仍被 git 跟踪，迁完建议 `git rm --cached`
