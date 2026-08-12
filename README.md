# 建站线索发现器（webproject）

每天从小红书捞出「在找人做网站」的人，逐条判断值不值得联系、该做什么 demo、第一句话怎么说。

**位置**：`AIcoding/webproject/`，独立仓库
（2026-08-12 从 `businessskills/webproject/` 迁出）。
本项目**自包含**——不读 businessskills 的任何文件，数据全在自己的 `data/`。
代码注释里提到 businessskills 的地方，指的是从那边借鉴的做法，不是运行时依赖。

```
搜索词 / 链接  →  scraper  →  SQLite  →  analyzer(AI)  →  每日 HTML 报告
                                            ↓
                                 分数 · 需求 · demo 方向 · 跟进草稿
```

## 快速开始

```bash
cd /Volumes/datacenter/04-eric/AIcoding/webproject
npm install
cp .env.example .env          # 全部留空也能跑，默认走订阅额度、零 API 费用

# 另开一个终端，启动浏览器代理（小红书的登录态在它控制的 Chrome 里）
node ~/.claude/skills/web-access/scripts/cdp-proxy.mjs

npm run doctor                # 自检：代理通不通、provider 配没配
npm run daily                 # 抓取 → 分析 → 出报告
open reports/$(date +%Y%m%d)-leads.html
```

### 登录是硬前提（2026-08-11 实测）

两种抓取模式对登录态的要求**不一样**：

| 模式 | 未登录时 | 说明 |
|---|---|---|
| `--url` 单篇 | ✅ 可用 | 实测抓 2 篇拿到 21 条（正文 + 评论），完整 |
| `--keyword` 搜索 | ⛔ **必被拦** | 首页匿名能出 30 张卡片，但搜索页直接弹安全验证 |

也就是说**搜索模式必须先登录**。在 CDP Proxy 控制的那个 Chrome 里手动扫码登录 `www.xiaohongshu.com`，一次即可，cookie 会留着。**本项目不存、也不要 cookie，更不会替你登录。**

判断有没有登录：

```bash
npm run doctor          # 只查代理和 provider
# 看登录态就直接在那个 Chrome 里打开 xiaohongshu.com，右上角还显示「登录」就是没登
```

撞到安全验证时脚本会立刻终止整轮并提示你去手动过验证。**不要改成自动重试** —— 未登录时重试多少次都是同一个结果，只会把账号推得更近封禁。

## 命令

| 命令 | 作用 |
|---|---|
| `npm run scrape` | 抓取。`-- --keyword "帮客户做网站"` 指定词，`-- --url "https://..."` 抓单篇 |
| `npm run analyze` | 分析未处理的线索，`-- --limit 20` |
| `npm run report` | 生成日报，`-- --today --min-score 50` |
| `npm run daily` | 三步一条龙 |
| `npm run list` | 命令行看线索，`-- --min-score 70 --status new` |
| `npm run doctor` | 自检 |
| `node src/cli.js status <id> contacted "已私信"` | 更新跟进状态 |

不带 `--keyword` 时用 `src/config.js` 里的默认词表（帮北美客户做网站 / 求推荐做网站 / 找人做网站 …），长期维护直接改那里。

## 三个设计决定

### 为什么不用 puppeteer / playwright

小红书这条链路的难点不是「驱动浏览器」，是**登录态**和 **xsec_token**：

- 详情页**不能直连**。搜索结果卡片的 href 是 `/search_result/<id>?xsec_token=…`，这个 token 是访问详情的必需参数；直接开 `/explore/<id>` 返回空壳。所以必须在搜索页内 `click a.cover` 打开。
- 一个新起的 puppeteer 实例没有登录态，搜索页要么空白要么跳登录页 —— 而**抓到 0 条**和**本来就没结果**长得一模一样，是这条链路最容易的静默失败。

仓库里 `scripts/xhs-probe/probe.py` 已经把这些坑一个个踩平了，走的是 web-access skill 的 **CDP Proxy**（`localhost:3456` 的 HTTP 接口，语言无关）。本项目复用同一个代理、同一个浏览器、同一份登录态，只是把调用方从 Python 换成 Node。`src/scraper.js` 里的页面取数 JS 直接移植自 `probe.py`，那些选择器是在真页面上试出来的，不是照 DOM 猜的。

### 反封控参数不要动

默认值抄自 `probe.py` 的实测配置：

| 参数 | 默认 | 含义 |
|---|---|---|
| `MAX_KEYWORDS_PER_RUN` | 5 | 单轮最多几个搜索词 |
| `NOTES_PER_KEYWORD` | 3 | 每个词点开几篇笔记 |
| `DELAY_BETWEEN_KEYWORDS` | 45–90 秒 | 词与词之间随机停多久 |

**撞到「安全验证」时本轮立刻整体终止**，不重试、不换词硬撑 —— 硬撑是把账号推向封禁的最快方式。调大这些数字等于拿账号赌，改之前先想清楚赌注。

### 跟进话术只出草稿，永不代发

小红书 2026-03-10《关于打击AI托管运营账号的治理公告》禁止「利用技术手段模拟真人、进行非真实内容创作或虚假互动」；2026-06-10《关于规范搜索及问答生态相关行为的公告》进一步禁止「通过评论区配合、账号矩阵联动等方式人为制造口碑」，处置为降权、下架、封禁。

所以这个工具做的是**不模拟真人的那部分**：读、判断、写草稿。首评和私信的最后一下由本人点发送。`src/analyzer.js` 的 prompt 里也写死了：不许伪装成普通用户、不许假装自己也遇到同样问题、不承诺结果、不报价。

这和仓库里 `scripts/xhs-comment/draft_comments.py` 是同一个形状。

## AI provider

`.env` 里的 `AI_PROVIDER` 三选一：

| 值 | 说明 | 费用 |
|---|---|---|
| `cli`（默认） | headless `claude -p`，走 Claude Code 订阅额度 | **零 API 费用** |
| `anthropic` | `api.anthropic.com`，需 `ANTHROPIC_API_KEY` | 约 $0.01–0.03 / 条 |
| `gemini` | Gemini REST，需 `GEMINI_API_KEY` | 按 token 计费 |

`cli` 模式沿用了仓库里已经调好的两个参数（见 `scripts/headless_cli.py`）：`--disallowedTools` 禁掉全部工具、cwd 指向空目录跳过 CLAUDE.md 与 skills 的自动发现。prompt 是自包含的，模型不需要任何工具；不禁掉它会去「找路」，每多一轮工具往返就多重写一次缓存。实测固定开销 46k → 38.7k token。

额度错误按 `scripts/claude_limits.py` 的三分类处理：**weekly 立刻停手**（要等到重置日，熬着纯空转），session / rate 才等 30 分钟重试。

## 评分口径

分数直接决定「今天先联系谁」的顺序，所以规则写死在 prompt 里，不让模型每次自由发挥：

| 分段 | 含义 |
|---|---|
| 90–100 | 本人明确在找人做网站，且给了行业 / 预算 / 时间 / 参考站点 |
| 70–89 | 明确有建站需求或对现有网站不满，细节不全 |
| 50–69 | 有苗头（在问怎么做、比较工具），但没说要外包 |
| 30–49 | 话题相关，本人没需求 |
| 15–29 | 招聘 / 求职 / 课程广告 |
| 0–14 | 同行自我推广 —— 竞争对手不是客户 |

`is_lead` 只有 ≥50 才可能为 true，且**依据必须能在原文里逐字引用**（报告里的「原文证据」一栏）。找不到可引用的原句，分数不得高于 40 —— 没有证据在场，读报告的人无从判断这条是不是模型编出来的。

**作者昵称是重要输入。** 小红书商家号的昵称经常直接写明行业，正文没提行业时它往往是唯一线索。实测同一条评论「我也想搭建一个网站」：不给模型看昵称时判 65 分 /「其他」/ 标「信息不足」；给了昵称 `Bing Fitness` 后判 72 分 /「预约系统」，demo 建议直接落到「周课表 + 在线约课两步完成」。

**50 分这条线不是硬线。** 同一条内容「用什么平台搭建？」，仅仅因为 prompt 多了一行昵称说明，两次跑出 45 分和 52 分 —— 跨过了 `is_lead` 阈值。边界附近的分数本来就会抖，别把 49 和 51 当成两类东西看。真正可靠的是两端：≥70 基本不会错杀，≤30 基本不会漏。中间那段建议自己扫一眼原文再定。

## 目录

```
src/config.js     集中配置 + .env 加载 + 默认词表 + demo 方向枚举
src/cdp.js        CDP Proxy 客户端
src/scraper.js    小红书抓取（搜索模式 / 单链接模式）
src/analyzer.js   AI 分析：评分 · 需求 · demo 方向 · 跟进草稿
src/storage.js    SQLite：leads（原始+跟进状态）/ analysis（AI 结果）
src/reporter.js   自包含 HTML 日报 + Markdown 摘要
src/cli.js        入口
data/             SQLite 库、抓取原始 JSON、截图（不入库）
reports/          生成的日报（不入库）
```

`leads` 和 `analysis` 分两张表，是因为生命周期不同：换了 prompt 想重跑分析，`DELETE FROM analysis` 就能重来，不用重付一次抓取成本，也不必再冒一次触发风控的险。

## 已知边界

- **搜索模式需要登录**，单链接模式不需要（见上）。没登录时 `npm run daily` 会在第一步就停。
- 只做小红书。加平台需要新写一个 scraper，`analyzer` / `storage` / `reporter` 不用动。
- 评论抓不到稳定 ID（详情页 DOM 里没有），用正文哈希去重；同一个人在不同笔记下发一模一样的话会被当成两条。
- 搜索结果页只有前排若干条，不翻页 —— 翻页是触发风控的高危动作。
- `CAPTURE_SCREENSHOT=1` 才存截图，默认关（体积大，且报告里链接已经够用）。
