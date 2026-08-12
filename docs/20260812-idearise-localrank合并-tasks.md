# c-6a011f 合并台账 — idearise × localrank

工作仓库：`/Volumes/datacenter/04-eric/AIcoding/idearise`，分支 `merge/localrank`
开工前 main：`3fc2cb8 README 补锁文件维护说明`（收工时必须仍是这个）

## 关键事实（已核实）

- 两边都是 Next 16.3.0 / React 19.2.8 / Tailwind 4 / eslint-config-next 16.3.0 —— 主依赖零冲突
- idearise 无 `middleware.ts`，用 Next 16 的新名字 `proxy.ts`，matcher `/((?!api|_next|_vercel|.*\..*).*)`
- idearise 根级 `app/`，alias `@/*` → `./*`；localrank 用 `src/`，alias `@/*` → `./src/*` —— 必须统一
- idearise 无 `app/layout.tsx`，根布局是 `app/[locale]/layout.tsx`（发 html/body）
- localrank `src/app/page.tsx` 是「Google 门面体检」问卷，会和品牌站 `/` 撞
- localrank `dev.db` **已被 git 跟踪**，会随合并进来
- localrank `src/generated/prisma` 已 gitignore，需构建时 `prisma generate`

## 任务

- [x] T1 建分支 `merge/localrank`
      验收：`git branch --show-current` = merge/localrank；`git log main -1` 仍 3fc2cb8 ✓
- [x] T2 remote + merge --allow-unrelated-histories，保住 16 个 commit  [81dd30f]
      验收：`git merge-base --is-ancestor` 逐个哈希核对，16/16 全部在分支上 ✓
- [x] T3 目录归一：src/ 拆掉，路由并进 app/(saas)/，lib/、components/saas/  [43aa7cf]
      验收：`src/` 已不存在；git 识别出 56 个 rename；`app/[locale]` 未动 ✓
- [x] T4 proxy.ts 分流 /app /login /checkup，/api 由 matcher 排除  [43aa7cf]
      验收：正则路径表 17/17 通过；next start 实测 /app → /login 而非 /zh/app ✓
- [x] T5 Prisma 接入：output 改 ../generated/prisma、deps 并集、build 前置 generate
      验收：`prisma generate` 成功；带 cookie 访问 /app 200 且读到 dev.db 数据 ✓
- [x] T6 `npm run build` 通过
      验收：rm -rf .next 后从零构建通过；/zh /en 仍 SSG；路由表无 (saas) 段 ✓
- [x] T7 报告 → docs/20260812-idearise-localrank合并报告.md

## 收工状态

分支 HEAD `43aa7cf`，未 push，未部署，main 未动。
localrank 原目录未移动未删除，工作区干净。

**遗留（详见报告第 5 节）：**
1. 数据库仍是 SQLite，Cloud Run 上不可用 —— 迁移目标待 CEO 拍板（阻塞上线）
2. standalone/Docker 路径未验证，已查到 Prisma wasm 未被 trace 进构建产物（阻塞上线）
3. localrank 原首页挪到 /checkup，仅中文、未接进品牌站导航 —— 需产品确认
4. 域名 README 写 idearise.vettlab.com，任务单写 idearise.ca —— 对不上，待确认
5. 未做 localrank 12 个功能模块的端到端回归（只搬文件未改逻辑，但确实没测）
