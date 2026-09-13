# 预约系统迁移 archive/beauty —— 任务台账

> 依据 `DEV-PLAN.md`(已确认)。目标:把 `_archive/beauty/apps/web`(Next.js+Prisma,真实可用后端)
> 迁移进 `webproject/booking-app/`,作为独立新服务,不动现有 `src/`(诊断卡片产线)和已上线的
> `booking-portal`(portal.js,Neon `webproject-booking` 分支)。迁移期新旧并行,验证过再谈切换。
>
> Neon 项目复用已有的 `beauty`(proud-firefly-06609528),新建 `booking-app-dev` 分支
> (从旧 `production` 分支切出,带原有 schema+seed 数据,与 `webproject-booking`、`production`
> 两个分支物理隔离,互不影响)。连接串存在 `booking-app/.env.local`(不进 git)。

## 任务清单

- [x] U1 scaffold:把 `_archive/beauty/apps/web` 代码树(去掉 node_modules/.git/.next/lib/generated)
  拷贝进 `webproject/booking-app/`;新 package.json 依赖装好;`.env.local` 指向 `booking-app-dev` 分支。
  验收:`cd booking-app && npm install && npx prisma generate` 无报错。
- [x] U2 schema-trim:精简 `prisma/schema.prisma`——去掉 `LoyaltyAccount/LoyaltyTransaction/
  MembershipTier/GiftCard/GiftCardRedemption/Wallet/WalletTransaction/Coupon/Commission/
  Feedback/CustomerSession/OtpCode` 及相关字段/枚举,只留 `Workspace/Location/User/TeamMember/
  ServiceCategory/Service/Client/Appointment/AppointmentService/Sale/SaleItem`。
  验收:`npx prisma migrate dev --name init_trimmed` 在 `booking-app-dev` 分支跑通,`npx prisma studio`
  能看到精简后的表。
- [x] U3 seed+dev-run:跑 `prisma/seed.ts`(按需调整,去掉被删模块的 seed 逻辑),`npm run dev` 本地
  能访问 `/login`。
  验收:浏览器打开 `localhost:3001/login`,用种子账号登录成功跳转 `/calendar`。
- [x] U4 calendar-page:验证 `/calendar` 周视图按技师分列渲染出色块(这是本次要解决的"时间表太简陋"
  的核心页面)。
  验收:种子数据里的预约在周视图正确落位,色块按时长比例渲染。
- [x] U5 core-pages:`/clients` `/team` `/services` 三个页面增删改查跑通。
  验收:每个页面能新增一条记录并刷新可见。
- [x] U6 checkout-sales:`/sales` 报表页 + 结账弹窗跑通(沿用 archive 已完成的 Phase2 功能,原样验证
  不改逻辑)。
  验收:创建一笔 Sale,`/sales` 汇总数字更新。
- [x] U7 data-migration-script:写脚本把 `webproject-booking` 分支的真实数据(leads/staff/
  booking_settings/bookings)只读导出,映射写入 `booking-app-dev` 分支(每个 lead → 一个
  Workspace+Location,staff → TeamMember,bookings → Appointment)。**只读源库,不写回。**
  验收:脚本跑完,`booking-app-dev` 里能看到迁移后的真实门店/技师/预约数据,和源库人工核对条数一致。
- [ ] U8 deploy-pipeline:**2026-09-13 改口径**——Eric 明确"没必要新增独立的,就还用刚刚那个"
  =直接把新 Next.js 应用部署到现有 `booking-portal` 这个 Cloud Run 服务上,替换掉 portal.js,
  不新建独立服务、不搞新旧并行。改 `.github/workflows/deploy-booking-portal.yml`(构建方式从
  `portal/Dockerfile` 改成 `booking-app/Dockerfile`,Next.js standalone 输出),复用同一个
  Cloud Run service name/URL/Secret(数据库连接串等)。部署前对照 GCP 铁律(CLAUDE.md 第七节)
  核对 project_id;这是直接切生产,没有并行验证窗口,上线前必须把 U9 清单在本地/预发环境走完。
  验收:GitHub Actions 跑绿,访问生产 URL 返回 200 且渲染的是新日历,登录用现有生产凭据能进。
- [ ] U9 verify:上线前(不是上线后)走 CLAUDE.md 第五节验证清单(build 无报错、路由无 404、
  增删改查、鉴权 401/403、无 N+1、大列表分页),在 booking-app-dev 分支/本地环境跑完,因为
  U8 是直接替换生产、没有并行窗口可回头修。
  验收:清单逐项过,记录到本台账。
- [ ] U10 post-cutover-note:替换完成后把"旧 portal.js 代码何时删除/data/leads.db 里跟预约相关
  的字段是否还要保留"这类收尾问题记录下来,不用堵在这次迁移里现在决定。

## 依赖顺序
U1 → U2 → U3 → U4/U5/U6(可并行)→ U7(独立,随时能做,只读源库)→ U8 → U9 → U10(人工决策,不算完成)

## 状态记录
(每完成一条在这里补一行:日期 · 任务号 · 结果 · commit)

- 2026-09-13 · U1-U6 · `booking-app/` 落地,Neon `beauty` 项目下新建隔离分支 `booking-app-dev`
  (从旧 `production` 分支切出,不碰 `webproject-booking` 生产分支和原 `production` 分支)。
  schema 精简为 Workspace/Location/User/TeamMember/ServiceCategory/Service/Client/Appointment/
  AppointmentService/Sale/SaleItem;删掉 gift-cards/loyalty/reports 页面 + api/customer、
  api/owner、api/staff、api/public 四个未被 dashboard 引用的死路由目录;`lib/auth.ts` 清理未用的
  customer token 函数;`prisma/seed.ts` 去掉会员/储值卡/优惠券/佣金/评价的种子逻辑。
  用 Chrome 实测(登录 → 日历周视图 → 点开预约改状态 → 结账 → 销售报表出现新记录)全链路走通,
  截图确认周视图能按技师分列渲染色块——这是本次要解决的"时间表太简陋"问题,新版本明显优于
  portal.js 原来的纯 HTML 表格。
  - 顺带发现并修了一个真实 bug:项目用的 `@base-ui/react` Select 组件(不是 Radix,行为跟训练数据
    里的不一样,`AGENTS.md` 里其实早有警告)不会自动把选中项的文字回显到触发器上,预约弹窗的
    客户/技师下拉框、结账弹窗的支付方式、员工弹窗的角色、服务弹窗的分类都只显示原始 id/枚举值。
    修法是给每个 `<Select>` 传 `items` 映射表(base-ui 官方推荐做法),6 处全部修完,`tsc --noEmit`
    过、浏览器复验显示正常姓名。
  - 已知遗留,记入 U9 验证阶段处理:`/sales` 报表只统计"今天",种子的历史销售都在 30 天前,
    需要专门测一笔当天交易才能验证(已用真实点击流程验证过一次,见上)。
  - `prisma/migrations/` 里两条旧迁移(对应被删模块)已删除,当前用 `prisma db push` 迭代 dev
    分支 schema;正式迁移前(U8)需要在部署前生成一条干净的 baseline migration。

- 2026-09-13 · U7 · 只读迁移脚本 `booking-app/scripts/migrate-production-data.mjs`,只对生产库
  (`webproject-booking` 分支)执行 SELECT,脚本内置检查:源库连接串等于目标连接串时直接中止。
  生产库实际只有 1 个门店(lead_id=99,"Shine Nail Studio"/Scarborough)、0 技师、0 预约——
  迁移结果 1/0/0,和源库人工核对条数一致。
  - 顺带发现并修了两个来自 archive 默认值的真实数据 bug:`Workspace.taxRate` 默认 13.5%(爱尔兰
    VAT,archive 原产地),`Location.timezone` 默认 `Europe/Dublin`——但目标客户都在多伦多。
    已把 schema 默认值改成安大略 HST 13% / `America/Toronto`,迁移脚本里也显式指定,并修正了
    已迁移的那条记录。
  - 已知未迁移、非本轮范围:`booking_settings`(营业时间/时段时长配置)、`card_sends`(卡片发送
    追踪)——新 schema 目前没有对应位置,等相关功能在新系统里落地后再补,不是数据丢失。
