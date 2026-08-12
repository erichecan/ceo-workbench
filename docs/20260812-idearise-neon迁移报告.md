# idearise：Neon 迁移 + standalone wasm 收尾报告

看板任务 c-6a011f｜2026-08-12｜承接 `20260812-idearise-localrank合并报告.md` 第 5.2、5.3 节

| 项 | 值 |
|---|---|
| 工作仓库 | `/Volumes/datacenter/04-eric/AIcoding/idearise` |
| 分支 | `merge/localrank`（**未 push，未部署，未碰 main**） |
| 开工前 HEAD | `43aa7cf` → 收工 HEAD `b135ec0`（本次 2 个 commit） |
| main | `3fc2cb8`，与开工前一致，未改动 |
| `npm run build` | **通过**（第 5 节贴完整输出） |
| localrank 原目录 | 未动，工作区干净，HEAD 仍 `ffdb2aa` |

**两个阻塞项的结论先写在前面：**

1. **数据库已迁到 Postgres**，在本地 Postgres 16 上实测建表、读、写、事务全通，
   演示数据两条迁移路径都跑通并逐行比对过。**只差一个真实 Neon 连接串**。
2. **wasm 不是阻塞项 —— 前一轮的诊断机制是错的。** wasm 一直就在构建产物里，
   只是以 base64 JS 模块的形式，`find -name "*.wasm"` 天然找不到它。
   已在 linux/amd64 容器里实跑证明读写都正常。**不需要改 Dockerfile，
   也不需要 `outputFileTracingIncludes`。**

**本次自己踩出来一个真实的新问题并修掉了**：去掉连接串默认值后，
`next build` 会在 "collecting page data" 阶段失败 —— 这会直接炸掉 CI。详见第 2.3 节。

---

## 1. schema 与 migration 的改动

### 1.1 schema：业务字段一行没改

原作者在注释里承诺过「字段类型均已避开方言特性」，核对下来属实 ——
全部字段只用 `String / Int / Float / DateTime / Boolean`，没有 `Json`、没有 `Bytes`、
没有任何 `@db.*` 原生类型标注。所以改动只有 provider 一行：

```diff
-// 演示阶段用 SQLite：零基建，本地就能把流程点通。
-// 上线换 Postgres 只需改 provider 并重新生成迁移（字段类型均已避开方言特性）。
+// Postgres（生产用 Neon）。字段类型只用 String/Int/Float/DateTime/Boolean，
+// 不碰任何方言特性，所以从早期的 SQLite 演示库换过来时 schema 一行未改，只换了 provider。
 generator client { ... }

 datasource db {
-  provider = "sqlite"
+  provider = "postgresql"
 }
```

18 个模型、全部索引与唯一约束原样保留。

### 1.2 迁移：必须重建，不能沿用

旧的 7 个迁移是**纯 SQLite 方言**，在 Postgres 上根本跑不了：

```sql
-- 旧（SQLite）
"rating"      REAL     NOT NULL DEFAULT 0,
"onboardedAt" DATETIME NOT NULL,
"id"          TEXT     NOT NULL PRIMARY KEY,        -- 列内联主键
```

删掉重生成为单个 `20260812055244_init_postgres`：

```sql
-- 新（Postgres）
"rating"      DOUBLE PRECISION NOT NULL DEFAULT 0,
"onboardedAt" TIMESTAMP(3)     NOT NULL,
"id"          TEXT             NOT NULL,
CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")        -- 独立约束
```

`prisma/migrations/migration_lock.toml` 也从 `provider = "sqlite"` 改成 `postgresql`。

方言核查（对整个 init SQL）：`TIMESTAMP(3)` 出现 29 次，`DOUBLE PRECISION` 3 次，
`DATETIME` / `REAL` **0 次**。

> **注意**：删掉旧迁移是安全的，因为**没有任何环境跑过这些迁移**（生产库还不存在）。
> 如果哪天已经有生产 Postgres 了，就不能再这么干。

### 1.3 客户端与依赖

| 项 | 改动 |
|---|---|
| adapter | `@prisma/adapter-better-sqlite3` → `@prisma/adapter-pg` |
| 移除 | `better-sqlite3`（原生模块） |
| `next.config.ts` | 删掉 `serverExternalPackages: ["better-sqlite3"]`（没有原生模块了） |
| `@types/node` | `^20` → `^22`（`node:sqlite` 的类型在 20 里没有；镜像本来就是 node:22） |
| 锁文件 | 按 README 的 linux/amd64 Docker 方式重生成，**没有跑本地 `npm install`** |

**顺带解掉一个部署隐患**：前一轮报告担心 `better-sqlite3` 在 `node:22-alpine`（musl）
上装不上，需要 `apk add python3 make g++`。换成 `pg` 之后这个风险直接消失 ——
`@prisma/adapter-pg@7.9.1` 把 `pg` 作为普通依赖自带，`pg` 是纯 JS。
锁文件里 `prebuild-install`、`node-abi`、`tar-fs`、`bindings` 等一整串原生编译工具链
全部消失（681 → 659 个包）。

Docker 镜像实际构建结果：`npm ci` 在 linux/amd64 alpine 上一次通过，镜像 **84.3MB**。

---

## 2. 数据库连接的处理

### 2.1 连接串只从环境变量来

```ts
// lib/db.ts
function create() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL 未配置。Postgres 连接串必须由环境变量注入，代码里没有默认值。");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: 5 }),
  });
}
```

原来 SQLite 版有 `?? "file:./prisma/dev.db"` 兜底，现在**故意不给默认值** ——
Postgres 场景下的兜底只会让配错的环境静默连到错误的库。

连接池 `max: 5`：Cloud Run 每个实例是独立进程，并发靠横向扩实例，
不靠单进程堆连接。池子开大了会顶爆 Neon 的连接上限。
（实测证据见 3.4：服务端确实看到 5 条连接。）

### 2.2 全程没有读取或打印任何 `.env` / 密钥

仓库里**根本没有 `.env` 文件**（只有 `.env.example`）。
本次所有验证用的连接串和口令都是命令行临时传入的本地测试值，
用完即弃，没有写进任何文件，没有进 git。

### 2.3 ⚠️ 我自己踩出来又修掉的坑：去掉默认值会炸掉 CI 构建

**这是本次最有价值的一个发现，如果不修，push 上去 GitHub Actions 会直接失败。**

去掉连接串默认值之后，`next build` 报：

```
Collecting page data using 9 workers ...
Error: Failed to collect configuration for /app/merchants/[id]/invites
  [cause]: Error: DATABASE_URL 未配置。Postgres 连接串必须由环境变量注入，代码里没有默认值。
      at lib/db.ts:10:11
> Build error occurred
Error: Failed to collect page data for /app/merchants/[id]/invites
```

原因：`next build` 的 "collecting page data" 阶段会**求值每一个路由模块**，
而 `lib/db.ts` 在模块顶层就 `export const db = create()`。
Docker 构建阶段没有 `DATABASE_URL`（也**不该**有 —— 构建产物里不能带连接串）。

SQLite 版之所以没暴露这个问题，纯粹是因为它有 `file:./prisma/dev.db` 兜底。

**修法：把客户端建成延迟的，而不是往 Dockerfile 里塞一个假连接串。**

```ts
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    cached ??= client();
    const value = Reflect.get(cached, prop, cached);
    // 方法必须绑回真实客户端，否则 this 会指向这个空壳 target
    return typeof value === "function" ? value.bind(cached) : value;
  },
});
```

构建期不需要数据库，就不该在那时候要连接串。
`value.bind(cached)` 那一行是必需的 —— 少了它 `db.$transaction()` 的 `this` 会指向空壳。

**验证**（不是"应该可以"）：
- `env -u DATABASE_URL npm run build` → 通过
- `npm run seed` 通过（seed 会经 `lib/service/*` 打到 9 处 `db.$transaction([...])`）
- 容器里读、写、事务全部实跑通过（第 3 节）

---

## 3. wasm 问题的解法与证据

### 3.1 结论：不是缺陷，不需要任何改动

前一轮的判据是：

```
$ find .next -name "*query_compiler*"
（无输出）   ← 判成"没进构建产物"
```

**这个判据本身是错的。Prisma 7 的 Node 入口从来不读 `.wasm` 文件。**

`generated/prisma/index.js` 里实际写的是：

```js
config.compilerWasm = {
  getRuntime: async () => require('./query_compiler_fast_bg.js'),
  getQueryCompilerWasmModule: async () => {
    const { Buffer } = require('node:buffer')
    const { wasm } = require('./query_compiler_fast_bg.wasm-base64.js')   // ← 读的是 JS
    return new WebAssembly.Module(Buffer.from(wasm, 'base64'))
  },
  importName: './query_compiler_fast_bg.js',
}
```

读 `.wasm` **文件**的只有 `wasm-worker-loader.mjs` 和 `wasm-edge-light-loader.mjs`，
而它们挂在 `generated/prisma/package.json` 的 `#wasm-compiler-loader` 条件导出下，
只对 `workerd` / `edge-light` 生效。Node 运行时走不到那条路。

所以 `.wasm` 文件不进 `.next` 是**设计如此**，不是 trace 漏了。

### 3.2 证据一：产物里确实有它，且字节级一致

```
chunk: .next/standalone/.next/server/chunks/ssr/[root-of-the-server]__03d8leo._.js
chunk 大小: 5,238,778 字节
模块 id: 77809
   → 77809,(a,b,c)=>{b.exports={wasm:"AGFzbQEAAAAB..."}}
base64 长度: 4,903,632
解出的字节数: 3,677,723
魔数: b'\x00asm' → 合法 wasm
sha256:            c9f94b7945f5681a74403e9148cf67434462cccea6035d2ee29ad593f5f74a25
源码侧 .wasm sha256: c9f94b7945f5681a74403e9148cf67434462cccea6035d2ee29ad593f5f74a25
两者一致: True
```

调用点也在同一个 chunk 里：
`getQueryCompilerWasmModule:async()=>{...{wasm:c}=a.r(77809)...}` —— `a.r(77809)` 就是上面那个模块。

正确的核查命令是**查内容不查文件名**：

```bash
grep -rl "query_compiler_fast_bg" .next/standalone --include="*.js"
```

### 3.3 证据二：linux/amd64 容器里实跑（`next start` 一次都没用）

按硬约束，`next start` 通过不算数。所以是真的 `docker build` + `docker run`：

```bash
docker build --platform=linux/amd64 -t idearise-verify:local .      # → 84.3MB
docker run -d --network idearise-net --platform=linux/amd64 -p 8390:8080 \
  -e DATABASE_URL=... -e OPERATOR_PASSWORD=... -e SESSION_SECRET=... idearise-verify:local
```

**容器文件系统里没有任何 `.wasm` 文件：**

```
$ docker exec idearise-app sh -c 'find / -name "*query_compiler*.wasm" 2>/dev/null'
（无输出）

$ docker exec idearise-app sh -c 'grep -rl "query_compiler_fast_bg" /app/.next/server/chunks/ssr/'
/app/.next/server/chunks/ssr/[root-of-the-server]__03d8leo._.js
```

**而查询全部正常：**

| 路径 | 状态 | 说明 |
|---|---|---|
| `/` | 200 | 品牌站中文 |
| `/en` | 200 | 品牌站英文 |
| `/checkup` | 200 | 自评问卷 |
| `/app`（无 cookie） | 307 → `/login?next=%2Fapp` | 鉴权仍在 |
| `/app`（带 cookie） | 200 | 标题「运营后台 · Google 门面管家」，渲染出 Postgres 里的商家 |
| `/app/merchants/<id>` | 200 | |
| `/app/merchants/<id>/rank` | 200 | 网格热力图，读 ScanPoint 2352 行 |
| `/app/merchants/<id>/social` | 200 | |
| `/app/reports/<id>` | 200 | 月报 |
| `/api/lead`（GET） | 405 | POST-only，路由可达 |

容器日志里 `grep -i "prisma\|wasm\|compiler\|ENOENT"` → 无输出。

### 3.4 证据三：证明是**实时查库**而不是构建期烤进去的

光看 200 不够 —— 万一页面是构建期预渲染的呢。所以直接改库再看：

```
$ docker exec idearise-pg psql -c "UPDATE \"Merchant\" SET name='CONTAINER-DB-PROOF-1786514581' WHERE ..."
cmsl051iv0000sfylnzr6penn|CONTAINER-DB-PROOF-1786514581
UPDATE 1

$ curl -H "Cookie: lr_session=..." http://localhost:8390/app | grep -c "CONTAINER-DB-PROOF-1786514581"
页面里出现的次数: 1        ← 容器重新渲染，立刻反映出来
```

### 3.5 证据四：**写**路径也通（真实 server action）

只证明读还不够，写走的是同一套查询编译器 + 事务。
直接按无 JS 的渐进增强方式 POST 真实 server action `saveNarrativeAction`：

```
$ curl -X POST http://localhost:8390/app/reports/<id> \
    -H "Cookie: lr_session=<有效令牌>" \
    -F '$ACTION_ID_40a15bcdbf1048e407793eaafb624fe7d4f486725e=' \
    -F "id=<id>" -F "summary=容器内经服务端动作写入-1786514719" -F "nextPlan=容器内写入的下月计划"
status=200

$ docker exec idearise-pg psql -At -c 'SELECT summary, "nextPlan" FROM "MonthlyReport" WHERE id=...'
容器内经服务端动作写入-1786514719|容器内写入的下月计划      ← 真的写进去了
```

顺带验证了鉴权：**不带 cookie 打同一个 action → 307 重定向到登录**，没有绕过。

（中间还捞到一条：先用本地 `.next` 里的 action id 打，容器返回 404
`Server action not found` —— action id 是每次构建独立的，必须从**容器内**的
`server-reference-manifest.json` 取。排查 server action 时会遇到，记一笔。）

### 3.6 那 Dockerfile 要不要改？

**不要。** `Dockerfile` 一个字没动，`next.config.ts` 也不需要 `outputFileTracingIncludes`。
已把这个结论和正确的核查命令写进 `README.md`，避免下一个人再当成阻塞项查一遍。

---

## 4. 数据迁移方案

`dev.db` 里是 seed 生成的演示数据（6 个商家、250 条评价、6 份月报……共 4173 行），
不是真实客户数据。给了两条路，**都实跑验证过**。

### 4.1 路径 A（默认）：直接 `npm run seed`

seed 是**确定性**的 —— 固定种子 `rng(20260807)` + 固定基准时间 `NOW = 2026-08-07T12:00:00Z`，
作者在注释里明写"不用 Math.random"。所以在 Postgres 上重跑能重现同一份库。

实测：18 张表逐表行数与 `dev.db` **完全一致**。

| 表 | dev.db | Postgres | | 表 | dev.db | Postgres |
|---|---|---|---|---|---|---|
| Merchant | 6 | 6 | | Post | 9 | 9 |
| Review | 250 | 250 | | PostTarget | 26 | 26 |
| Reply | 250 | 250 | | Photo | 32 | 32 |
| ScanRun | 48 | 48 | | QnaItem | 12 | 12 |
| ScanPoint | 2352 | 2352 | | SocialAccount | 13 | 13 |
| HealthCheck | 12 | 12 | | SocialInteraction | 12 | 12 |
| Snapshot | 303 | 303 | | InviteBatch | 15 | 15 |
| AuditLog | 316 | 316 | | InviteRecipient | 441 | 441 |
| MonthlyReport | 6 | 6 | | DeliveryLog | 70 | 70 |

内容也按哈希逐列比对（不只数行数）：

```
MATCH  Merchant.googleLocation / Merchant.name+plan+city
MATCH  Review.googleReviewId / Review.text / Review.status
MATCH  Reply.zhSummary
MATCH  ScanPoint.row:col:rank
MATCH  MonthlyReport.metrics
MATCH  DeliveryLog.item+detail
MATCH  SocialInteraction.externalId
MATCH  InviteRecipient.contact
DIFF   AuditLog.action+target        ← 唯一差异，见下
```

唯一的差异是 `AuditLog` 里 316 行中的 69 行，全部是 `invite.followup/<cuid>` 这种
**target 存的是主键**的行 —— `@default(cuid())` 每次生成都不同，这是设计如此。
按 action 维度分组统计两边完全一致（`reply.publish` 243、`photo.publish` 31、
`post.publish` 16、`qna.publish` 9、`invite.followup` 12、`social.reply` 3、
`post.publish.failed` 1、`reply.reject` 1）。

### 4.2 路径 B：`scripts/migrate-sqlite-to-postgres.ts`（保住原主键）

什么时候需要它：**已经发出去的 `/app/reports/<id>` 链接不能失效**时。
seed 会重新生成 cuid，那些链接会断。

```bash
DATABASE_URL='postgresql://...' npx tsx scripts/migrate-sqlite-to-postgres.ts [dev.db 路径]
```

设计要点：

- **零新依赖**：用 Node 内置 `node:sqlite` 读 SQLite。不为了搬一次数据把刚删掉的
  `better-sqlite3` 装回来。
- **类型按 DMMF 还原**，不靠猜列名：SQLite 把 `DateTime` 存成 ISO 文本、`Boolean` 存成 0/1，
  脚本按 `Prisma.dmmf` 里声明的字段类型逐个转换。
- **外键顺序显式列出**，并在启动时断言 `ORDER` 与 schema 的模型集合完全对齐 ——
  以后 schema 加了新模型却忘了加进 `ORDER`，会直接报错而不是静默漏搬一张表。
- **拒绝往非空库写**（目标库已有商家就退出），避免误覆盖。
- 跑完自检逐表源行数 == 写入行数，对不上就抛错。

实跑输出：

```
Merchant                 6 → 6        Post                     9 → 9
Review                 250 → 250      PostTarget              26 → 26
Reply                  250 → 250      Photo                   32 → 32
ScanRun                 48 → 48       QnaItem                 12 → 12
ScanPoint             2352 → 2352     InviteBatch             15 → 15
HealthCheck             12 → 12       InviteRecipient        441 → 441
Snapshot               303 → 303      SocialAccount           13 → 13
AuditLog               316 → 316      SocialInteraction       12 → 12
MonthlyReport            6 → 6        DeliveryLog             70 → 70

✅ 18 张表，共 4173 行，逐表行数一致
```

搬完后再比对，这次连主键都对上了：

```
MATCH  Merchant.id (主键) / MonthlyReport.id (主键) / Review.id (主键)
MATCH  AuditLog.action+target        ← 上面那个 DIFF 消失了
MATCH  Review.suspectViolation(bool) / Reply.respondMinutes / Merchant.rating(float)
MATCH  Review.postedAt / InviteRecipient.followUpAt（按 epoch 毫秒逐行比对）
```

### 4.3 ⚠️ 一条会骗人的细节：原生 `pg` 读时间戳会偏

比对时先看到 DateTime 列"不一致"，查下来是**比对脚本自己的锅**：
原生 `pg` 驱动把 `TIMESTAMP(3)`（无时区）按**进程本地时区**解释，
本机 UTC-4 时读出来整体偏 240 分钟。

**走 Prisma 没有这个问题** —— Prisma 读出来的 `Date` 与 `dev.db` 逐行一致
（`Review.postedAt`、`InviteRecipient.followUpAt` 两列全量哈希相同）。

已写进 `README.md`，免得下一个人写一次性排查脚本时被同一件事骗到。

### 4.4 现有的验证脚本在 Postgres 上也通过

不只是我自己写的比对。仓库里原有的两个不变量脚本直接跑：

```
scripts/verify-demo.ts    → 已发布回复 243 / 发布类快照 243 / 快照与发布数一致: true
scripts/verify-report.ts  → 小结保留 true / 计划保留 true / 未产生重复记录 1 / 指标为冻结JSON true
prisma/seed.ts 自带的不变量自检 → ✅ 不变量全部通过
```

---

## 5. 构建验证

`rm -rf .next` 后从零构建，**且不带 `DATABASE_URL`**（模拟 Docker 构建环境）：

```
> idearise@0.1.0 build
> prisma generate && next build

Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma/schema.prisma.
✔ Generated Prisma Client (v7.9.1) to ./generated/prisma in 134ms

▲ Next.js 16.3.0 (Turbopack)
✓ Running next.config.ts took 133ms
  Creating an optimized production build ...
✓ Compiled successfully in 3.1s
  Running TypeScript ...
  Finished TypeScript in 2.1s ...
  Collecting page data using 9 workers ...
✓ Generating static pages using 9 workers (9/9) in 159ms
  Finalizing page optimization ...

Route (app)
┌ ○ /_not-found
├   /[locale]
│ ├ ● /zh
│ └ ● /en
├ ƒ /api/lead
├ ƒ /app
├ ƒ /app/merchants/[id]
├ ƒ /app/merchants/[id]/invites
├ ƒ /app/merchants/[id]/media
├ ƒ /app/merchants/[id]/posts
├ ƒ /app/merchants/[id]/rank
├ ƒ /app/merchants/[id]/reports
├ ƒ /app/merchants/[id]/social
├ ƒ /app/reports/[id]
├ ○ /checkup
└ ƒ /login

ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses generateStaticParams)
ƒ  (Dynamic)  server-rendered on demand
```

`npm run lint`：无输出（干净）。`npx tsc --noEmit`：无输出。

路由表与迁移前逐行一致 —— `/zh`、`/en` 仍是 `●` SSG（没因为换数据库退化成动态渲染），
路由表里没有 `(saas)` 段，`ƒ Proxy (Middleware)` 仍在。

---

## 6. 需要你提供什么

### 6.1 Neon 连接串怎么给

在 Neon 控制台建一个**新项目**（⛔ 不要复用 `print-main` 的库或连接串），
拿两条串：

| 用途 | 端点 | 说明 |
|---|---|---|
| 运行时 `DATABASE_URL` | **pooled**（主机名带 `-pooler`） | Cloud Run 多实例，必须走连接池 |
| 跑迁移用 | **direct**（不带 `-pooler`） | DDL 走连接池容易出问题 |

格式（**别贴进对话，直接写进 Secret Manager**）：

```
postgresql://<user>:<password>@<host>-pooler.<region>.aws.neon.tech/<db>?sslmode=require
```

> ⚠️ **实测发现的一条**：`@prisma/adapter-pg` 底下是 node-postgres，而当前版本的
> `pg-connection-string` 把 `sslmode=require` **当作 `verify-full`** 处理
> （比 libpq 更严，会完整校验证书链 + 主机名），启动时会打印一条 SECURITY WARNING 说明这件事。
> Neon 的证书是公共 CA 签发、主机名对得上，**预期能通过**，但这是我**没法在本地
> 用 Neon 真串验证的一点**（见 7.2）。万一连不上且报
> `Error opening a TLS connection`，先别慌，那是证书校验而不是网络问题。

### 6.2 环境变量清单（Cloud Run 上要配的全部）

| 变量 | 用途 | 来源 | 备注 |
|---|---|---|---|
| `DATABASE_URL` | Postgres 连接串 | **Secret Manager** | Neon pooled 端点，带 `sslmode=require` |
| `OPERATOR_PASSWORD` | 运营后台登录口令 | **Secret Manager** | |
| `SESSION_SECRET` | 会话签名密钥 | **Secret Manager** | 随机长串；换掉会让所有已登录会话失效 |
| `LEAD_WEBHOOK_URL` | 线索投递目标 | **Secret Manager** | README 标注上线前必须配，否则线索只进日志 |

四个全部走 Secret Manager，**一个都不要写进镜像或 `cloudbuild`/workflow 的明文环境变量**。

> 按 CLAUDE.md 9.1，写 secret 前必须先核对
> `gcloud config get-value project` 是 `supply-491510`。
> 曾因写到错误项目导致生产更新无效。

### 6.3 需要你拍板的

1. **迁移用哪条路径**：默认 `npm run seed`（4.1），还是保主键的脚本（4.2）？
   —— 取决于 `/app/reports/<id>` 这类链接有没有对外发过。
2. **`dev.db` 要不要从仓库里移出去**。它现在**仍被 git 跟踪**（1.2 MB）。
   本次没动它（不在任务范围，且删文件属于"覆盖用户已有文件"）。
   建议：迁移完成后 `git rm --cached dev.db` 并加进 `.gitignore`，
   避免上线后有人误当成生产数据。
3. **前一轮遗留的两条仍未决**（本次没碰）：`/checkup` 的路径定名 / 英文版 / 接进导航；
   域名 `idearise.vettlab.com` 还是 `idearise.ca`。

---

## 7. 上线前还剩什么没做

按重要性排序。**这一节严格按"实际验证过什么"写，没验证的直接写没验证。**

### 7.1 ~~阻塞：还没有真实 Neon 库~~ ✅ 已解决（2026-08-12 补记）

> **补记**：连接串已拿到，下面这三步全部实跑完成。
> Neon 项目 `ep-dawn-frog-axxgiawb`（us-east-2，库 `neondb`，**PostgreSQL 18.4**）：
> `migrate deploy` 一次建表成功（19 张），`migrate-sqlite-to-postgres.ts` 搬入
> **4173 行**逐表一致，amd64 容器用 **pooled** 串重跑第 3 节那套验证全绿
> （未登录 307 / 已登录 200 / 6 个商户名全命中 / 7 个子页面全 200）。
> 首次请求 2252ms，第二次 295ms。
> 另外单独探了 **Prisma 在 pooler 上的写路径**（数据搬迁走的是 direct，不能代表 pooled）：
> `create` / `update` / `$transaction([count, findMany({include})])` / `deleteMany`
> 全部通过，探针已清理。**PgBouncer 事务模式没有兼容性问题。**
> 明细见台账「N10 Neon 实测记录」。

原始待办（已完成，保留供参考）：

```bash
# 1. 用 direct 端点建表
DATABASE_URL='<direct 串>' npx prisma migrate deploy

# 2. 灌演示数据（二选一）
DATABASE_URL='<direct 串>' npm run seed
# 或
DATABASE_URL='<direct 串>' npx tsx scripts/migrate-sqlite-to-postgres.ts

# 3. 用 pooled 端点起容器实跑一遍，重复第 3 节那套验证
```

### 7.2 ~~未验证：Neon 的 TLS 证书能不能过 node-postgres 的 verify-full~~ ✅ 已实测通过（2026-08-12 补记）

> **补记**：推断成立。用真实 Neon 串（`sslmode=require&channel_binding=require`）
> 连接**直接成功**，node-postgres 那条 SECURITY WARNING 照旧会打，但不影响连接 ——
> Neon 是公共 CA、主机名对得上，`verify-full` 过得去。
> 两个应急选项（`no-verify` / `uselibpqcompat`）**都不需要用**。
> `channel_binding=require` 也没引起任何问题，node-postgres 忽略它。
>
> 下面这套自签证书的排查过程留着 —— 结论是**当时试不通的原因在自签证书本身，不在代码**。

原始记录：

本地用了一套 **SSL-only 的 Postgres**（`pg_hba.conf` 只有 `hostssl`，非 SSL 连接被
`no pg_hba.conf entry ... no encryption` 直接拒绝）验证 TLS 通路：

```
容器 → SSL-only Postgres：/app 返回 200，渲染出真实数据
服务端 pg_stat_ssl 视角：
  ssl | version | cipher                 | 连接数
  t   | TLSv1.3 | TLS_AES_256_GCM_SHA384 | 5      ← 正好是 lib/db.ts 里设的 max:5
```

**TLS 传输本身是通的，连接池上限也生效了。**

但这套用的是**自签证书 + `sslmode=no-verify`**。用 `sslmode=require` 时如实报
`P1011 Error opening a TLS connection: self-signed certificate` —— 这是正确行为
（自签证书本来就该被拒）。我**试了两次**用 `NODE_EXTRA_CA_CERTS` 让容器信任这张自签 CA
**都没成功**，按"同一个问题连续 2 次没解决就停"的规矩停在这里，没试第三次。

**所以"Neon 的公共 CA 证书能通过 verify-full"这一条是推断，不是实测。**
拿到真串后第一件事就是验证它。若真的失败，两个已知的应急选项：
`?sslmode=no-verify`（降级，不推荐长期用）或 `?uselibpqcompat=true&sslmode=require`。

### 7.3 ~~未验证：Cloud Run 上的冷启动与连接行为~~ ✅ 冷启动已实测（2026-08-12 补记）

> **补记**：容器侧的冷启动实测完了，结论是**不需要 `min-instances=1`**。
>
> | 场景 | 耗时 |
> |---|---|
> | `/checkup`（不查库）首次 | 481ms ← 纯 Next 首渲染 |
> | `/app`（查库）首次，Next 已预热 | **1982ms** |
> | 容器全冷 `/app` 首次 | 2237ms |
> | 静置 400s（Neon 应已 suspend）后首次 | 2416ms |
> | 第二次起 | 190–265ms |
> | 纯 psql 连接+查询 | 150–350ms |
>
> **大头是 Prisma 首次初始化约 1.6s**（3.6MB wasm query compiler 的首次 instantiate），
> 不是连接、也不是 Neon。**Neon 的 idle-suspend 只值 179ms**，不构成风险。
> 最坏首个请求 2.4s，之后 200ms 出头 —— 自用运营后台完全可接受，
> 开 `min-instances=1` 会打破 0 费用配置，不划算。
>
> 仍未测：Neon 免费档连接数配额 × Cloud Run 并发 × `max:5` 的乘积安全性
> （要 Neon 后台的配额数字才能算），以及真实 Cloud Run 环境下的实例回收行为。

原始记录：

- `min-instances=0` 时实例会被回收，Neon 免费档也会 idle-suspend。
  **两边都冷的情况下第一个请求要多久、会不会直接超时报错 —— 没测过**（没有真实环境）。
- Neon 免费档的连接数上限、Cloud Run 并发数 × `max:5` 的乘积是否安全 —— **没算过**，
  要知道 Neon 那边的实际配额才能算。
- 是否需要 `min-instances=1`（**会产生固定费用**，与当前 0 费用配置冲突）—— 待评估。

### 7.4 未做：localrank 12 个功能模块的端到端回归

前一轮就没做，本次**也没做**。本次覆盖到的是：
所有页面路由在容器里可访问（第 3.3 节 10 条路径）、月报保存这一条写路径、
以及 seed 会走到的服务层逻辑（含 9 处 `$transaction`）。

**没有覆盖到的**：索评批次、社媒回复、内容分发、照片/问答这些模块的**交互式**操作，
没有在浏览器里真人点过任何一个按钮。合并与迁移都只动了数据层不动业务逻辑，
风险不高，但**确实没测**。

### 7.5 未做：性能与索引复核

schema 的索引原样从 SQLite 迁过来。Postgres 的查询规划器与 SQLite 不同，
**没有跑过任何 EXPLAIN**，也没有在接近真实数据量下压过。
演示数据量（最大的表 2352 行）下无从判断。

### 7.6 明确没做的事

- **没有 push，没有部署，没有碰 main。** `git log main -1` 仍是 `3fc2cb8`。
  两个新 commit（`9bd3b25`、`b135ec0`）都只在本地 `merge/localrank` 上。
- **没有连接、没有创建任何 Neon 实例**，没有碰 `print-main` 的任何东西。
- **没有读取或打印任何 `.env` 内容或密钥**（仓库里也确实没有 `.env`）。
- **没有跑 `npm install`**（会污染 amd64 锁文件），锁文件按 README 的 Docker 方式重生成，
  装依赖只用 `npm ci`，装完 `cmp` 核对过锁文件未被改写。
- **没有动 localrank 原目录**，工作区干净，HEAD 仍 `ffdb2aa`。
- **没有删除 `dev.db`**，见 6.3 第 2 条。
- **没有改动品牌站任何一个文件**。本次改到的是：`prisma/schema.prisma`、
  `prisma/migrations/*`、`lib/db.ts`、`next.config.ts`、`package.json`、
  `package-lock.json`、`.env.example`、`README.md`，新增 `scripts/migrate-sqlite-to-postgres.ts`。
- **验证用的容器和镜像已全部清理**（`idearise-app`、`idearise-app-ssl`、`idearise-pg`、
  `idearise-pg-ssl`、网络、两个本地镜像）。机器上另外那两组容器
  （`idearise-head`、`veggie-*`）不是本次起的，未动。

---

## 附：本次的两个 commit

| commit | 内容 |
|---|---|
| `9bd3b25` | 数据库迁到 Postgres：provider、adapter、迁移、数据搬迁一并换掉 |
| `b135ec0` | README 记下 Prisma 7 wasm 的真实情况：不是缺陷，别再查一遍 |

台账：`docs/20260812-idearise-neon迁移-tasks.md`
