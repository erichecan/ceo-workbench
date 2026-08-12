# idearise × localrank 合并报告

看板任务 c-6a011f｜2026-08-12

| 项 | 值 |
|---|---|
| 工作仓库 | `/Volumes/datacenter/04-eric/AIcoding/idearise` |
| 分支 | `merge/localrank`（**未 push，未部署，未碰 main**） |
| 分支 HEAD | `43aa7cf` |
| main | `3fc2cb8`，与开工前逐字一致，未改动 |
| `npm run build` | **通过**（完整输出见第 4 节） |
| localrank 16 个 commit | **全部保住**，逐个哈希核对通过 |
| localrank 原目录 | 未移动、未删除、工作区干净 |

合并后一个仓库同时提供两件东西，同域不跳站：

| 区域 | 路由 | i18n | 鉴权 |
|---|---|---|---|
| 品牌站（获客） | `/`、`/en` | next-intl 中/英 | 公开 |
| 自评问卷（获客） | `/checkup` | 仅中文 | 公开 |
| SaaS 控制台（交付） | `/app/*` | 仅中文 | 需登录 |
| 登录 | `/login` | 仅中文 | 公开 |
| 接口 | `/api/lead` | 不适用 | 公开（见 5.4） |

---

## 1. 采用的合并方式与理由

**选了 `git remote add` + `git merge --allow-unrelated-histories`，没有用 `git subtree add`。**

理由是 localrank 的文件本来就该落在仓库根部（`prisma/`、`lib/`、路由并入 `app/`），
而 subtree 会强制把整棵树塞进一层前缀目录，之后还得再 `git mv` 搬出来一次 —— 多一次
大规模改名，`git log --follow` 和 `git blame` 要多穿一层，没有任何好处。
remote + merge 让 16 个 commit 直接出现在 `git log` 主线上，blame 能一路穿到原始提交。

代价是 add/add 冲突要手工解（7 个文件），但都是配置文件，可控。

**合并做成了两个 commit，故意不合并成一个：**

| commit | 内容 |
|---|---|
| `81dd30f` | 纯合并 + 解配置冲突，**不动目录结构**。此 commit 是 `app/` 与 `src/app/` 并存的中间态，构建不可用 |
| `43aa7cf` | 目录归一 + 路由分流，构建通过 |

分开的好处：第一个 commit 的 diff 只有配置决策，第二个 commit git 能识别出 56 个 rename
（`git status` 显示 `R`），所以改名不会污染 diff，也不会切断 blame。

### 历史保住的验证方式

不是靠肉眼数 `git log`，而是逐个哈希断言祖先关系：

```
for c in $(git rev-list localrank/main); do
  git merge-base --is-ancestor $c merge/localrank || echo "MISSING $c"
done
→ localrank commit 总数: 16
→ 全部 16 个 commit 都在 merge/localrank 上 ✓（无 MISSING 输出）
```

改名穿透抽查：

```
$ git log --follow --oneline lib/db.ts | tail -3
43aa7cf 目录归一 + 路由分流：品牌站与 SaaS 同域共存，构建通过
17b058a 产品本体：评价闭环 + 商家看板，端到端可点通   ← 穿回 localrank 原始 commit
```

> 收尾时删掉了临时 remote `localrank`（它指向本机绝对路径，对别人无意义）。
> 历史已经并进分支，**不依赖这个 remote**，删了不丢任何东西。

---

## 2. 路由冲突的解决方案

### 2.1 先说清楚坑在哪

三件事叠在一起：

1. **idearise 没有 `middleware.ts`，用的是 Next 16 的新名字 `proxy.ts`**。
   任务单里说的「读现有 middleware.ts」在这个仓库里对应 `proxy.ts`。
2. **localrank 自己也有一个 `src/middleware.ts`**（`/app/*` 的登录闸门）。
   Next 只允许一个 proxy/middleware，两个必须并成一个。
3. next-intl 的 `localePrefix` 是 `"as-needed"`，它会把 `/app` 当成品牌站路径
   重写成 `/zh/app`；而 `(saas)` 下没有 `[locale]` 段，结果是 404。
   这个故障在浏览器里表现为「登录后又跳回登录页」，很难查。

### 2.2 关键取舍：`/app` 必须留在 matcher 里

最直觉的做法是把 `/app` 加进 matcher 的排除列表：

```
matcher: "/((?!api|app|login|checkup|_next|...).*)"     ← 错的
```

**这么写会把登录闸门一起关掉** —— 被 matcher 排除的路径根本不会进入 proxy 函数，
`verifyToken` 也就不执行，`/app/*` 变成裸奔。

所以正确的形状是「**进函数，但不走 i18n**」：matcher 仍然覆盖 `/app`，
在函数体里分流。只有 `/api/*` 才真的从 matcher 排除（它不需要任何中间件）。

### 2.3 `proxy.ts` 的 diff

```diff
 import createMiddleware from "next-intl/middleware";
+import { NextResponse, type NextRequest } from "next/server";
 import { routing } from "./i18n/routing";
+import { SESSION_COOKIE, verifyToken } from "@/lib/auth-token";

-export default createMiddleware(routing);
+const intl = createMiddleware(routing);
+
+/** 不参与 i18n 的路径前缀。按段匹配，避免 /application 被 /app 误伤 */
+const SAAS_PREFIXES = ["/app", "/login", "/checkup"] as const;
+
+function matchesPrefix(pathname: string, prefix: string) {
+  return pathname === prefix || pathname.startsWith(`${prefix}/`);
+}
+
+export default async function proxy(request: NextRequest) {
+  const { pathname } = request.nextUrl;
+
+  if (SAAS_PREFIXES.some((p) => matchesPrefix(pathname, p))) {
+    if (matchesPrefix(pathname, "/app")) {
+      const operator = await verifyToken(
+        request.cookies.get(SESSION_COOKIE)?.value,
+      );
+      if (!operator) {
+        const url = new URL("/login", request.url);
+        url.searchParams.set("next", pathname);
+        return NextResponse.redirect(url);
+      }
+    }
+    return NextResponse.next();
+  }
+
+  return intl(request);
+}

 export const config = {
-  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
+  matcher: "/((?!api(?:/|$)|_next|_vercel|.*\\..*).*)",
 };
```

localrank 的 `src/middleware.ts` 就此并入并删除，不再单独存在。

**顺带修掉一个既有缺陷**：原 matcher 里的 `api` 是裸的、没有段边界，
意味着品牌站未来任何以 `api` 开头的路径（如 `/apiary`）会被误判成接口而绕过 i18n。
收紧成 `api(?:/|$)` 只会把这类被误伤的路径**还给** i18n，不改变 `/api/*` 本身的行为。

`lib/auth-token.ts` 只用 Web Crypto，是 edge-safe 的，可以安全地在 proxy 里 import；
`lib/auth.ts` 依赖 `next/headers`，**不能**进 proxy —— 原作者在文件头注释里写明了这一点，
合并时保持了这个边界。

### 2.4 怎么验证的（两层，都不是"看着像对的"）

**第一层：把 matcher 正则和分流逻辑复刻成脚本，跑路径表断言。**
重点包含段边界用例（`/application`、`/apiary`、`/loginhelp` 必须仍归品牌站）。

```
PASS  /                        -> I18N
PASS  /en                      -> I18N
PASS  /zh                      -> I18N
PASS  /en/anything             -> I18N
PASS  /app                     -> SAAS+AUTH
PASS  /app/merchants/abc       -> SAAS+AUTH
PASS  /app/reports/1           -> SAAS+AUTH
PASS  /login                   -> SAAS
PASS  /checkup                 -> SAAS
PASS  /api/lead                -> BYPASS(不进 proxy)
PASS  /api                     -> BYPASS(不进 proxy)
PASS  /_next/static/x.js       -> BYPASS(不进 proxy)
PASS  /favicon.ico             -> BYPASS(不进 proxy)
PASS  /proposal.html           -> BYPASS(不进 proxy)
PASS  /application             -> I18N        ← 未被 /app 前缀误吞
PASS  /apiary                  -> I18N        ← 未被 /api 前缀误吞
PASS  /loginhelp               -> I18N        ← 未被 /login 前缀误吞
全部通过（17/17）
```

**第二层：起真实服务器打真实请求**（`next start`，端口 3411）。

| 路径 | 状态码 | Location | 判定 |
|---|---|---|---|
| `/` | 200 | | 品牌站中文，标题「万合 IdeaRise — 让更多人进店，让来过的再来」 |
| `/en` | 200 | | 品牌站英文，标题「IdeaRise — More people through the door...」 |
| `/zh` | 307 | `/` | `as-needed` 去掉默认前缀，next-intl 预期行为 |
| `/app` | 307 | `/login?next=%2Fapp` | **关键：不是 `/zh/app`** |
| `/app/merchants/x` | 307 | `/login?next=%2Fapp%2Fmerchants%2Fx` | 深层路径同样正确 |
| `/login` | 200 | | |
| `/checkup` | 200 | | 标题「Google 门面体检 — ...」 |
| `/api/lead` | 405 | | POST-only，能到达路由本身 = 没被 i18n 重定向 |
| `/application` | 404 | | 仍交给 i18n，未被 `/app` 吞掉 |

**第三层：带有效会话 cookie 走通登录后的路径。**
用与 `lib/auth-token.ts` 相同的 HMAC 方案现签一个令牌：

```
/app -> 200
标题：<title>运营后台 · Google 门面管家</title>
正文含「待处理」「运营后台」——
说明 middleware 放行 → 路由组 layout 的 currentOperator() 通过
→ Prisma 真的读到了 dev.db 的数据 → 页面渲染完成，整条链路通。
```

### 2.5 两个根布局并存

idearise 原本没有 `app/layout.tsx`，根布局是 `app/[locale]/layout.tsx`（自带 html/body）。
SaaS 那三条路由需要另一个自带 html/body 的根布局，所以放进**路由组** `app/(saas)/`：

```
app/
├── [locale]/layout.tsx      ← 品牌站根布局（原样未动）
├── (saas)/
│   ├── layout.tsx           ← SaaS 根布局（原 localrank 的 src/app/layout.tsx）
│   ├── app/                 → /app/*
│   ├── login/               → /login
│   └── checkup/             → /checkup（原 localrank 的 /）
├── api/lead/                → /api/lead
├── globals.css              ← 品牌站主题
└── saas.css                 ← SaaS 主题（原 localrank 的 globals.css）
```

路由组不进 URL —— 构建产物的路由表里没有 `(saas)` 段，已核实（见第 4 节）。

**注意这里有一处产品决策**：localrank 的首页 `/`（Google 门面体检问卷）和品牌站首页
直接相撞，我把它挪到了 `/checkup`。见 5.1。

---

## 3. 依赖与 Prisma 的处理

### 3.1 依赖：实际上没有版本冲突

审计时以为会打架，结果两边主依赖完全同版：

| 包 | idearise | localrank | 结果 |
|---|---|---|---|
| next | 16.3.0 | 16.3.0 | 一致 |
| react / react-dom | 19.2.8 | 19.2.8 | 一致 |
| tailwindcss / @tailwindcss/postcss | ^4 | ^4 | 一致 |
| eslint-config-next | 16.3.0 | 16.3.0 | 一致 |
| typescript | ^5 | ^5 | 一致 |

所以 `package.json` 是直接取并集，idearise 侧保留 `next-intl`、`clsx`，
localrank 侧带进 `@prisma/client`、`@prisma/adapter-better-sqlite3`、`better-sqlite3`
和 dev 侧的 `prisma`、`tsx`、`dotenv`。**没有任何一个包需要降级或升级。**

`tsconfig` 的 path alias 取 idearise 的 `@/*` → `./*`，
localrank 的 `@/*` → `./src/*` 作废（`src/` 已经不存在了）。

### 3.2 锁文件：这里差点踩雷

idearise 的 README 有一条硬约束：

> `package-lock.json` 按 **linux/amd64** 生成，与 CI 构建环境一致。
> 本地跑 `npm install` 会把它改回 darwin/arm64 版本，导致 CI 构建失败。

所以**全程没有跑 `npm install`**。锁文件是按 README 给的方式在 Docker 里重新生成的：

```bash
docker run --rm -i --platform=linux/amd64 node:22-alpine sh -c '
  mkdir -p /w && cd /w && cat > package.json
  npm install --package-lock-only --no-audit --no-fund >/dev/null 2>&1
  cat package-lock.json
' < package.json > package-lock.json
```

本地装依赖用 `npm ci`（只读锁文件，不改写）。装完核对过 `git status`，
锁文件确实没有被污染。

### 3.3 Prisma

| 项 | 处理 |
|---|---|
| schema | `prisma/schema.prisma` 原样带入，只改了一行 generator output |
| 生成路径 | `../src/generated/prisma` → `../generated/prisma`（跟着 `src/` 一起搬） |
| 迁移 | `prisma/migrations/` 7 个迁移全部带入，未改动 |
| 客户端生成 | `build` 脚本前置：`"build": "prisma generate && next build"` |
| 生成物入库 | 否，`.gitignore` 加 `/generated/prisma` |
| 连接注入 | 保持 localrank 的 Prisma 7 driver adapter 写法（`lib/db.ts`），未改 |
| 原生模块 | `next.config.ts` 加 `serverExternalPackages: ["better-sqlite3"]`，避免被打包 |
| 环境变量 | 补 `.env.example`（**只有变量名，全部空值**），`.gitignore` 加 `!.env.example` 例外 |

对 idearise 现有构建的影响：只多了一步 `prisma generate`（约 110ms）。
品牌站的 `/zh`、`/en` 仍然是 SSG 预渲染，未退化成动态渲染（见路由表的 `●` 标记）。

全程没有读取或打印任何 `.env` 内容。构建和起服务用的是命令行临时传入的占位值。

---

## 4. 构建验证结果

`rm -rf .next` 之后从零重新构建的完整输出：

```
> idearise@0.1.0 build
> prisma generate && next build

Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.

✔ Generated Prisma Client (v7.9.1) to ./generated/prisma in 113ms

Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)


▲ Next.js 16.3.0 (Turbopack)
✓ Running next.config.ts took 90ms

  Creating an optimized production build ...
✓ Compiled successfully in 3.1s
  Running TypeScript ...
  Finished TypeScript in 2.4s ...
  Collecting page data using 9 workers ...
  Generating static pages using 9 workers (0/9) ...
  Generating static pages using 9 workers (2/9)
  Generating static pages using 9 workers (4/9)
  Generating static pages using 9 workers (6/9)
✓ Generating static pages using 9 workers (9/9) in 157ms
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

读这张表要看三件事：

1. `/zh`、`/en` 仍是 `●` SSG —— 品牌站没有因为引入 Prisma 而退化成动态渲染
2. 路由表里**没有 `(saas)` 段** —— 路由组确实不进 URL
3. `ƒ Proxy (Middleware)` 存在 —— 合并后的 proxy 被正确识别

`npm run lint`：无任何输出（干净）。

---

## 5. 没做完 / 有风险 / 需要 CEO 决策

按重要性排序。这一节我按「实际验证过什么」写，没验证的直接写没验证。

### 5.1 ⚠️ 需要拍板：localrank 的首页被我挪到了 `/checkup`

localrank 的 `/` 是「Google 门面体检」12 题自评问卷，和品牌站首页硬冲突。
我挪到了 `/checkup`，这是**我替产品做的决定，需要你确认**。

三个问题：

- **路径名要不要改？** `/checkup`、`/体检`、`/free-audit` 都行，我选了最省事的。
- **它现在只有中文。** 品牌站是中英双语，英文访客点进这个问卷会看到全中文页面。
  要做英文版就得把 `lib/quiz-data.ts` 的题库抽进 next-intl 的 messages，
  这是一块独立工作量，**本次没做**。
- **它现在不在品牌站的导航里。** 品牌站首页没有任何链接指向 `/checkup`，
  等于这个获客工具目前是个孤儿页。要不要接进 Hero 或 FinalCta 的 CTA，
  是产品决策，**本次没动品牌站任何一个文件**。

如果原来 localrank 的 `/` 有对外发过的链接或二维码，挪路径会断掉，需要加 301。

### 5.2 ⚠️ 上线阻塞：standalone/Docker 路径**未验证**，且已发现一个具体问题

运行时验证全部是用 `next start` 做的。而生产走的是 `output: "standalone"` + Docker，
**这条路径我没有验证**（跑 Docker 构建需要装依赖、构镜像，且验证结果只对 linux/amd64
有意义，本机是 darwin/arm64）。

已经查到一个具体问题：**Prisma 7 的查询编译器 wasm 没有被 trace 进 standalone。**

```
$ ls -la generated/prisma/query_compiler_fast_bg.wasm
-rw-r--r--  3542044 ... generated/prisma/query_compiler_fast_bg.wasm   ← 存在

$ find .next -name "*query_compiler*"
（无输出）                                                              ← 没进构建产物
```

`next start` 之所以能跑通，是因为它从项目目录读文件，wasm 就在原地。
Docker runner 阶段只 COPY 了 `.next/standalone`、`.next/static`、`public`，
**wasm 不在其中**，容器里大概率会在第一次查询时炸。

同样没验证的还有 `better-sqlite3` 在 `node:22-alpine` 上能不能装上 ——
alpine 是 musl，原生模块常需要 `apk add python3 make g++` 才能编译。
本机 `npm ci` 时看到了 `prebuild-install` 的废弃告警，这是个信号。

**但这两件事都可能因为 5.3 而自动消失** —— 迁到 Postgres 就不再需要
better-sqlite3，Prisma 的引擎形态也会变。所以建议先定 5.3，再回头修部署。
**在这两件事解决之前，这个分支不能合进 main**（一 push 就会触发 GitHub Actions 部署）。

### 5.3 ⚠️ 需要拍板：数据库迁到哪

现在是 SQLite（`dev.db`，**已被 git 跟踪，随合并进了仓库**）。
Cloud Run 的文件系统是临时的、每个实例独立，**SQLite 在生产上不能用**：
实例一重启数据就没了，多实例之间数据还不一致。

schema 作者已经为迁移做了准备（注释写明「字段类型均已避开方言特性」），
但迁移本身**本次没做**。需要你定：

- Cloud SQL for PostgreSQL（最稳，但有固定月费，与 idearise 目前的 0 费用配置冲突）
- Neon / Supabase（有免费额度，但多一个供应商）

定了之后要做：改 `datasource provider`、重新生成全部迁移、
把 `@prisma/adapter-better-sqlite3` 换成 Postgres adapter、跑一次真实数据迁移。

另外 `dev.db` 里是演示数据（seed 生成的商家、评价、月报），不是真实客户数据。
但既然它在仓库里，**上线前要确认它不会被当成生产数据用**，
以及要不要干脆从仓库里移出去。

### 5.4 已审阅、判定可接受，但你应该知道

- **`/api/lead` 故意无鉴权**。原作者在文件头写了理由：提交者是匿名潜在客户，
  加鉴权等于关掉表单；防的是滥用不是越权，用了字段校验 + 蜜罐 + 按 IP 限流三层。
  这个判断我认同，没有改动。
  **但限流是进程内的** —— Cloud Run 多实例时各实例独立计数，原作者自己也标了这是
  v1 的已知妥协。量上来要换 Redis 或 Cloud Armor。
- **`/app` 是单账号口令登录，没有用户表**。要给客户开只读账号时得先上用户表。
  鉴权本身是三层的（proxy → layout `currentOperator()` → server action
  `requireOperator()`），我核对过合并后三层都还在。

### 5.5 我没有做的事（明确列出，避免误以为做了）

- **没有 push，没有部署，没有碰 main**。`git log main -1` 仍是 `3fc2cb8`，与开工前一致。
- **没有删除、没有移动 localrank 原目录**，工作区干净，16 个 commit 原样在。
- **没有读取或打印任何 `.env` 内容或密钥**。`.env.example` 是我新写的，全部空值。
- **没有跑 `npm install`**（会污染锁文件），只用 `npm ci`。
- **没有跑 `prisma migrate`**，没有碰任何数据库。
- **没有改动品牌站任何一个文件**（`app/[locale]/`、`components/sections/`、
  `messages/`、`i18n/` 全部原样）。唯一改到的共享文件是 `proxy.ts`、
  `next.config.ts`、`package.json`、`README.md`、`.gitignore`、`eslint.config.mjs`。
- **没有做端到端的功能回归**。我验证的是「路由到得了、页面渲染得出来、
  Prisma 读得到数据」，**不是** localrank 那 12 个功能模块逐个还能用。
  合并只搬了文件没改业务逻辑，风险不高，但**确实没测**。
- **没有在浏览器里真人点过**。全部验证是 curl + 构建产物核对。

---

## 6. 后续上线需要做什么

按顺序，前两步是阻塞项：

1. **定数据库**（5.3）→ 改 provider、重生成迁移、换 adapter、迁数据
2. **修 standalone 部署**（5.2）→ Dockerfile 需要把 Prisma 引擎带进 runner 阶段；
   若继续用 better-sqlite3 还要解决 alpine 编译。**然后必须在容器里实跑一次验证**，
   不能只看 `docker build` 成功
3. **配环境变量**（Cloud Run 上新增，用 Secret Manager，不要写进镜像）：

   | 变量 | 用途 |
   |---|---|
   | `DATABASE_URL` | 迁移后的 Postgres 连接串 |
   | `OPERATOR_PASSWORD` | 运营后台登录口令 |
   | `SESSION_SECRET` | 会话签名密钥，随机长串 |
   | `LEAD_WEBHOOK_URL` | 线索投递目标（README 标注上线前必须配） |

   > 按 CLAUDE.md 9.1，写 secret 前必须先核对 `gcloud config get-value project`
   > 是 `supply-491510`。曾因写错项目导致生产更新无效。

4. **Cloud Run 配置复核**：现在是 0 费用配置（min-instances=0）。
   SaaS 带 DB 连接后冷启动会变慢，且 Postgres 连接池在 min-instances=0 下
   会反复建连。要评估是否需要 min-instances=1（**这会产生固定费用**）。
5. **域名**：README 里写的是 `idearise.vettlab.com`，任务单里说的是 `idearise.ca`。
   **这两个对不上，需要你确认哪个是真的**，会影响 cookie domain 和回调配置。
6. **`/checkup` 的产品收尾**（5.1）：路径定名、要不要英文版、接进品牌站导航。
7. 合进 main 之前记得：**push 就等于部署**（GitHub Actions 触发 Cloud Run）。
   建议先在分支上把 1、2 做完并在容器里验证过，再合。

---

## 附：本次改动的文件清单

**新增**：`.env.example`

**改动**：`proxy.ts`（路由分流）· `next.config.ts`（serverExternalPackages）·
`package.json`（依赖并集 + build 脚本）· `package-lock.json`（docker 重生成）·
`README.md`（项目构成表 + 数据库段）· `.gitignore`（Prisma + env 例外）·
`eslint.config.mjs`（忽略生成物）· `prisma/schema.prisma`（generator output 一行）

**移动**（56 处 rename，git 全部识别）：`src/app/*` → `app/(saas)/*` 与 `app/api/*` ·
`src/lib` → `lib` · `src/components` → `components/saas` · `src/app/globals.css` → `app/saas.css`

**删除**：`src/middleware.ts`（并入 `proxy.ts`）· `src/app/favicon.ico`（保留品牌站的）

**未改动**：`app/[locale]/` · `components/sections/` · `components/ui/` ·
`components/site-header.tsx` · `components/site-footer.tsx` · `components/locale-switch.tsx` ·
`messages/` · `i18n/` · `app/globals.css` · `Dockerfile` · `.github/workflows/deploy.yml` ·
`prisma/migrations/` · `prisma/seed.ts`（仅改 import 路径前缀）
