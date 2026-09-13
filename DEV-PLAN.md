# DEV-PLAN：预约系统迁移 archive/beauty（NextGen Nail SaaS）

## 读取了哪些文档

- `/Volumes/datacenter/04-eric/AIcoding/_archive/beauty/REVERSE-PRD.md`（反向 PRD，三份原始 PRD 的实现对照）
- `/Volumes/datacenter/04-eric/AIcoding/_archive/beauty/DEV-REPORT.md`（Phase 2 完成报告）
- `/Volumes/datacenter/04-eric/AIcoding/_archive/beauty/DEPLOYMENT-GUIDE.md`
- `/Volumes/datacenter/04-eric/AIcoding/_archive/beauty/apps/web/prisma/schema.prisma`
- 本项目 `docs/20260912-预约系统技师排班与卡片分发-tasks.md`（当前 /schedule 页面的由来和已知遗留）
- 本项目 `package.json`（产品定位）、`.github/workflows/deploy-booking-portal.yml`、`portal/Dockerfile`

## ⚠️ 需要 Eric 确认的定性问题（不是技术细节）

两个产品，定位完全不同：

| | webproject（当前） | archive/beauty |
|---|---|---|
| 服务对象 | 还没成交的潜在客户（小红书私信里的美甲店主） | 已成交、要长期用管理系统的门店 |
| booking 的作用 | 获客道具——证明"我们能帮你把预约管起来"，用来促成交 | 正式产品本体 |
| 技术栈 | Node 原生 http server，单文件路由，SQLite/Postgres 直连 | Next.js 16 + Prisma 7 + Postgres，含 POS/会员积分/储值卡/多租户 |
| 数据模型 | 一个 lead = 一个潜在门店，字段贴合"卡片+预约" | 一个 Workspace = 一个已签约门店，字段贴合"全功能店铺运营" |

整体迁移 = 把这个工具从"获客道具"升级为"要卖给客户运营的正式 SaaS"。这本身可以是新业务线，但请确认这不是"为了让 /schedule 页面好看点"而顺带做的——那样投入和收益不成比例。

**已按你的决定执行的默认假设**（如果不对，回复里改掉，我按新的走）：
1. 目标不是"抄一个日历组件"，是把 archive/beauty 定性为 webproject 之后要正式售卖/托管的产品线，booking 子系统整体换血。
2. 生产环境（`booking-portal-dfd7b2qpra-de.a.run.app`，Neon Postgres `webproject-booking` 分支，已有真实客户预约数据）**不能中断、不能丢数据**——迁移期间新系统先在独立子路径/子域名跑通，验证过再切流量，旧系统留到确认无误再下线。
3. 只迁移 `apps/web`（唯一接了真实后端、Phase1+2 完整走通的实现：登录/日历排班/客户/团队/服务/结账/销售报表）。**不迁移** `apps/staff-dashboard`、`apps/customer-booking`（Vite 原型，REVERSE-PRD 里标记大量 ❌未实现/⚠️mock 数据的假功能，比如"AI 试色自动弹出""跨店积分"——原样搬过来等于把假功能包装成真功能，触犯合规红线）、`theme-playground`（纯设计探索，无产品代码）。

## 模块拆解

1. **基础设施**：把 `apps/web` 整棵 Next.js 代码树迁入 `webproject/`（新增顶层 `app/` `components/` `lib/` `prisma/`，与现有 `src/`（诊断卡片产线）并存，互不冲突）；新增 `package.json` 依赖（next/react/prisma/pg/jose/bcryptjs 等）；新增 Dockerfile + `.github/workflows/deploy-booking-app.yml`（Next.js standalone 构建，不复用现有 `portal/Dockerfile`，两套服务分开部署）。
2. **数据迁移**：写一次性迁移脚本，把当前 Postgres（`leads`/`staff`/`booking_settings`/`bookings`/`card_meta`/`card_sends`）的数据映射进新 schema（`Workspace`/`TeamMember`/`Service`/`Appointment`/...）；每个现有 lead → 一个 Workspace + 一个 Location。
3. **鉴权**：现有 `src/auth.js`（签名 cookie 单账号）换成 archive 里的 JWT + bcrypt 多角色登录（OWNER/MANAGER/LOW），账号密码需要为每个已上线客户重新建。
4. **功能落地顺序**：登录 → 日历周视图排班（对应你这次抱怨的"完整时间表"）→ 客户管理 → 团队管理 → 服务项目 → 结账+销售报表。
5. **卡片分发产线**（diagcard.js/card-admin.js/小红书获客部分）**保持不变**，不动，两套系统靠 lead_id ↔ workspace_id 的映射衔接。

## Schema 设计（新增，基于 archive 的 prisma/schema.prisma 原样采用，按需精简）

采用 `Workspace / Location / User / TeamMember / ServiceCategory / Service / Client / Appointment / AppointmentService / Sale / SaleItem`（收银相关）核心表；**先不迁移**该 schema 里的 `LoyaltyAccount/LoyaltyTransaction/MembershipTier/GiftCard/GiftCardRedemption/Wallet/WalletTransaction/Coupon/Commission/Feedback/CustomerSession/OtpCode`（会员积分/储值卡/优惠券/顾客端登录）——这些是当前没有客户提出需求的模块，等真有客户要求再加，避免一次性把 23 张表的维护面全接过来。

## 路由清单（首批）

`/login`、`/calendar`（周视图，按技师分列，色块按时长比例渲染）、`/clients`、`/team`、`/services`、`/sales`（当日销售汇总），全部搬自 archive `apps/web/app/(dashboard)/*` 与对应 `app/api/*`。

## 风险点

- **生产不中断**：现有客户已经在用 `/schedule` 追加约会，迁移期必须新旧并行，双写或先只读验证，确认无误才切换域名/下线旧服务。
- **工作量**：不是"改页面"量级，是新增一整套框架+鉴权+数据层，预计以"天"为单位而非小时；期间 webproject 的获客动作（触达/回复/报价）不受影响，仍按 CEO 宪章优先级正常推进，不因为这个迁移而暂停。
- **范围蔓延**：archive 里 POS/收银/员工登录角色体系是当前唯一一个真实客户用不到的重型功能，做完排班日历这部分就应该停，不要顺着代码往下把 POS/报表也一次做完。
- **两套鉴权/两套部署流水线**：新增 `deploy-booking-app.yml` 后，GCP 铁律（第七节）同样适用——部署前核对 project、走 GitHub Actions、部署后实测。

---

📋 计划已生成，请确认：
1. 上面「需要确认的定性问题」里的 3 条默认假设是否都对（尤其是"整体迁移=正式产品线，不是抄组件"这条）；
2. 是否同意"只迁移 apps/web，不迁移 staff-dashboard/customer-booking/theme-playground"；
3. 新服务部署方式（新增独立 Cloud Run 服务 + 独立子路径/子域名，旧服务验证后再下线）是否可以。

回复"确认，开始开发"后我才继续。
