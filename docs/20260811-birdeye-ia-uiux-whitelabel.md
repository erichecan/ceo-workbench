# Birdeye 深度调研：白标可行性 · 信息架构 · UI/UX 设计系统

调研日期：2026-08-11
调研方法：sitemap 解析 + 官方 API 文档（Apiary）+ 实时页面 CDP 取样（计算样式 / DOM 结构 / 截图）
一手来源：birdeye.com（robots.txt / sitemap / 各产品页）· developers.birdeye.com（Apiary blueprint）· developers.tiktok.com · ayrshare.com

> 承接 `20260807-gbp-reviews-saas-tasks.md` 的「社媒竞品调研」章节。
> ⚠️ **本次调研修正了该章节的一条记录**，见第五节。

---

## 一、结论先行（五条）

1. **`/retail/` 存在，而且是一整套 12 个行业页的模板化产物**，不是孤例。
2. **Birdeye 提供白标，但那是「转售它的平台」，不是「给你 API 做自己的产品」。** 两者是完全不同的生意。
3. **Birdeye 的公开 API 确实能发 Facebook / Instagram，但没有 TikTok。** 全站 TikTok 只出现在免费 AI 文案生成器和词条页里，不是发布集成。
4. **TikTok 只能自己接官方 API 或走 Ayrshare 这类聚合器**，且 TikTok 官方 API 有一条硬约束：**未过审的 client 发出的所有内容强制为私密可见**。
5. **官网定价页现在是纯留资，站上不存在任何公开价格。** 台账里 `$299/$349/$449` 已无法从官网证实。

---

## 二、`/retail/` 与行业页体系

12 个行业页（`Solutions` 菜单全量，实测 HTTP 200）：

| 路径 | 路径 | 路径 |
|---|---|---|
| `/automotive/` | `/home-services/` | `/restaurants/` |
| `/dental/` | `/legal/` | `/retail/` |
| `/financial-services/` | `/property-management/` | `/public-storage/`（Self Storage） |
| `/healthcare/` | `/real-estate/` | `/wellness/` |

`/fitness/` → 404。**行业清单是封闭的，只有菜单里这 12 个**，没有长尾行业页。

行业页是**同一个模板灌不同素材**：Hero 换实拍照 + 换标题 → 数据卡换数字 → 7 个产品能力区块（顺序完全一致）→ Integrations → 案例 → Resources → FAQ → 页脚。

对我们的意义：**行业页不是内容工作，是模板工作。** 做好 1 个，剩下的是填素材。

---

## 三、白标与 API：三条路，各有硬约束

### 路 A —— Birdeye Reseller 白标（转售别人的产品）

`birdeye.com/partners/resellers/` 原文：

> **White Label Options** — Choose to whitelabel the platform or use it in a co-branded way.

代理商侧能力：
- **Command Central Dashboard**：全客户账号健康度、采用率、ROI 报表一屏
- **Error Alerts**：低采用率、集成断开的主动告警
- **Bulk Social Publishing**：按行业/地区/主题把客户分组，一次给**数百个客户**排期发帖
- **Reseller-level Listings** / **Agency Reporting** / 专属 partner success manager

**代价**：你拿到的是「换成你 logo 的 Birdeye」。产品形态、路线图、数据结构、定价空间都在对方手里，且你会被锁在它的能力边界内（比如 TikTok，它自己就没有）。

### 路 B —— Birdeye Public API（拿它当管道，做自己的产品）

- 入口 `developers.birdeye.com`（Apiary 托管的 iframe，静态抓不到，需浏览器）
- 认证：`x-api-key` 请求头，密钥从 Birdeye 后台取，**强制后端调用**，禁止前端暴露
- 分页：`sindex` + `count`，窗口不得超过 10 万

**Social 组端点**：

| 端点 | 能力 |
|---|---|
| Schedule Social Post | 立即发或定时发，可带媒体 |
| Edit scheduled Social Post | 改定时帖；`subBusinessNumbers` 增减门店 = 增减投放 |
| Edit published social Post | 已发布的只能改文字，且**仅 Facebook / Google / LinkedIn** |
| Delete public social Post | 删定时或已发；删已发**仅 FB / Google / LinkedIn** |
| Track Social Post | 用 `trackingId` 查跨平台投放状态 |
| Social Open URL Performance Report | 渠道级表现指标 + 同比区间对比 |

**支持渠道：Google Business Profile / Facebook / Instagram / LinkedIn / Twitter。⛔ 无 TikTok。**

另外注意 Business 组第一条：`Create a business API creates a new business under a reseller.` —— **API 本身就是按 reseller 层级建模的**。也就是说路 B 大概率不是「买个 SaaS 订阅拿 key 就能白标」，实际仍要先进 reseller 体系。这条需要向 Birdeye 销售确认（见第七节待确认清单）。

其余可用 API 组（对我们现有 GBP/评价 SaaS 有直接价值）：Reviews（含 Review Reply）· Listing · Google Q&A · GMB Products · Aggregation（150+ 评价站）· Competitor / Competitor AI · Insight AI · Webhook · Conversation · Ticketing。

### 路 C —— 直连官方 API / 第三方聚合器（TikTok 唯一通路）

| 方案 | 覆盖 | 成本 | 硬约束 |
|---|---|---|---|
| **Meta Graph API** | FB Page + IG Content Publishing | 免费 | 需 App Review；IG 必须是 Business/Creator 账号且绑定 FB Page |
| **TikTok Content Posting API** | TikTok | 免费 | ⛔ **未过审 client 发出的内容一律强制私密可见**，必须提交 audit 才能公开发布。需 `video.publish` scope 审批 |
| **Ayrshare** | FB / IG / TikTok / LinkedIn / X / YouTube / Pinterest / Threads / Bluesky / Reddit 等 | 见下 | 明确面向「嵌入你的产品」，按 social profile 计费 |

**Ayrshare 计价模型**（1 个商家 = 1 profile，该商家接多少平台都算 1 个；连锁每个独立发帖的门店算 1 个）：

| 档 | 价格 | 含量 |
|---|---|---|
| Premium | $149/月 | 1 profile |
| — | $299/月 | 10 profiles |
| Business | $599/月起 | 30 profiles，第 31 起 $8.99/个；101–500 $3.49/个；500+ $2.49/个 |
| Enterprise | 面议 | 300+ |

加购：白标 +$300/月，扩额 +$100/月（Business 档可选，Enterprise 含）。28 天免费试用。

**对我们的成本地板测算**：
- 10 个商家 → $299/月 ≈ **$29.9/商家/月**
- 30 个商家 → $599/月 ≈ **$20/商家/月**
- 100 个商家 → $599 + 70×$8.99 = $1,228/月 ≈ **$12.3/商家/月**

⚠️ 这只是**管道成本**，不含内容生产、人工审核、我们自己的服务成本。台账里「社媒加购 +$149/月报不出去」的结论不变；**成本地板反而比原先估的更高**。

---

## 四、信息架构（IA）

### 主导航（5 项 + 电话 + Sign In + 主 CTA）

```
Platform ▾   Solutions ▾   Partners   Resources ▾   Pricing
                                    ☎ 1 800 561 3357  ·  Sign In  ·  [Check My AI Visibility]
```

- **Platform ▾**：FEATURED（Reviews AI / Listings AI / Social AI / Search AI `NEW` / Marketing Automation `NEW` / Insights AI）+ See all Products · Platform · BirdAI `NEW` · Integrations · Google Partnership
- **Solutions ▾**：12 个 Industries（单列，无二级）
- **Resources ▾**：三列
  - *Learning*：Birdeye View `NEW` / Blog / Guides / Webinars / **Scan Your Brand** `NEW` / **Local SEO Audit** / Press / Videos / Podcast / Glossary / **Social Media Tools**
  - *Customer stories*：Case Studies / Birdeye Results / Our Reviews / Awards / Customer Heroes / Advocacy Program
  - *Objectives*（**纯 SEO 着陆页列**）：Google for local business / Review Management / Business Listing Management / Online Reputation Management / Review Generation / Google Reviews / Google My Business / Customer Experience / Website Chat / Customer Messaging / Referral Marketing / Social Media Management / Facebook Reviews
- **Partners**：`/partners/` · `/partners/integrations/` · `/partners/resellers/` · `/partners/strategic-alliances/`

**值得抄的一点**：`Objectives` 这一列把「用户搜什么词」直接做成导航项，和产品命名（Reviews AI）分开。产品名归 Platform，搜索词归 Resources。**同一个功能有两套入口、两套命名。**

### 产品页有二级 sticky 子导航

Social AI 页面顶部第二行常驻：`Overview | Publishing and Scheduling | Engagement | Analytics and Reporting`。产品复杂度高时，一页承载全部内容 + 锚点子导航，而不是拆成多页。

### SEO 资产规模（sitemap 实测）

| sitemap | 条目数 | 内容 |
|---|---|---|
| `sitemap.xml` | 2,029 | 营销站全部 |
| `sitemap0/1/2.xml` | 32,772 + 40,000 + 35,448 = **108,220** | 商家公开档案页（`birdeye.com/<business-slug>`） |

营销站 2,029 条的构成：

| 段 | 数量 | 说明 |
|---|---|---|
| `/integration/` | **823** | 每个第三方软件一页（最大的单一 SEO 板块） |
| `/resources/` | 454 | 指南/白皮书/网研会 |
| `/updates/` | 269 | 产品更新日志（当内容做） |
| `/glossary/` | 129 | 名词词条（含 `tiktok`、`tiktok-ads`） |
| `/press/` | 116 | 新闻稿 |
| `/careers/` | 38 | |
| `/social-media-tools/` | **19** | 免费 AI 生成器获客（TikTok/IG/FB/YouTube 的 caption / bio / username generator） |
| `/alternatives/` | 13 | `podium-alternatives` `yext-alternatives` `soci-alternatives` … |
| `/compare/` | 12 | `birdeye-vs-podium` `birdeye-vs-yext` … |
| `/tools/` | 5 | 竞品评价页（`podium-reviews` 等） |

**三层竞品拦截**：`/compare/birdeye-vs-X/`（对比）+ `/alternatives/X-alternatives/`（替代品）+ `/tools/X-reviews/`（竞品口碑）。同一个竞品最多被三个页面拦截。

**10.8 万个商家档案页是他们真正的护城河** —— 每个客户商家自动生成一个可被搜索的公开页，客户越多站权重越高，反过来又成为销售话术。

---

## 五、⚠️ 对台账的修正

`20260807-gbp-reviews-saas-tasks.md` 的「社媒竞品调研」表格记录：

> Social 单店 **$50/月加购**；主产品 Starter/Growth/**Dominate** = **$299/$349/$449 USD**

**2026-08-11 复核结果**：`birdeye.com/pricing/` 已改为**纯留资表单**（「Number of locations」→「GET PRICING」），页面 DOM 内不存在 `Starter` / `Growth` / `Dominate` 字样，也不存在任何价格数字。

**影响**：台账第三条硬冲击「档位命名与价格带撞车」的论据（Birdeye 三档 $299/$349/$449）**目前无法用官网一手来源证实**，应降级标注为「历史/三方来源，未复核」。定价对标结论需要重新找证据（Vendr / G2 / 客户合同截图 / 直接问销售）。

台账另外两条冲击（+$149 报不出去、功能差异化不成立）**不受影响，反而被本次调研强化**——见第三节的成本地板测算。

---

## 六、UI/UX 设计系统（可直接落地的规格）

### 技术栈

Next.js（robots.txt disallow `/_next/*`）+ Emotion（`css-1exmqi8` 这类生成类名）+ Bootstrap 5 底子（`--bs-*` 变量全在）。

### 字体

| 用途 | 值 |
|---|---|
| 全站 | **Poppins**, sans-serif（1,148 个可见节点，绝对主导） |
| 图标 | icomoon（自建图标字体） |
| 正文 | `16px / 400 / line-height 24px` |

**字号阶梯**（按出现频次排序，即实际使用的 type scale）：

```
12px/500        标签、eyebrow、微文案（最高频，64 次）
16px/400/24px   正文（52 次）
16px/500/24px   强调正文
20px/500/26px   卡片小标题
14px/500        按钮、导航
28px/500/33.6   区块副标题
36px/400/39.6   区块主标题 h2
24px/400/28.8   
```

注意：**几乎没有 700 粗体**，最重只到 500。视觉重量靠字号拉开，不靠字重。这是「商业风不显廉价」的关键之一。

### 配色（`:root` 实测变量）

```css
/* 品牌 */
--be-blue:        #1976d2;   /* 主色 = Material Blue 700 */
--be-blue-hover:  #1976d21a; /* 10% 透明底 */
--primary-hover:  #135aa0;
--deep-blue:      #135fba;
--beed-blue:      #0d47a1;
--pale-blue:      #f1f6fa;   /* 浅蓝分区底 */

/* 中性（这是重点：灰阶极其细分） */
--black-21: #212121;  /* 正文黑 + 页脚/深区底色 */
--grey-33: #333333;   --grey-44: #444444;   --grey-54: #545454;
--grey-55: #555555;   --grey-61: #616161;   --grey-66: #666666;
--grey-76: #767676;   --grey-88: #888888;   --grey-99: #999999;
--grey-cc: #cccccc;   --grey-dd: #dddddd;   --grey-e2: #e2e2e2;
--grey-ef: #efefef;   --grey-f0: #f0f0f0;   --grey-f4: #f4f4f4;
--grey-f8: #f8f8f8;   --grey-f9: #f9f9f9;   --grey-fa: #fafafa;
--grey-89: #8993a4;   --grey-60: #4D5360;   --grey-df: #dbdddf;

/* 语义 */
--green: #34a851;  --red-436: #f44336;  --bright-orange: #f57c00;
--golden-yellow: #F8A901;  --navy: #1a0dab;

/* 新一代（canary 系，看得出正在做设计系统迁移） */
--canary-grey-3e: #3E424D;  --canary-grey-71: #717580;
--canary-blue-e9: #E9ECF3;  --canary-purple: #AF51DE;
--canary-green-249: #249452; --canary-yellow-ffa: #FFA824;

/* 暖色系（用于特定区块背景） */
--creamy-bg: #FAEFE4;  --isabelline: #f4f0eb;  --grey-sand-light: #FBFAF9;
--charcoal: #302E2D;   --stone-grey: #625E5B;
```

实际渲染中出现频次最高的背景色：`#ffffff`(56) → `#fafafa`(26) → `#f6f5f3`(10) → `#f4f6f9`(6) → `#edeeef`(6) → `#1976d2`(5)。

**读数：整站基本是白底 + 极浅灰。蓝色只出现在按钮、链接、图标 —— 是点缀，不是背景。**

### 圆角（最强的风格识别信号）

| 半径 | 出现次数 | 用途 |
|---|---|---|
| **30px** | 43 | 药丸按钮、标签 |
| **20px** | 19 | 中卡片 |
| **10px** | 17 | 小卡片、输入框 |
| **40px** | 14 | 大图片容器、大卡片 |
| 8px | 10 | |
| 16px | 9 | |

**这套设计的性格 = 大圆角。** 图片不是方的，是 40px 圆角的；按钮不是 4px 圆角，是完全药丸形。如果只抄一件事，抄这个。

### 区块节奏

- 每个 `<section>` 上下 padding **80px**（Hero 上 180px）
- 单个 section 高度 **500–950px**
- **几乎全部白底**——分区靠圆角卡片和图片，**不靠背景色交替**
- 页面总高 ~14,700px（Social AI 页 19 个 section）

### 组件规格

**行业页 Hero**（`/retail/` 实测）：
```
整块大圆角实拍照（40px radius，宽度撑满容器）
  └ 左侧悬浮白卡（20px radius，白底，投影）
       INDUSTRY               ← 深灰药丸标签，白字，12px/500
       Reputation & CX Software for Retail   ← eyebrow，灰色 16px
       There's a better       ← h1，约 48px/500，三行断行
       review platform in
       store
       Get more reviews...    ← 副文案 16px/400，3 行
       [ Enter your business email ][ WATCH DEMO ]  ← 内联表单，整体 pill 边框
       ★★★★★  Google  G2  Capterra   ← 星级 + 三个第三方 logo
```
**首屏就要邮箱**，而且 CTA 是 `WATCH DEMO` 不是 `GET STARTED` —— 降低承诺压力。

**内容区块**：左图右文 / 右图左文交替。图片是**真实场景照片 + 叠加 UI 气泡**（如照片上浮着「Generate social posts & images」「What is the best time to post on Facebook?」这类白色圆角小气泡，带 AI 图标）。

> 这是全站最值得学的一招：**不放产品截图，放「真实生意场景 + 产品的一句话」**。截图让人看功能，这个让人看「我的店在用它」。

**数据卡**：深色实拍照做底 + 巨大百分数（`335%` / `1,498%` / `1,146%`）+ 一行说明，白字，20px 圆角，三卡并排。

**页面收尾固定五件套**：
```
Do more with [产品] → Birdeye customers get results（案例）
→ Related Products → FAQ（带结构化数据）→ Resources
→ 面包屑（深色条 #212121，100px 高）→ 巨型页脚（1,342px 高）
```

**页脚**是四大列全站地图：Awareness/Conversion/Experience 三组产品 + Platform + Industries(12) + Tools + Company + 区域选择 + 6 个社交图标 + 合规链接（Terms / Privacy / Security / GDPR / HIPAA / CCPA / AI Policy）。

**合规链接单独成组**是 B 端信任设计的标配 —— HIPAA / GDPR / CCPA 各有独立页面。

---

## 七、待向 Birdeye 确认的问题（如果真要走白标）

1. Reseller 白标的**最低承诺量**和**批发价**是多少？
2. 白标是否包含**自定义域名**和**去 Birdeye 品牌的邮件/短信模板**？
3. Public API 是否**独立可购**，还是必须先成为 reseller？（Business 组 API 文档暗示后者）
4. Social API 的 **rate limit** 具体数字（文档写「connect with support team」，未公开）
5. TikTok 是否在路线图上？有无时间表？
6. 数据可携性：终止合作时，商家的评价/内容/授权 token 能否导出？

---

## 八、要复刻这套「商业风」，我还需要的信息

分五类。**打勾的类别越全，我能一次做到位的程度越高。**

### A. 品牌与视觉资产（最卡人的一类）
- [ ] Logo 矢量文件（SVG/AI），含横版、方版、单色版
- [ ] 品牌主色是否已定？还是我来提案？（Birdeye 用 #1976d2，我们若也用蓝会显得像仿品）
- [ ] **中文字体怎么定** —— 这是中英混排项目最容易翻车的点。Poppins 是免费西文字体，**没有对应的中文字重**。中文用思源黑体/HarmonyOS Sans/阿里巴巴普惠体（免费可商用），还是买字库？中英混排的基线和字重要对齐，必须先定。
- [ ] 是否要保持「大圆角 + 只到 500 字重」这套性格，还是要做出区别？

### B. 内容与证据（决定页面可不可信）
- [ ] 真实客户案例：几个？能否具名？能否露出行业和门店数？
- [ ] 可公开的效果数字（Birdeye 用 335% / 1498% 这种大数字撑数据卡）——我们有没有可举证的？没有的话这个区块要换成别的
- [ ] **实拍照片**：有没有真实商家场景照（且拿到肖像/门店授权）？没有就只能用图库，图库照片是「显廉价」的最大来源
- [ ] 第三方背书：G2 / Capterra / Google 评价我们有没有？没有的话首屏那排 logo 放什么？
- [ ] FAQ 内容（至少 6–8 条，且要真的是客户会问的）

### C. 商业决策（必须你拍板，我推不出来）
- [ ] **对谁说话**：直接对商家（B2C 式 SMB），还是对同行代理商（B2B2C 转售）？两者的 IA、话术、定价展示完全不同
- [ ] **价格公开还是留资**？Birdeye 已经全面转向留资；但 `20260805-数字营销竞品调研.md` 的结论是「公开价格本身就是信任状」——**这两条是冲突的，需要你选一边**
- [ ] 行业页做几个？我们的实际客户集中在哪几个行业（餐饮 / 装修 / 牙科 / 美业 / 律所…）？
- [ ] **双语还是只中文**？现有仓库已有 `i18n/` 和 `messages/`，说明原本是双语架构——这套新页面是并入还是独立？
- [ ] 主 CTA 是什么？（Birdeye 是「Check My AI Visibility」这种免费诊断——我们已经有 `local-seo-audit` 类的想法，要不要复用）

### D. 技术边界
- [ ] 这套页面**并入现有 consulting 仓库**（Next.js 已就绪），还是独立站？
- [ ] 内容要不要走 CMS？（行业页 12 个 × 频繁改文案 → 硬编码会很痛苦）
- [ ] 部署目标：仍是 Cloud Run？还是静态托管？
- [ ] SEO 要做到什么程度？（要不要做 `/compare/` `/alternatives/` 这种竞品拦截页——这是 Birdeye IA 里最赚的部分，但需要持续产内容）

### E. 范围与节奏
- [ ] 第一版做几页？建议最小可见成果 = **首页 + 1 个行业页 + 定价页**（三页足以定死整套设计语言，剩下的是复制）
- [ ] 有没有 deadline 或要给谁看的时间点？

---

## 附：截图与原始数据

本次调研的截图与抓取原文存放于本会话临时目录（不入库）：
`be-social.png`（Social AI 页首屏）· `be-retail.png` / `be-retail2.png`（Retail 行业页）· `apiary.txt`（API 文档全文）· `resellers.md` · `ayr.md` · `tt.md`
