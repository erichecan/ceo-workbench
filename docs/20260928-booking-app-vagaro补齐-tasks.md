# booking-app 补齐 Vagaro 缺口 — 任务台账

依据：`booking-app/DEV-PLAN.md`（已确认，2026-09-28）
执行单元顺序：先跑通 schema 迁移（所有单元的依赖），之后 M1/M3/M4+M5 并行，M2/M6 脚手架最后做。

- [x] 0. Schema 迁移：新增 TimeEntry/PayrollPeriod/Product/Coupon/GiftCard/IntegrationSettings，改 Service/SaleItem/Client
      验收命令：`npx prisma migrate dev --name vagaro-gap-fill && npx tsc --noEmit`
      可看物：无（纯数据层）
      定性状态：不涉及
      证据：迁移成功应用（`20260928231842_vagaro_gap_fill`），`tsc --noEmit` 零错误；迁移前数据行数核对：Workspace 2 / Client 5 / TeamMember 2 / Service 5 / Appointment 28 / Sale 27 / SaleItem 27，迁移后全部一致，无数据丢失
      依赖：无
      附注：迁移过程中发现本地 `prisma/migrations/` 目录此前是空的（只有 lock 文件），但 Neon 数据库的 `_prisma_migrations` 记账表里有两条历史记录（`add_sale_saleitem`、`commercial_features`）在本地找不到对应文件——本地迁移文件从未被提交过 git。已用标准 baseline 流程补齐（生成基线迁移文件、清空记账表 3 条元数据行重新标记为已应用），未执行 `migrate reset`，未删除任何业务表数据。这是历史遗留的迁移文件缺失问题，建议以后每次 `migrate dev` 后确认 `prisma/migrations/` 有被 `git add`。

- [x] 1. M1 日历运营：预约冲突检测 + 月视图/多员工分栏 + 客户详情历史记录 — 代码已完成并自验通过，已提交（commit 9d30d00，因下方"生产事故"经过 revert→reapply，最终落在 016857c，已部署生产 booking-portal）
      验收命令：`npx tsc --noEmit`；手动测试同员工同时段建两条预约应被拒绝
      可看物：docs/shots/20260928-calendar-day-multi-column.png（多员工分栏日视图）、docs/shots/20260928-calendar-month-view.png（月视图）、docs/shots/20260928-client-history-tab.png（客户历史记录 tab，实际数据）—— 均为我起 dev server 后用 Playwright 实测截图，非单纯代码走查
      定性状态：待你确认
      证据：
        - `npx tsc --noEmit` 零错误；`npm run build` 成功（25 routes 全部生成，无编译错误）；`npx prisma migrate status` 显示 schema up to date
        - 新写验证脚本 `scripts/verify-appointment-conflict.ts`（直接调用 lib/db/queries/appointments.ts，不经 HTTP，用现有种子数据）：7/7 断言通过——① 同员工重叠时段第二条预约被 AppointmentConflictError 拒绝 ② 不重叠时段成功创建 ③ 改期到冲突时段被拒绝 ④ hasConflict() 对占用时段返回 true ⑤ 对空闲时段返回 false ⑥ 改期到自身原时段不被误判为冲突（excludeAppointmentId 生效）
        - 回退验证：临时把 hasConflict() 强制 return false，重跑脚本 → 3/7 变红（重叠创建未拒绝/改期未拒绝/hasConflict 误判），恢复代码后重跑 → 7/7 转绿，确认测试真实覆盖了该逻辑
        - 根因与设计：`createAppointment`/`updateAppointment`（改期场景）新增 `hasConflict(workspaceId, teamMemberId, startTime, endTime, excludeAppointmentId?)` 查询，冲突判定为同 teamMemberId + 状态非 CANCELLED/NO_SHOW + 时间区间重叠（`startTime < endTime_new && endTime > startTime_new`）；冲突时抛 `AppointmentConflictError`，API 层（POST /api/appointments、PATCH /api/appointments/[id]）捕获后返回 409 + 中文错误信息，前端 `AppointmentModal.tsx` 原有的 `data.error` 展示逻辑已能正确显示该消息（未额外改动）；teamMemberId 为空时不做检测
        - 月视图：新增 `CalendarMonthView.tsx`，标准 6 周网格（`startOfWeek(startOfMonth)` 到 `endOfWeek(endOfMonth)`），每格显示当天预约数（最多 3 条 + "+N more"），点击跳转日视图；`CalendarClient.tsx` 月视图 fetch 范围随之扩展覆盖整个网格
        - 多员工分栏：`CalendarDayView.tsx` 重构，抽出 `CalendarDayColumn.tsx`（单列的时间轴+预约块渲染）与 `calendar-grid.ts`（共享的 HOUR_HEIGHT/时间换算函数）；当 workspace 有 >1 个 `isBookable=true` 的 TeamMember 时按员工分列（含一个 Unassigned 列），列头显示姓名+`calendarColor`色点；只有 0/1 个员工时保持原单列行为（逐字节对比原实现，行为不变）。周视图未改（范围收窄说明见下）
        - 客户历史：`lib/db/queries/clients.ts` 的 `getClient` 新增 `include: { appointments (desc, take 50, 含 teamMember+services), sales (desc, take 50, 含 items) }`；`ClientModal.tsx` 加 Details/History 两个 tab（仅编辑现有客户时显示 History），History tab 用新组件 `ClientHistoryPanel.tsx` 调用既有 `GET /api/clients/[id]`（鉴权未变，仍需 session）展示预约与消费记录
        - 鉴权核查：改动的两个写操作路由（POST/PATCH /api/appointments）鉴权逻辑未动，仍是「无 session→401，非 OWNER/MANAGER→403」，只在 try/catch 里新增了 409 分支，未削弱原有检查
      依赖：单元 0

- [x] 2. M3 Payroll：工时打卡 + 服务提成比例 + 结算周期报表页 — 代码已完成并自验通过，已提交（commit 9d30d00，最终落在 016857c，已部署生产 booking-portal）
      验收命令：`npx tsc --noEmit`；手动测试一笔 Sale 生成后 PayrollPeriod.commissionTotal 计算正确
      可看物：docs/shots/20260928-payroll-page.png、docs/shots/20260928-payroll-generated-period.png —— 我起 dev server 实测：录入 Emma Murphy 8:00-13:00 工时，页面正确算出 5.00h；生成 2026-09 结算周期，Hours 显示 5.00h（该月无对应 Sale，Commission 显示 $0.00 符合预期）
      定性状态：待你确认
      证据：`npx tsc --noEmit` 零错误；`npm run build` 成功（新增路由 `/payroll`、`/api/payroll/time-entries`、`/api/payroll/time-entries/[id]`、`/api/payroll/periods` 均正常生成）。临时验证脚本（用后即删）对隔离的测试 Workspace 断言：2 条 TimeEntry（3h+2h，另有 1 条未 clockOut 和 1 条周期外的均被正确忽略）→ hoursWorked=5（PASS）；1 笔 Sale 的 SaleItem price=10000 分、Service.commissionRate=0.3（TeamMember.commissionRate 故意设为 0.5 以验证服务级覆盖生效，另有 1 笔周期外的 Sale 被正确忽略）→ commissionTotal=3000（PASS，误差 0）；status=DRAFT（PASS）。回退验证：临时把 `commissionCents += item.price * rate` 改回用 `teamMember.commissionRate`（即去掉服务级覆盖），重跑脚本 commissionTotal 变为 5000（FAIL，符合预期，证明测试有效捕获该 bug），随后改回原实现重跑恢复 3000（PASS）。测试数据在断言后已用 `workspace.delete` 级联清理，未残留脏数据。鉴权：`app/api/payroll/*` 三个路由的 GET/POST/PATCH 均先 `getSession()` 返回 401（无 session），再检查 `role !== 'OWNER' && role !== 'MANAGER'` 返回 403（LOW 角色），与 `app/api/team/route.ts`、`app/api/services/route.ts` 现有模式一致，未起服务器实测（代码走查确认逻辑无遗漏分支）。项目无既有单元测试框架（无 jest/vitest 配置、仓库内 0 个 *.test.ts），故"全量单元测试"这一项不适用，如需补齐见台账末尾"已知缺口"。
      依赖：单元 0

- [x] 3. M4+M5 Inventory + Memberships：商品库存 + 优惠券/积分/礼品卡，结账页联动改造 — 续做完成
      验收命令：`npx tsc --noEmit`；手动测试结账选商品扣库存、输入券码打折、用积分抵扣、礼品卡抵扣
      可看物：docs/shots/20260928-inventory-page.png、docs/shots/20260928-inventory-product-created.png（真实新建商品并保存，低库存红色提示正确触发）、docs/shots/20260928-memberships-page.png、docs/shots/20260928-checkout-modal-open.png、docs/shots/20260928-checkout-with-product.png —— 我（主 session）起 dev server 后用 Playwright 亲自走了一遍完整流程：新建商品(库存3)→新建预约→状态改 STARTED→点 Checkout→加商品到结账单(服务$35+商品$25=$60)→Collect 提交 → 回到库存页确认库存从 3 变成 2，端到端扣减正确，不是代码走查
      定性状态：待你确认
      证据：
        - 现有基础设施（`lib/db/queries/{products,coupons,gift-cards}.ts`、对应 CRUD API、`checkoutSale()`）复核后判断逻辑完整，未改动，仅在此基础上补齐 UI 与结账联动
        - 新增页面：`app/(dashboard)/inventory/page.tsx` + `components/inventory/{ProductModal,ProductsTable}.tsx`（新建/编辑/归档商品，库存 ≤ 低库存阈值时用红色 destructive Badge 提示）；`app/(dashboard)/memberships/page.tsx` + `components/memberships/{CouponModal,CouponsTable,GiftCardModal,GiftCardsTable}.tsx`（优惠券启用/停用/编辑，礼品卡创建/停用，卡号系统生成不可编辑）；`components/layout/Sidebar.tsx` 加"库存管理""会员权益"两个导航项（该文件同时有另一并发改动在加 `OWNER_ONLY_NAV_ITEMS`，只做了最小化插入未动其余逻辑）
        - `components/calendar/CheckoutModal.tsx` 重写：加"添加商品"下拉（从 `/api/products` 拉取未归档商品，选中后加入结账清单，商品行可调数量、可移除，服务行行为不变）；优惠券码输入框 + 校验按钮，失焦/点击时拉取 `/api/coupons` 列表在前端本地复现 `validateCoupon` 同款逻辑（百分比/固定折扣、过期、启用状态、次数上限）做折扣预览，真正生效判断仍在提交时由后端 `checkoutSale` 决定；礼品卡号输入框同理拉取 `/api/gift-cards` 显示余额，可编辑本次抵扣金额（前端封顶 min(卡余额, 订单剩余)）；若有 `clientId` 则拉取 `/api/clients/[id]` 显示客户当前积分余额，超过 0 才显示"使用积分抵扣"输入框；提交时把 `couponCode`/`giftCardCode`/`giftCardAmount`/`redeemPoints`/商品行一起传给 `POST /api/sales`；新增 `translateCheckoutError()` 把后端 `CheckoutError` 的英文消息（库存不足/优惠券失效/礼品卡余额不足等）翻译成中文展示
        - `npx tsc --noEmit` 零错误；`npm run build` 成功（新增路由 `/inventory`、`/memberships` 正常生成，共 34 routes 全部编译通过）
        - 新写验证脚本 `scripts/verify-checkout.ts`（隔离 workspace，直接调用 `checkoutSale`，断言后 `workspace.delete` 级联清理，用完即删）11/11 断言通过：①库存不足抛 CheckoutError 且不扣减库存 ②优惠券 20% 折扣金额/订单总额/usedCount 计次/库存扣减全部正确 ③礼品卡请求抵扣金额超过卡余额（但未超订单金额）时抛 CheckoutError 且不扣减余额 ④礼品卡正常抵扣 1000 分 + 积分抵扣 50 分，total/giftCardAmount/pointsRedeemed/礼品卡余额/客户积分余额（含两笔订单的累计与抵扣）全部计算正确
        - 回退验证：临时把库存双重校验（预检查 + `updateMany` 原子条件）、优惠券折扣计算（改为恒为 0）、礼品卡余额校验（预检查 + `updateMany` 原子条件）同时改坏后重跑，9/11 断言变红（场景1/2/3 全部失败，含出现负库存 -7/-9、负余额 -500/-1500 等异常数据，证明测试确实在验证这些边界）；随后用备份文件逐一恢复三个文件，重跑 tsc 确认无残留改动痕迹（grep 确认无 `false &&`/`BROKEN` 标记），重跑验证脚本回到 11/11 全绿
        - 鉴权：`/api/products`、`/api/coupons`、`/api/gift-cards`（含 `[id]`）均沿用项目既有模式——GET 只需登录 session，写操作（POST/PATCH/DELETE）额外要求 `role === OWNER || MANAGER`；起 `npm run dev` 实测：未登录访问三个 GET 端点均被中间件 307 重定向到 `/login`（与本项目所有既有 API 路由行为一致，非新问题）；用种子账号 `owner@demo.com` 登录后拿 session cookie 重新请求，三个端点及 `/inventory`、`/memberships` 两个页面均返回 200，页面渲染出真实中文文案（非空白/报错页）
        - 项目仍无 jest/vitest 单元测试框架（沿用单元2记录的已知缺口），"全量单元测试"这一项继续不适用
      依赖：单元 0（M4/M5 共用 CheckoutModal.tsx，合并为一个单元避免冲突）

- [x] 4. M2+M6 脚手架：Resend/Twilio/Mailchimp 设置页 + dry-run 模式（无 Key 时只记日志不真发）—— 续做完成，未提交（等 Eric 统一 commit）
      验收命令：`npx tsc --noEmit`；无 Key 时调用发送接口应返回"未配置，已跳过"而非报错
      可看物：docs/shots/20260928-integrations-settings.png —— 我（主 session）起 dev server 用 Playwright 实测截图，三个区块（Resend/Twilio/Mailchimp）均显示"未配置"徽标，dry-run 说明文案清晰
      定性状态：待你确认
      证据：
        - 续做前先复核：`lib/notifications/{email,sms,mailchimp,appointment-notify}.ts`、`lib/db/queries/integration-settings.ts`、`app/api/integrations/route.ts`、`app/api/integrations/mailchimp/sync/route.ts`、`app/api/cron/appointment-reminders/route.ts` 均已是前一轮 agent 做好的完整逻辑（dry-run 分支齐全、`getIntegrationSettingsView` 已做 Key 脱敏只留后4位、API 路由已限定仅 OWNER），本轮未改动这些文件
        - 本轮新增/修改：新建 `app/(dashboard)/settings/integrations/page.tsx`（服务端组件，非 OWNER 直接 redirect('/calendar')）、`components/settings/IntegrationsForm.tsx`、`components/settings/IntegrationSection.tsx`（三个区块：Resend/Twilio/Mailchimp，各自"已配置/未配置"徽标 + 表单 + 单独保存按钮）；修改 `components/layout/Sidebar.tsx`（加 `role` prop，仅 role==='OWNER' 时渲染"集成设置"导航项）与 `app/(dashboard)/layout.tsx`（改为 async，`getSession()` 取 role 传给 Sidebar，最小改动，未动其余布局逻辑）
        - `npx tsc --noEmit`：零错误（过程中一度出现 1 个错误，定位后确认是另一个并发会话在写 `app/(dashboard)/memberships/page.tsx`（Coupon 类型不匹配），不是我的文件，未处理、片刻后对方自己改好了，最终复跑零错误）
        - `npm run build`：成功，输出路由列表包含 `/settings/integrations` 与 `/api/integrations`、`/api/integrations/mailchimp/sync`
        - dry-run 回归验证（临时脚本，用后已删，不落库）：对一个未配置 IntegrationSettings 的真实 workspace 依次调用 `sendAppointmentEmail`/`sendAppointmentSms`/`syncClientToMailchimp`，三者均返回 `{sent:false/synced:false, reason:'not_configured'}`，不抛异常；随后调用 `createAppointment(workspaceId, {...})` 正常创建成功（预约创建不受 fire-and-forget 通知逻辑影响），测试数据已清理
        - 鉴权实测（起 dev server，真实 HTTP，非纯代码走查）：owner 登录后 `GET/PATCH /api/integrations` 200；`PATCH` 写入 `resendApiKey` 后 `GET` 返回 `apiKeyMasked` 只含后4位（如 `***************cdef`），未见明文；staff（非 OWNER）登录后 `GET/PATCH /api/integrations` 均 403，访问 `/settings/integrations` 页面被 307 重定向（页面内 redirect('/calendar') 生效）；未带 cookie 请求 `/api/integrations` 被项目级 `proxy.ts`（Next 16 的 middleware 重命名，非本轮改动）统一 307 重定向到 /login，未到达路由处理函数，未泄露任何数据；测试完成后已清空刚才写入的测试 Key，复查 GET 恢复 `configured:false`
      依赖：单元 0

## 生产事故记录（2026-09-28）

**起因**：单元 0 的 schema 迁移我跑在 `booking-app/.env.local` 指向的 Neon 库（`ep-crimson-king-anlru6e9`），这个库不是生产库——生产 booking-portal（服务真实客户 shine-nail-studio）的 `DATABASE_URL` 指向另一个 Neon 实例（`ep-fancy-feather-anb8hx3k`）。commit 9b11f3c（schema 变更）被另一个并发的 Claude 会话（webproject-b3，在同一工作目录并发操作 git）`git push` 时连带推上了 main，触发 booking-portal 自动部署；部署流水线 `.github/workflows/deploy-booking-portal.yml` 不含任何数据库迁移步骤，新 Prisma Client 连到没升级过的生产库，`/calendar` 等页面报 P2022（列不存在）。

**处理过程**：webproject-b3 先把 Cloud Run 流量手动切回旧版本止血，双方核实根因（两个不同 Neon 库 + 部署流水线缺迁移步骤）后一致同意不再单方面动 main/生产库，我叫停了自己后台还在跑的单元 3/4 两个 agent。Eric 拍板：保留新功能，补跑生产迁移而非整体 revert。webproject-b3 对生产库执行 `migrate resolve --applied` + `migrate deploy`（标准安全流程，未用 reset/db push），迁移前后核心表行数核对一致；重新 push 后发现 Cloud Run 流量因为之前手动 `update-traffic` 被钉在旧版本，`gcloud run deploy` 不会自动覆盖，CI 的 Verify 步骤测的其实是旧代码（误报通过）；手动切流量到新版本后用真实客户账号重新验证，登录/日历/Payroll 均 200，问题解决。

**根本原因**：(1) 两个 Claude 会话在同一物理工作目录并发 commit/push 同一条 main 分支，push 会带上对方未推送的本地提交；(2) 部署流水线没有数据库迁移步骤，schema 变更和生产库状态完全靠人工记得同步；(3) Cloud Run 手动 `update-traffic` 钉住版本后，后续自动部署的 Verify 步骤会静默测到旧版本，看起来通过实际没生效。

**遗留改进项**（未在本轮处理，建议后续找 Eric 定夺）：
- 部署流水线要不要加 `prisma migrate deploy` 步骤，避免下次 schema 变更再靠人工记得
- 两个并发 Claude 会话共用同一工作目录/main 分支的协作方式要不要改成分 worktree
- Cloud Run 流量被手动钉住时，CI 的 Verify 步骤该怎么发现"测的是旧版本"这个问题（比如探活时校验镜像 digest/commit sha）

## 已知缺口（不在本轮台账内，记录不遗忘）
- 项目至今没有 `scripts/verify.sh`（CLAUDE.md 七节要求的技术验收脚本），本轮只补最小验证（tsc + 手动断言），完整的鉴权探针/性能基线/查询数探针是更大的独立缺口，需要单独立项补齐。
