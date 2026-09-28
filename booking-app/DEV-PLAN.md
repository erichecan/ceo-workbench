# DEV-PLAN：补齐 Vagaro 对标缺口（Calendar 运营细节 / Payroll / Inventory / Memberships / Email 营销对接）

## 读取了哪些文档
- `docs/20260928-Vagaro竞品功能对比与缺口清单.md`（本次调研产出，对比 Vagaro 8 个功能页与 booking-app 现状）
- 对话中 Eric 原话（范围澄清，见下方「需求原话」）
- `booking-app/prisma/schema.prisma`（现有数据模型）
- `booking-app/AGENTS.md`（提示本版 Next.js 有 breaking changes，写代码前需查 `node_modules/next/dist/docs/`）
- 未发现独立产品文档（PRD/需求.md 等），本计划以 Eric 在对话中的原话为唯一需求来源

## 需求原话（本次范围澄清）
> "A+B，payroll 其实是做工时的记录，服务项目的记录，决定了分成的计算等等，inventory 也要做，memberships 主要是做之前的优惠券、积分、礼品卡，email marketing 主要做的就是对接一个 mailchimp 这种工具，绝对不是自己开发"

按此原话，本轮范围 = A 档 + B 档 + 缩小版的 Payroll/Inventory/Memberships/Email 集成，**不做**：税务合规发薪、供应商采购链路、会员订阅自动扣费、自建营销邮件编辑器/自建短信群发引擎。

## 一、模块拆解

| 模块 | 本轮做什么 | 不做什么 |
|---|---|---|
| M1 日历运营（原 A 档） | 预约冲突检测、月视图+多员工分栏视图、客户详情页历史记录 | 多资源调度（房间/设备）|
| M2 通知（原 B 档） | 预约提醒邮件（Resend）+ 短信（Twilio）、拖拽改期、周期预约 | 双向聊天、App 内推送 |
| M3 Payroll | 工时打卡记录、服务项目提成比例、按周期生成分成报表 | 税务申报、直接发薪/打印支票、PTO |
| M4 Inventory | 商品目录、库存数量、低库存提醒、销售时可勾选商品结账 | 采购单生成、补货预测、供应商管理、BNPL |
| M5 Memberships | 优惠券（折扣码）、积分（消费累积/抵扣）、礼品卡（售卖/余额抵扣） | 会员等级/订阅自动扣费 |
| M6 Email 营销 | Mailchimp API 集成（客户自动同步进指定名单/打标签），设置页填 API Key | 自建邮件编辑器、自建营销自动化 |

## 二、架构边界评估（大改必做）
- M1/M2 复用现有 `components/calendar/*`、`lib/db/queries/appointments.ts`，不新建模块目录，属于增强而非新建。
- M3/M4/M5 是三个新的业务域，各自独立 Prisma 模型 + `lib/db/queries/{payroll,products,coupons,giftcards}.ts` + `app/(dashboard)/{payroll,inventory,memberships}/` 页面，与现有 sales/clients 模块通过外键关联，不侵入现有表结构（除 `SaleItem` 需加 `productId` 可选外键、`Client` 需加 `pointsBalance` 字段）。
- M6 只加一张 `IntegrationSettings` 表 + 一个 outbound webhook 调用，不引入新的核心业务表。
- 查询效率：新增列表页（Payroll 报表、Inventory 列表、Coupon/GiftCard 列表）均按 workspace 分页查询，复用现有 `getClients`/`getSales` 的分页模式，避免全表拉取。

## 三、Schema 设计（在现有 schema.prisma 基础上新增/修改）

```prisma
// --- M1: 无新表，AppointmentService 已有数据支撑冲突检测查询 ---

// --- M3 Payroll ---
model TimeEntry {
  id           String    @id @default(cuid())
  workspaceId  String
  teamMemberId String
  clockIn      DateTime
  clockOut     DateTime?
  createdAt    DateTime  @default(now())

  workspace  Workspace  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  teamMember TeamMember @relation(fields: [teamMemberId], references: [id], onDelete: Cascade)
}

enum PayrollStatus {
  DRAFT
  FINALIZED
}

model PayrollPeriod {
  id              String        @id @default(cuid())
  workspaceId     String
  teamMemberId    String
  periodStart     DateTime
  periodEnd       DateTime
  hoursWorked     Float         @default(0)
  commissionTotal Int           @default(0) // 分，来自该周期内 Sale 按 commissionRate 计算
  status          PayrollStatus @default(DRAFT)
  createdAt       DateTime      @default(now())

  workspace  Workspace  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  teamMember TeamMember @relation(fields: [teamMemberId], references: [id], onDelete: Cascade)
}

// Service 加一个可选提成比例覆盖（不填则用 TeamMember.commissionRate）
model Service {
  // ...existing fields...
  commissionRate Float? // 新增，null = 沿用员工默认比例
}

// --- M4 Inventory ---
model Product {
  id                String     @id @default(cuid())
  workspaceId       String
  name              String
  sku               String?
  price             Int
  stockQty          Int        @default(0)
  lowStockThreshold Int        @default(5)
  isArchived        Boolean    @default(false)
  createdAt         DateTime   @default(now())

  workspace Workspace  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  saleItems SaleItem[]
}

model SaleItem {
  // ...existing fields...
  productId String? // 新增，与 serviceId 二选一
  product   Product? @relation(fields: [productId], references: [id], onDelete: SetNull)
}

// --- M5 Memberships ---
enum DiscountType {
  PERCENT
  FIXED
}

model Coupon {
  id            String       @id @default(cuid())
  workspaceId   String
  code          String
  discountType  DiscountType
  discountValue Int
  expiresAt     DateTime?
  usageLimit    Int?
  usedCount     Int          @default(0)
  isActive      Boolean      @default(true)
  createdAt     DateTime     @default(now())

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  @@unique([workspaceId, code])
}

model GiftCard {
  id           String   @id @default(cuid())
  workspaceId  String
  code         String   @unique
  initialValue Int
  balance      Int
  clientId     String?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  client    Client?   @relation(fields: [clientId], references: [id], onDelete: SetNull)
}

model Client {
  // ...existing fields...
  pointsBalance Int @default(0) // 新增，积分余额，随 Sale.pointsEarned/pointsRedeemed 增减
}

// --- M6 Email 营销集成 ---
model IntegrationSettings {
  id               String   @id @default(cuid())
  workspaceId      String   @unique
  mailchimpApiKey  String?
  mailchimpListId  String?
  twilioAccountSid String?
  twilioAuthToken  String?
  twilioFromNumber String?
  resendApiKey     String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}
```

## 四、路由清单（新增）

| 路由 | 说明 |
|---|---|
| `app/api/appointments/[id]/route.ts` (改) | PATCH 改期时加冲突校验 |
| `app/(dashboard)/calendar/*` (改) | 加月视图、按员工分栏、拖拽改期 |
| `app/(dashboard)/payroll/page.tsx` | 工时+分成报表页 |
| `app/api/payroll/time-entries/route.ts` | 打卡记录 CRUD |
| `app/api/payroll/periods/route.ts` | 生成/查看结算周期 |
| `app/(dashboard)/inventory/page.tsx` | 商品列表页 |
| `app/api/products/route.ts`、`[id]/route.ts` | 商品 CRUD |
| `app/(dashboard)/memberships/page.tsx` | 优惠券/积分/礼品卡管理页 |
| `app/api/coupons/route.ts`、`[id]/route.ts` | 优惠券 CRUD |
| `app/api/gift-cards/route.ts`、`[id]/route.ts` | 礼品卡 CRUD |
| `app/(dashboard)/settings/integrations/page.tsx` | Mailchimp/Twilio/Resend 配置页 |
| `app/api/integrations/mailchimp/sync/route.ts` | 客户同步到 Mailchimp |
| `app/api/cron/appointment-reminders/route.ts` | 预约提醒触发端点（外部定时器调用） |

结账页 `CheckoutModal.tsx` 需改造：支持选商品（走库存）、输入优惠券码、使用/累积积分、使用礼品卡抵扣。

## 五、风险点

1. **需要 3 个未配置的外部账号/API Key**：Resend（或 SendGrid，邮件提醒）、Twilio（短信提醒）、Mailchimp（邮件营销同步）。按第六节规则，这是必须停下等你决策的事项——见下方确认清单，不会替你注册。
2. **定时提醒需要一个触发器**：Next.js 本身无 cron，`app/api/cron/appointment-reminders/route.ts` 需要外部定时调用（Vercel Cron / GitHub Actions scheduled workflow / GCP Cloud Scheduler），具体选哪个等真正部署时按 CLAUDE.md「部署目标到真正部署时再问」确定，本轮先把端点做好、本地用手动触发验证逻辑。
3. **提成计算口径假设**：Eric 提到"服务项目的记录决定了分成计算"，我理解为服务可设置独立提成比例（不填则用员工默认比例）。如果实际逻辑更复杂（比如按员工+服务组合的矩阵定价），需要你在场景确认阶段指出。
4. **积分/礼品卡与现有 Sale 字段的关系**：`Sale.pointsEarned/pointsRedeemed/giftCardAmount/couponAmount` 已存在但从未被使用，本轮会真正激活这些字段的读写逻辑，结账流程行为会因此改变（比如提交订单时才真正校验优惠券是否有效、礼品卡余额是否够）。
5. **schema 改动影响面**：`SaleItem`、`Service`、`Client` 三张已有表加字段，均为可选/带默认值字段，不影响现有数据，`prisma migrate dev` 风险低。

## 六、附录 A：验收标准与 verify.sh

`scripts/verify.sh` 在现有基础上追加：
- `npx tsc --noEmit`、`npm run build`、`npx prisma migrate status`（沿用现状）
- 路由探针：对新增 12 个路由发请求，断言非 404/500
- 鉴权探针：`/api/payroll/*`、`/api/products/*`、`/api/coupons/*`、`/api/gift-cards/*`、`/api/integrations/*` 均需登录，未登录 401、低权限角色对财务类接口（payroll、integrations）403
- 业务断言：
  - 同员工同时段创建重叠预约 → 返回 409/明确错误，不允许写入
  - 库存扣减：结账含商品的订单后 `Product.stockQty` 应减少对应数量，且不允许扣成负数
  - 积分：结账后 `Client.pointsBalance` 按 `Workspace.pointsPerEuro` 规则增加，使用积分抵扣后余额正确扣减
  - 优惠券：过期/超使用次数的券在结账时应被拒绝
  - 提成：`PayrollPeriod.commissionTotal` 等于该周期内该员工名下 Sale 按对应 commissionRate 计算之和（±1 分误差内，因四舍五入）
- 性能：Payroll/Inventory 列表接口开 query log，断言查询数不随数据量线性增长，均需分页

verify.sh 不过不写完成报告；无命令输出的条目标 ⚠️ 未验证。

---

📋 计划已生成。三块内容，只有第 1 块需要你判断：

【需要你判断 — 场景清单】
- [你说的] Payroll 做工时记录+服务项目提成计算 → 员工打卡记录工时，系统按该服务设置的提成比例（没设置就用员工默认比例）自动算出这个结算周期该拿多少钱
- [你说的] Inventory 也要做 → 能建商品、记库存数量，结账时能选商品一起卖并自动扣库存，库存低于阈值有提示
- [你说的] Memberships 做优惠券/积分/礼品卡 → 结账能输入券码打折、消费自动攒积分且能用积分抵扣、能开礼品卡并在结账抵扣余额
- [你说的] Email 营销对接 Mailchimp，不自建 → 设置页填入 Mailchimp API Key 后，客户会自动同步进指定名单/打标签，营销邮件本身在 Mailchimp 里做，不是我们做
- [我推断的] 短信/邮件功能本轮只做"预约提醒"（B 档），不做"促销群发/生日祝福"这类营销短信（Vagaro Text Marketing 页面的内容）——如果你也要这块，请明说
- [我推断的] 提成比例挂在"服务"级别（不填则用员工默认比例），不是"员工+服务"矩阵定价——如果实际更复杂，请指出
- [我推断的] Inventory 本轮只到"库存数量+低库存提示"，不做采购单/供应商/补货预测

推断项最容易错，请重点看这 3 条。

【我负责 — 你不用看】
性能、鉴权、类型、查询效率由我定标准、我自证、我贴证据，见附录 A。

技术栈沿用项目现状（Next.js + Prisma + PostgreSQL），无需重新确认。

三个外部账号需要你决策（不是"我负责"范畴，因为账号本身属于你）：
1. **Resend**（邮件提醒）或 SendGrid——两个都行，哪个都没有的话我先接 Resend（更简单）
2. **Twilio**（短信提醒）
3. **Mailchimp**（客户名单同步）

这三个现在都没配置。你可以选：现在就去注册拿 API Key 给我（我接 `.env.local`，不提交 git）；或者先跳过 M2 的短信/邮件提醒和 M6，先做 M1/M3/M4/M5（不需要外部账号的部分），账号等你方便了再补。

【一次性告知 — 不同意就说】
歧义清单：无（本轮需求来自你的原话，无 PRD 冲突）
假设清单：
- 分成计算精确到"分"（Int 存储，避免浮点误差），四舍五入按标准算术规则
- 积分获取规则沿用现有 `Workspace.pointsPerEuro`/`pointsValueCents` 字段的既有语义（每消费 1 单位货币得 N 积分，每积分值 M 分钱）
- 礼品卡余额、积分余额都不设过期时间（Vagaro 页面也未强调过期规则）

回复"确认"后我不再就实现细节打断你。（如果外部账号要跳过某几个，请在确认时一并说清楚跳过哪些）
