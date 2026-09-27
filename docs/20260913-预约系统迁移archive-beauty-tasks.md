# 预约系统迁移 archive/beauty —— 任务台账

> ⚠️ **2026-09-27 更正**：下面 U8 状态记录到 2026-09-13 当天为止是准确的，但后续没有回来更新——U8 实际上在
> 2026-09-13 当天（`fix: 预约后台内存 512Mi→1Gi，Verify 加真实渲染检查`）和 2026-09-17（`style: booking-app
> 主题改深紫/淡紫调`）都已经成功部署到生产（GitHub Actions 记录两次都是绿的），**booking-portal 现在跑的就是
> booking-app，不是旧 portal.js**。U11（卡片预览）截至今天仍未做，如果店主需要这个功能，是真实缺口，不是
> "还没上线所以不影响"。下面的"⛔ U8 当前不能执行"是过时状态，不代表现在。

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
- [x] U8 deploy-pipeline（2026-09-27 补记：实际已在 2026-09-13/09-17 完成部署，此前忘了回来勾掉）：**2026-09-13 改口径**——Eric 明确"没必要新增独立的,就还用刚刚那个"
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
U1 → U2 → U3 → U4/U5/U6(可并行)→ U7(独立,随时能做,只读源库)→ **U11(卡片预览迁移,
新增,阻塞 U8)** → U8 → U9 → U10(人工决策,不算完成)

⛔ U8 当前不能执行:.github/workflows/deploy-booking-portal.yml 和 booking-app/Dockerfile
已经改好并验证过(本地 docker run 实测登录+日历正常),但**没有 push**——push 到 main 会
立刻触发部署,而 booking-app 现在还没有卡片预览功能(U11),部署了会让店主在后台丢失预览/
重新生成卡片的入口。下次接手先确认 U11 做完再考虑要不要 push 这个 workflow 改动。

## 状态记录
(每完成一条在这里补一行:日期 · 任务号 · 结果 · commit)

- 2026-09-13 · ⚠️ 事故记录(U8 执行中) · 把新 schema `prisma db push` 到生产库
  (`webproject-booking` 分支)时,`db push` 把 schema.prisma 里没声明的表当成"漂移"
  直接删了——`staff/bookings/booking_settings/card_meta/card_sends` 五张旧表全部被删,
  而当时线上 Cloud Run 服务(`booking-portal`)跑的还是**旧的 portal.js**,不是新系统,
  相当于把还在服役的生产服务的数据库桌子直接抽掉了。
  影响窗口:发现到修复之间(几分钟内)如果有人访问预约后台会报错;没有证据显示期间
  有真实用户访问。
  已恢复:凭只读检查阶段记录下来的确切字段值,重建了 5 张旧表结构 + 写回 card_meta/
  booking_settings 那 2 行真实数据;用生产登录凭据实测 `/`、`/schedule` 恢复 200,
  `/login` 恢复 302——功能与事故前一致。`/card.png` 返回 404 是**事故前就存在**的
  已知行为(容器本地文件系统不持久,重启后生成过的 png 就没了),跟这次无关,不是新增
  的问题。
  同时因为这次操作,新 schema 已经提前推到了生产库(新表和旧表现在共存,互不干扰);
  也顺手把这一条真实门店数据(Shine Nail Studio)重建进了新表,并按生产 Secret
  Manager 里现有的用户名密码在新系统里建好了对应登录账号(bcrypt hash,同一套密码)。
  **教训(已存入记忆)**:`prisma db push`/`migrate dev` 是把 schema.prisma 当成
  数据库的完整真相,不在 schema 里声明的表会被当成漂移清掉,不是只增不减——
  跟目标库共享物理数据库、但只想"新增自己的表"时,必须先确认目标库里除了自己要管
  的表之外还有没有别人在用的表,否则等于无差别 drop。
  ⛔ 因为这个事故,U8 的"直接替换 booking-portal"整体停下来,没有继续部署新镜像、
  没有 push 新的 GitHub Actions workflow——见下面新发现的范围缺口。

- 2026-09-13 · U8 范围缺口(未解决,记入台账) · 排查事故过程中发现 portal.js 除了
  排班后台,还有一个 `/card.png` 路由(登录态下把 `card-admin.js`/`diagcard.js`
  生成的预约卡 PNG 读出来给店主自己预览——不是发给顾客的公开链接,顾客看到的是
  一张手动发送的静态图片,不经过这个 URL)。archive/beauty 迁移过来的 booking-app
  完全没有卡片生成/预览这块功能,如果直接替换 booking-portal 服务,店主会失去在
  后台里预览卡片的入口(不影响已经发出去的卡片,因为那是静态文件,但会影响以后
  改店名/改背景图后要重新预览的流程)。
  **2026-09-13 Eric 已拍板**:把卡片预览也迁进 booking-app,不留在 card-admin.js。

- [ ] U11 card-preview-port:把 `src/card.js`(`buildCardHtml`/`renderCardPng`/
  `cardSlug`/`generateCard`,144 行)的能力搬进 booking-app,给新系统加一个"预览/
  重新生成预约卡"的入口,替代 portal.js 原来的 `/card.png`。
  范围要点(下次做的时候先看这几个文件,不要凭记忆猜):
  - `renderCardPng` 靠系统 Chrome 截图(不是 puppeteer),`booking-app/Dockerfile`
    需要照 `portal/Dockerfile` 的样子加 `chromium` + `font-noto-cjk`(2026-09-13
    实测过 alpine 默认没有中文字形,不装会变方块)。
    `.env`/Cloud Run 需要 `CHROME_PATH`。
  - portal.js 的 `/card.png` 只是"读现成文件"(`serveCard`),真正生成在
    `card-admin.js` 那边调 `generateCard`——生成后的 png 写在容器本地磁盘
    (`data/cards/output/`),**不持久化**,重启就没了(2026-09-13 事故排查时
    确认过,是既有行为)。booking-app 里做这块时要一并想清楚:继续接受"重启丢图,
    需要时随时能重新生成"这个模型,还是换成写 Cloud Storage/数据库 bytea 之类
    持久化方案——不要在没想清楚这个之前就直接照抄旧逻辑。
  - `buildCardHtml` 用的字段(brandName/regionLabel/styleTags/slots/bgFile)现在
    对应新 schema 的 `Workspace.name`/`Location.name`/(styleTags 和 bgFile 新
    schema里没有对应字段,需要新增,或者暂时挂在 `Location`/`Workspace` 的某个
    JSON 字段里,U7 迁移时特意跳过了这两个字段没搬,回头一起处理)。
  验收:booking-app 里能触发生成一张新卡片、能预览,内容(店名/地区/风格标签/
  空闲时段)跟原来 portal.js 生成的一致。

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

- 2026-09-27 · U8 状态更正 + 新增公开预约页面 · 发现 U8 早在 2026-09-13/09-17 已成功部署（本台账没回来更新，
  见文首更正说明）。同时新增 `/book/[slug]` 公开预约页（demo/获客用，不需要客户登录），Workspace 加
  `logoUrl` 字段。生产库（`ep-fancy-feather-anb8hx3k` 分支）用精确的
  `ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT` 手动同步——**没有用 `prisma db push`**，
  因为生产库里 `staff/bookings/booking_settings/card_meta/card_sends` 这 5 张事故后重建的旧表没有在
  schema.prisma 里声明，`db push` 的漂移检测会把它们当漂移再删一次。执行前后都核对过表清单，16 张表一张没少。
  部署后独立验证（不只信 workflow 自带的 verify）：`/book/lead-99` 200、`/book/不存在的slug` 404、
  `/login` 200、`/calendar` 307，新旧功能都正常。
  - 遗留:U9(上线前验证清单)、U10(旧代码收尾决策)、U11(卡片预览搬迁)仍未做，U11 如果店主真的需要
    卡片预览功能，是当前生产环境的真实功能缺口，下次接手先确认这个还要不要做。
