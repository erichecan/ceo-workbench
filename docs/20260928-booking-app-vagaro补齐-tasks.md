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

- [x] 1. M1 日历运营：预约冲突检测 + 月视图/多员工分栏 + 客户详情历史记录 — 代码已完成并自验通过；按 Eric 指示本轮未 git commit，等 Eric 统一检查后提交（无 commit hash）
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

- [x] 2. M3 Payroll：工时打卡 + 服务提成比例 + 结算周期报表页 — 代码已完成并自验通过；按 Eric 指示本轮未 git commit，等 Eric 统一检查后提交（无 commit hash）
      验收命令：`npx tsc --noEmit`；手动测试一笔 Sale 生成后 PayrollPeriod.commissionTotal 计算正确
      可看物：docs/shots/20260928-payroll-page.png、docs/shots/20260928-payroll-generated-period.png —— 我起 dev server 实测：录入 Emma Murphy 8:00-13:00 工时，页面正确算出 5.00h；生成 2026-09 结算周期，Hours 显示 5.00h（该月无对应 Sale，Commission 显示 $0.00 符合预期）
      定性状态：待你确认
      证据：`npx tsc --noEmit` 零错误；`npm run build` 成功（新增路由 `/payroll`、`/api/payroll/time-entries`、`/api/payroll/time-entries/[id]`、`/api/payroll/periods` 均正常生成）。临时验证脚本（用后即删）对隔离的测试 Workspace 断言：2 条 TimeEntry（3h+2h，另有 1 条未 clockOut 和 1 条周期外的均被正确忽略）→ hoursWorked=5（PASS）；1 笔 Sale 的 SaleItem price=10000 分、Service.commissionRate=0.3（TeamMember.commissionRate 故意设为 0.5 以验证服务级覆盖生效，另有 1 笔周期外的 Sale 被正确忽略）→ commissionTotal=3000（PASS，误差 0）；status=DRAFT（PASS）。回退验证：临时把 `commissionCents += item.price * rate` 改回用 `teamMember.commissionRate`（即去掉服务级覆盖），重跑脚本 commissionTotal 变为 5000（FAIL，符合预期，证明测试有效捕获该 bug），随后改回原实现重跑恢复 3000（PASS）。测试数据在断言后已用 `workspace.delete` 级联清理，未残留脏数据。鉴权：`app/api/payroll/*` 三个路由的 GET/POST/PATCH 均先 `getSession()` 返回 401（无 session），再检查 `role !== 'OWNER' && role !== 'MANAGER'` 返回 403（LOW 角色），与 `app/api/team/route.ts`、`app/api/services/route.ts` 现有模式一致，未起服务器实测（代码走查确认逻辑无遗漏分支）。项目无既有单元测试框架（无 jest/vitest 配置、仓库内 0 个 *.test.ts），故"全量单元测试"这一项不适用，如需补齐见台账末尾"已知缺口"。
      依赖：单元 0

- [ ] 3. M4+M5 Inventory + Memberships：商品库存 + 优惠券/积分/礼品卡，结账页联动改造
      验收命令：`npx tsc --noEmit`；手动测试结账选商品扣库存、输入券码打折、用积分抵扣、礼品卡抵扣
      可看物：docs/shots/20260928-checkout-inventory-membership.png
      定性状态：待你确认
      证据：（执行后回填）
      依赖：单元 0（M4/M5 共用 CheckoutModal.tsx，合并为一个单元避免冲突）

- [ ] 4. M2+M6 脚手架：Resend/Twilio/Mailchimp 设置页 + dry-run 模式（无 Key 时只记日志不真发）
      验收命令：`npx tsc --noEmit`；无 Key 时调用发送接口应返回"未配置，已跳过"而非报错
      可看物：docs/shots/20260928-integrations-settings.png
      定性状态：待你确认
      证据：（执行后回填）
      依赖：单元 0

## 已知缺口（不在本轮台账内，记录不遗忘）
- 项目至今没有 `scripts/verify.sh`（CLAUDE.md 七节要求的技术验收脚本），本轮只补最小验证（tsc + 手动断言），完整的鉴权探针/性能基线/查询数探针是更大的独立缺口，需要单独立项补齐。
