# webproject

**位置**：`AIcoding/webproject/`，独立仓库。这个仓库装着两样东西：

| 子系统 | 是什么 | 入口 |
|---|---|---|
| **咨询式获客产线** | 挖同行评论区 → 判断对方生意缺什么 → 出诊断书 | `src/`，`npm run daily` |
| **CEO 工作台** | 任务看板 · 财务账本 · 文档中心，部署在 Cloud Run | `site/` `tasks/` `finance/` `docs/`，`npm run site` |

两者**互不依赖**：共用一个 `package.json` 和一条 npm 依赖树，除此之外没有任何代码耦合。
`.github/workflows/deploy-ceo-site.yml` 用 `paths` 过滤器隔开，改线索发现器不会触发站点部署。

迁移沿革：获客产线 2026-08-12 从 `businessskills/webproject/` 迁出；
CEO 工作台同日从 `consulting/` 迁入（那边现在只留公司官网）。

---

## 一、咨询式获客产线

每天从**同行建站服务商的推广笔记**下面捞人：在那儿留言的人，购买意向已经默认
存在且正在比价。然后拉他的主页，判断他在做什么生意、那门生意**真正缺什么**，
出一页诊断书，再由本人手动私信。

本部分**自包含**——数据全在自己的 `data/`。

```
opencli search "<同行推广词>"   →  同行笔记（url 自带 xsec_token）
        ↓
opencli comments <note-url>    →  评论 + userId + profileUrl + IP属地
        ↓
   L1 粗筛（便宜，全量跑）      →  地域过滤 + 这个人在做什么生意
        ↓
opencli user <userId>          →  他主页最近的笔记标题
        ↓
   L2 生意诊断                  →  行业 · 规模 · 现有资产 · 真正瓶颈 · 推荐产品
        ↓
   一页诊断书 HTML  +  私信草稿（永不代发）
```

### 为什么是「诊断」而不是「报价」

同行的打法只有两种：报价，和说自己技术好。没有人在客户付钱之前分析客户的生意。

1. **诊断先白送。** 对方一分钱没付，就已经看到自己生意的问题被说中了。
   模板店和接单个人不是不会，是售前不敢投入这个成本 —— 我们的成本是 AI 时间。
2. **分析决定卖什么，不只是怎么卖。** 同行只能卖网站（一锤子 299–499）。
   识别出这家健身房真正缺的是在线约课，那就是预约系统 —— 客单价高一档，能收月费。

设计与实施记录见 `docs/20260812-咨询式获客产线-design.md` 和同名 `-tasks.md`。

## 快速开始

```bash
cd /Volumes/datacenter/04-eric/AIcoding/webproject
npm install
cp .env.example .env          # 全部留空也能跑，默认走订阅额度、零 API 费用

npm run doctor                # 自检：opencli 通不通、登录态真的有效吗
npm run daily                 # 抓取 → L1 → 主页 → L2 → 报告
open reports/$(date +%Y%m%d)-leads.html
```

### 登录是硬前提

抓取全部走 **opencli**（项目 CLAUDE.md 强制）。它通过 Chrome 扩展附着到你**日常那个
Chrome** 的 profile，用的就是平时刷网页的 cookie —— 不像 Playwright 那样起一个干净
实例，每次调试都要重新扫码。

⚠️ **`opencli auth status` 不能当真相**：它只 quick check cookie 存不存在，不验有效性。
实测出现过它报 `logged_in: true` 而真实请求直接 `AUTH_REQUIRED`。

所以 `npm run doctor` 里验登录态的方式是**跑一条真实的只读命令**（`search --limit 1`）。
自检报绿而产线跑空，是最坏的一种失败。

登录过期时：`opencli xiaohongshu login`（会在浏览器里开登录页等扫码，需要你参与）。

**本项目不存、也不要 cookie，更不会替你登录。**

## 命令

| 命令 | 作用 |
|---|---|
| `npm run scrape` | 搜同行推广词抓评论区。`-- --keyword "帮客户做网站"`，`-- --url "https://..."` 抓单篇 |
| `npm run analyze` | L1 粗筛：地域过滤 + 这个人在做什么生意，`-- --limit 20` |
| `npm run profiles` | 拉评论者主页笔记标题，`-- --limit 8`（风控成本最高，有硬上限） |
| `npm run diagnose` | L2 生意诊断 + 生成诊断书，`-- --limit 8` |
| `npm run report` | 生成日报，`-- --today --min-score 50` |
| `npm run daily` | 上面五步一条龙 |
| `npm run list` | 命令行看线索，`-- --min-score 70 --status new` |
| `npm run doctor` | 自检 |
| `npm test` | 单元测试（`node:test` 内置，无测试框架依赖） |
| `node src/cli.js status <id> contacted "已私信"` | 更新跟进状态 |

不带 `--keyword` 时用 `src/config.js` 里的默认词表（全是**同行推广词**，不是需求词）。

## 五个设计决定

### 为什么走 opencli 而不是 puppeteer / playwright

小红书这条链路的难点从来不是「驱动浏览器」，是**登录态**和 **xsec_token**：

- 详情页**不能直连**。`/explore/<id>` 直接开返回空壳，必须带 `xsec_token`。
- 一个新起的 puppeteer 实例没有登录态，搜索页要么空白要么跳登录页 —— 而**抓到 0 条**
  和**本来就没结果**长得一模一样，是这条链路最容易的静默失败。

**opencli 把这两样都兜住了**：`search` 返回的 `url` 和 `author_url` 本身带 token，
`comments` 直接吃这个 url。站点改版由适配器负责，不用自己修 DOM 选择器。

（2026-08-12 之前这里走的是 CDP Proxy + 手写选择器，`src/cdp.js` 已随之退役。）

### 为什么搜同行推广词，不搜需求词

旧口径搜「找人做网站」这类需求词，捞到的是零散喊话的人 —— 实测命中率
**31 条线索里只有 2 条值得联系**。

改搜同行推广词后，捞到的是**已经在比价的人**。2026-08-12 实测「帮客户做网站」
搜索结果前 3 条全是同行推广帖（渥太华网站、FlamingoTech北美商家帮…）。

### 选笔记按相关性，不按点赞

⛔ 这条和直觉相反，改之前先读完。

搜需求词时按赞排是对的（高赞需求帖评论多）。搜**同行推广词**时正好反过来 ——
推广帖是广告，赞数天然低。实测 rank 1-3 是三篇同行推广帖（6 / 6 / 36 赞），
而 rank 4 是一篇 4597 赞的「请不要再做 App、网站、小程序了」技术讨论帖。

按赞排就只会抓到那篇讨论帖，评论区全是开发者聊 agent，**一个客户都没有**。
所以按 rank 取前 N，并用 `MAX_NOTE_LIKES`（默认 200）把爆款帖滤掉。

### 两级分析：便宜的先做

主页访问是整条链路里风控成本最高的动作，所以不能对每条评论都做。

- **L1** 吃评论文本 + 昵称 + **IP 属地**，判断值不值得深挖。免费的过滤先做：
  属地来自 `comments` 的 `time` 字段（形如 `03-02美国`），抓取时就在手里，
  而 score 要花一次 AI 调用。非北美的直接 25 分跳过。
- **L2** 才花主页配额（`MAX_PROFILES_PER_RUN`，默认 8）。

**昵称会骗人，笔记标题不会。** 实测账号昵称叫「造梦设计师01」，只看昵称会判成
设计从业者；6 篇笔记标题全是追星内容 —— 粉丝号，根本不是生意。
反过来同一条评论「我也想搭建一个网站」，给了昵称 `Bing Fitness` 后判断从
「其他」变成「预约系统」。两边都指向同一个结论：必须看主页。

**L2 会扑空是常态。** 部分账号没有公开笔记（销号 / 私密 / 全删），opencli 返回
`EMPTY_RESULT`。标记 `status=empty` 且**不重试** —— 重试改变不了对方的隐私设置。

### 只私信，绝不在同行笔记下留评论

小红书 2026-03-10《关于打击AI托管运营账号的治理公告》禁止「利用技术手段模拟真人、
进行非真实内容创作或虚假互动」；2026-06-10《关于规范搜索及问答生态相关行为的公告》
进一步禁止「通过评论区配合、账号矩阵联动等方式人为制造口碑」，处置为降权、下架、封禁。

所以这个工具做的是**不模拟真人的那部分**：读、判断、写草稿。私信最后一下由本人点发送。

⛔ **产线的线索全部来自同行笔记的评论区，在那儿留评论既是挖墙脚，又正好撞在
「评论区配合」这条上。** 因此代码里连产出公开评论草稿的字段都删掉了
（原 `analysis.first_comment`）—— 留着就还是一个能随手违规的口子。

## AI provider

`.env` 里的 `AI_PROVIDER` 三选一：

| 值 | 说明 | 费用 |
|---|---|---|
| `cli`（默认） | headless `claude -p`，走 Claude Code 订阅额度 | **零 API 费用** |
| `anthropic` | `api.anthropic.com`，需 `ANTHROPIC_API_KEY` | 约 $0.01–0.03 / 条 |
| `gemini` | Gemini REST，需 `GEMINI_API_KEY` | 按 token 计费 |

`cli` 模式沿用了已经调好的两个参数：`--disallowedTools` 禁掉全部工具、cwd 指向空目录
跳过 CLAUDE.md 与 skills 的自动发现。prompt 是自包含的，模型不需要任何工具；不禁掉它
会去「找路」，每多一轮工具往返就多重写一次缓存。实测固定开销 46k → 38.7k token。

额度错误分三类：**weekly 立刻停手**（要等到重置日，熬着纯空转），session / rate 才等
30 分钟重试。

## 评分口径（L1）

分数直接决定「今天先联系谁」的顺序，所以规则写死在 prompt 里，不让模型每次自由发挥。

**问的不是「他想不想做网站」，而是「他在做什么生意，那门生意缺什么」** ——
在同行推广帖下留言的人，意向已经默认存在了。

| 分段 | 含义 |
|---|---|
| 90–100 | 能看出具体生意（行业 + 规模），且明确在问价 / 问周期 / 问能不能做 |
| 70–89 | 能看出具体生意，表达了需求但没谈到细节 |
| 50–69 | 有需求信号但看不出做什么生意 |
| 30–49 | 围观、评价同行、替别人问 —— 本人不是买方 |
| 15–29 | 招聘 / 求职 / 课程广告 |
| 0–14 | 另一个同行在下面抢客 —— 竞争对手不是客户 |

`is_lead` 只有 ≥50 才可能为 true，且**依据必须能在原文里逐字引用**（报告里的「原文证据」
一栏）。找不到可引用的原句，分数不得高于 40 —— 没有证据在场，读报告的人无从判断这条
是不是模型编出来的。

**50 分这条线不是硬线。** 边界附近的分数本来就会抖，别把 49 和 51 当成两类东西看。
真正可靠的是两端：≥70 基本不会错杀，≤30 基本不会漏。

## 产品线与诊断书（L2）

| 产品线 | 48h 产线 | 适用 |
|---|---|---|
| 官网 | ✅ | 只需要能被搜到、能展示 |
| 预约系统 | ✅ | 生意靠排期（健身、美业、诊所、教育、上门服务）。能收月费 |
| 会员积分 | ✅ | 生意靠回头客（餐饮、零售、美业）。能收月费 |
| 重线索 | ⛔ 走人工 | CRM / ERP / 对接现有流程，48h 出不了 demo |

诊断书是固定四段，顺序是一条说服链，**不要改**：

```
你的生意    Bing Fitness · 私教工作室 · 加拿大
我看到的    IG 有 3k 粉但没有落点；约课靠 DM 手动排
真正的瓶颈   不是没网站，是排课占掉你每天 1 小时
建议方案    预约系统 —— 生意靠排期，客人自己选时段比你回消息快
```

前两段建立「他真的看过我」，第三段给出他不知道的东西，第四段才落到产品。

⛔ **「真正的瓶颈」必须和对方自己以为的需求不同**，否则这份诊断没有存在价值 ——
他自己就知道他没网站。找不出这样一条时 `bottleneck` 留空，**不出诊断书**：
发一份和同行报价单没区别的东西，比不发更掉价。

诊断书不放价格、不放承诺、不放联系方式，自包含无外链（对方可能在墙内打开）。
生成在 `data/diagnoses/<slug>.html`（不入库，里面是对方的昵称和生意判断）。

**第二步的可点样板站，只在对方回复之后才做** —— 不回复就不投入，这是产线量能
铺开的前提。

## 目录

```
src/config.js     集中配置 + .env 加载 + 同行推广词表 + 产品线枚举
src/opencli.js    opencli 调用 + 错误分三类（auth / risk / empty）
src/geo.js        评论 time 字段解析、北美判定（纯函数）
src/scraper.js    搜同行笔记 + 抓评论区
src/analyzer.js   L1 粗筛：地域过滤 + 这个人在做什么生意
src/profile.js    拉主页笔记标题，处理扑空
src/diagnose.js   L2 生意诊断
src/diagcard.js   诊断书 HTML + slug
src/storage.js    SQLite：leads / analysis / profiles / diagnoses
src/reporter.js   自包含 HTML 日报 + Markdown 摘要
src/cli.js        入口
test/             单元测试（node:test）
data/             SQLite 库、抓取原始 JSON、诊断书（均不入库）
reports/          生成的日报（不入库）
```

四张表分开，是因为生命周期不同：换了诊断 prompt 想重跑，`DELETE FROM diagnoses`
就能重来，不用重付一次抓取成本，也不必再冒一次触发风控的险。

## 已知边界

- 只做小红书。加平台需要新写一个 scraper，其余各层不用动。
- 评论抓不到稳定 ID，用正文哈希去重；同一个人在不同笔记下发一模一样的话会被当成两条。
- 搜索结果只取前排，不翻页 —— 翻页是触发风控的高危动作。
- `opencli user` 不返回简介和粉丝数。不为这两个字段回退 CDP：笔记标题已经够判断行业。
- **真正的吞吐瓶颈是私信配额，不是抓取。** 一天能产 20 份诊断 ≠ 一天能发 20 条私信。
  排产要按账号实际能安全发多少条倒推 —— 生产比发货快没有意义。
- 诊断书目前只落在本地 `data/diagnoses/`。挂到 `idearise.ca/d/<slug>` 是跨仓库的事，
  单独排期（见 tasks 文档 T10）。

---

## 二、CEO 工作台

任务看板 + 财务账本 + 文档中心，编译成一个带 Basic Auth 的静态站，跑在 Cloud Run
（`ceo-workbench` / `supply-491510` / asia-east1）。2026-08-12 从 `consulting/` 迁入。

```
docs/*.md  +  tasks/board.json  +  finance/ledger.jsonl
        ↓  npm run site（构建期编译，marked 渲染 Markdown）
   site/dist/  →  site/server.cjs 提供服务
```

### 命令

```bash
npm run board -- check       # 看板不变量校验
npm run board -- next        # 下一件该做的事
npm run ledger -- check      # 账本不变量校验
npm run ledger -- status     # 财务概况
npm run site                 # 编译静态站到 site/dist/
SITE_USER=… SITE_PASS=… npm run site:serve    # 本地起服务（密码至少 10 位）
```

### 三个容易踩的点

1. **`site/server.cjs` 不能改回 `.js`**。本仓库 `package.json` 有 `"type": "module"`，
   而这个服务器用 `require` / `__dirname`。改扩展名是刻意的。
2. **`site/Dockerfile` 里的 `npm ci --ignore-scripts` 不能去掉**。线索发现器依赖
   better-sqlite3（原生模块），alpine 是 musl 拿不到预编译包，会现场 node-gyp 然后失败
   —— 而站点构建只需要 marked（纯 JS）。2026-08-12 实测去掉就 exit 1。
3. **`site/Dockerfile.dockerignore` 必须存在**（BuildKit 专用，故 workflow 里
   `DOCKER_BUILDKIT=1` 是必需的）。少了它会构建出一个「能访问但里面什么都没有」的空壳站。

### 看板与账本是构建期快照

`npm run site` 把当时的 `board.json` / `ledger.jsonl` 编译进静态页。
改了数据要重新 commit + 部署才会反映到线上，这是设计取舍不是 bug。
