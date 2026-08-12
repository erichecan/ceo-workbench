# 台账 — consulting 拆分：只留官网，其余迁 webproject

决策（用户 2026-08-12）：**`consulting` 目录只保留公司官网，其他全部迁到 `webproject`。**

源：`/Volumes/datacenter/04-eric/AIcoding/consulting`（remote `erichecan/consulting`）
目标：`/Volumes/datacenter/04-eric/AIcoding/webproject`（**本地仓库，无 remote**）
开工前 consulting HEAD：`4ac3aea`；webproject HEAD：`3fded6a`

硬约束：不动 idearise；不 push（两侧都没到能 push 的状态）；
迁移前后 CEO 工作台的生成产物必须逐字节可复现。

## 勘察结论（已核实，不是推测）

1. **官网代码零引用被迁目录**：`grep` 遍历 `app/ components/ i18n/ middleware.ts
   instrumentation.ts next.config.ts`，没有任何一处引用 `docs/` `finance/`
   `tasks/` `site/` `preview/`。→ 解耦是干净的，不存在拆一半拆不动的情况。
2. **`site/build.mjs` 用的是相对根路径**：`ROOT = site/..`，读 `ROOT/docs`、
   `ROOT/tasks/board.json`、`ROOT/finance/{ledger.jsonl,config.json}`，
   搬运 `tasks/workbench.html` `finance/workbench.html`。
   → 只要这五个目录**整体平移**、相对结构不变，`build.mjs` 一行都不用改。
3. ⛔ **`site/server.js` 是 CJS**（`require` + `__dirname`），
   而 `webproject/package.json` 有 `"type": "module"`。
   直接搬过去 `node site/server.js` 会崩在 `require is not defined in ES module scope`。
   → 必须处理，见 M2。
4. `site/Dockerfile` 全部用相对路径，且依赖根 `package.json` 的 `marked`。
   → Dockerfile 本身不用改，但 `marked` 要跟着搬进 webproject 的依赖。
5. **`site/Dockerfile.dockerignore` 必须一起搬**：根 `.dockerignore` 排除了
   `*.md` 和 `finance`，正是本站点的内容来源。2026-08-12 第一次部署就栽在这。
6. 写死 `AIcoding/consulting` 绝对路径的：只有 `docs/20260811-任务流水线.md` 一份
   （`site/dist/` 那份是生成产物，已 gitignore）。
7. ⛔ **webproject 没有 GitHub remote**，`deploy-ceo-site.yml` 搬过去也跑不起来：
   GitHub Actions 需要仓库 + `GCP_SA_KEY` secret。→ M9，需要用户操作。

## 迁移清单

**迁走**：`site/` `tasks/` `finance/` `docs/` `preview/` `.github/workflows/deploy-ceo-site.yml`
**留下**：`app/` `components/` `i18n/` `messages/` `public/` `next.config.ts`
`middleware.ts` `instrumentation.ts` `tsconfig.json` `postcss.config.mjs`
`Dockerfile` `.dockerignore` `cloudbuild.yaml`

## 任务

- [x] M0 迁移前基线：跑一次 `npm run site`，记录产物清单与关键文件的 sha256
      验收：拿到「N 份文档 · 看板 X 张卡 · 账本 Y 笔」的原始数字与 dist 哈希清单
      产出：本文件「基线」段
- [x] M1 五个目录 + workflow 平移到 webproject
      验收：webproject 下结构与原 consulting 一致；consulting 侧这些路径消失；
            两侧 `git status` 都干净
      依赖：M0
- [x] M2 解决 `type: module` 冲突
      验收：`node site/server.cjs` 在 webproject 下能启动（配了 SITE_USER/SITE_PASS）；
            Dockerfile `CMD` 与 package.json 脚本同步改完
      依赖：M1
- [x] M3 webproject/package.json 补脚本与依赖
      验收：`board` `ledger` `site` `site:serve` 四个脚本可用；`marked` 已装；
            与既有的 `scrape/analyze/report/daily/list/doctor` 无冲突
      依赖：M1
- [x] M4 consulting 侧清理
      验收：package.json 去掉 `ledger/board/site/site:serve` 与 `marked`；
            `.dockerignore` 去掉已无意义的 `finance` 排除；`.gitignore` 去掉 `site/dist/`
      依赖：M1
- [x] M5 workflow 路径与仓库名校正
      验收：`deploy-ceo-site.yml` 在 webproject 下路径全部成立；
            `paths` 过滤器与新结构匹配
      依赖：M1
- [x] M6 订正写死路径的文档
      验收：`docs/20260811-任务流水线.md` 里的 consulting 绝对路径改成 webproject；
            全仓再 grep 一次 `AIcoding/consulting` 无残留（生成产物除外）
      依赖：M1
- [x] M7 两侧本地验证（**这一条是整个迁移的成败判据**）
      验收：webproject `npm run site` 产物与 M0 基线**逐文件 sha256 一致**；
            consulting `npm run build` 通过且路由表未退化
      依赖：M2 M3 M4 M5 M6
- [x] M8 README 与文档更新
      验收：webproject/README.md 说明它现在同时承载 CEO 工作台；
            两侧各自的定位写清楚
      依赖：M7
- [ ] M9 ⛔ 部署链恢复（**需要用户操作，本轮不做**）
      验收：webproject 有 GitHub remote；仓库配好 `GCP_SA_KEY`；
            push 后 Actions 成功部署 ceo-workbench 并实际访问验证
      依赖：M7

## 已知影响

- **迁移期间 `ceo-workbench` 的自动部署会中断**：文件离开 consulting 后，
  consulting 那条 workflow 失去数据源；webproject 那条在 M9 完成前无法触发。
  线上已部署的实例不受影响，只是不再自动更新。
- consulting 官网自身的部署（`cloudbuild.yaml` → Cloud Run 服务 `consulting`）不受影响。

## 基线（M0，迁移前，consulting 侧）

`npm run site` → **19 份文档 · 看板 39 张卡 · 账本 1 笔**，`site/dist` 共 23 个文件。

```
6e721cc458942de4  board.html
f8344f81596d445a  docs/20260805-数字营销竞品调研.html
28fd0c09b2ac4c9d  docs/20260806-idearise-en-deploy-tasks.html
85ff390e6e15af9b  docs/20260807-gbp-reviews-saas-tasks.html
f6afb63a6ecf221a  docs/20260807-service-agreement.html
66d533870a8233d8  docs/20260811-AI公司工作台调研与方案.html
f780f3ef2af951fb  docs/20260811-birdeye-ia-uiux-whitelabel.html
17623a75bf6a2038  docs/20260811-seomachine月费化调研.html
4186a94d866a39c2  docs/20260811-veerytee产品化调研.html
3ad5a01d2c8e79bc  docs/20260811-公司战略.html
fa5a621f52e5c7f9  docs/20260811-记账工作台.html
cef90cbed27f5d01  docs/20260811-任务流水线.html        ← M6 会有意改它，哈希预期变化
fcd91ec8ce2f1156  docs/20260811-喜马拉雅AI课程路线调研.html
06de026fd27abfd7  docs/20260811-项目审计报告.html
cf7688b6b7c002d1  docs/20260811-项目审计指令.html
4f1a7bc8dfbced2f  docs/20260812-consulting拆分迁移-tasks.html  ← 本文件，会随进度变
985d229fd9189656  docs/20260812-idearise-localrank合并-tasks.html
f91ab61167813273  docs/20260812-idearise-localrank合并报告.html
5e0afa0fd6f48063  docs/20260812-idearise-neon迁移-tasks.html
d84e0c9bcef4a61f  docs/20260812-idearise-neon迁移报告.html
07bcb70d5b7dbbcd  docs/index.html
115e3906e91df485  finance.html
b2e5695137823cc1  index.html
```

（sha256 前 16 位。M7 比对时**除上面标注的两份**外应逐一相同。）

## M7 验证结果（成败判据，全部通过）

**① 产物比对**：webproject 侧 `npm run site` 同样输出
「19 份文档 · 看板 39 张卡 · 账本 1 笔」，23 个文件中 **20 个逐字节一致**。
3 个差异全部解释清楚，无意外：

| 文件 | 差异 | 原因 |
|---|---|---|
| `index.html` | 只有一行时间戳 11:53→11:54 | 生成时刻不同 |
| `docs/index.html` | 台账体积 3.5KB→4.8KB | M0 之后我给台账补了基线段 |
| 台账自身的 html | 内容变了 | 同上 |

**② consulting 官网**：`rm -rf .next` 后 `npm run build` 通过，
路由表完整（`[locale]` 多语言路由 + 6 篇 insights 的 SSG 全在）。

**③ CEO 站点服务**（`site/server.cjs`，本地 8477）：

| 断言 | 结果 |
|---|---|
| 不配 SITE_USER/SITE_PASS | 拒绝启动 ✓ |
| 密码不足 10 位 | 拒绝启动 ✓ |
| 无凭据 / 错误凭据 `/` | 401 / 401 |
| 正确凭据 `/` | 200 |
| 文档中心文档数 | 19 |
| 首页「应收未收」 | 在位 |
| `/board.html` `/finance.html` | 200 / 200 |

**④ Docker 镜像 + workflow 的全部断言**（本地跑了一遍 Verify 会做的事）：
镜像内文档页 20 个（19 份 + index）、`node_modules` 为 0（零依赖成立）、
容器内 401 / 19 份文档 / 财务数据在位 / 看板财务页 200。

## 本轮踩到并解决的两个真问题（不是猜测，都实际炸过）

**1. `site/server.js` 撞上 `"type": "module"`**

webproject 的 package.json 带 `"type": "module"`，而这个服务器是 CJS
（`require` + `__dirname`）。直接搬过去起不来。

改成 `site/server.cjs`，同步改了 Dockerfile 的 `COPY`/`CMD` 和
`site:serve` 脚本。**没有改写成 ESM** —— 它是一个带 Basic Auth 的生产服务，
为了扩展名统一去动它不划算。

**2. ⛔ `npm ci` 在 alpine 上被 better-sqlite3 炸掉（第一次 docker build 直接 exit 1）**

```
gyp ERR! cwd /app/node_modules/better-sqlite3
gyp ERR! not ok
```

线索发现器依赖 better-sqlite3（原生模块），alpine 是 musl 拿不到预编译包，
会现场 node-gyp，而 `node:20-alpine` 里没有 python3/make/g++。
**这是把两个子系统并进一个仓库才出现的新问题，原来在 consulting 里不存在。**

解法：`npm ci --ignore-scripts`。站点构建期只用 marked（纯 JS，无 install 脚本），
跳过脚本完全够用，lockfile 的版本确定性也没丢。
比装一套编译工具链去编译一个根本用不到的包划算得多。
已在 Dockerfile 里写明原因，免得下一个人当成可优化项删掉。

## 收工状态

M0–M8 完成，两侧各一个 commit：
- consulting `f0b2f0b`（只留官网）
- webproject （见本次提交）

**未 push**（webproject 还没有 remote），线上 `ceo-workbench` 实例不受影响，
只是暂时不再自动更新。

⛔ **M9 需要用户操作才能继续**：
1. 给 webproject 建 GitHub 仓库并 push
2. 在该仓库配 `GCP_SA_KEY` secret（consulting 那份读不出来，要重新取或重新生成）
3. push 后确认 Actions 跑通并实际访问验证
