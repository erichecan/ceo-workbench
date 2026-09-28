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

- [ ] 1. M1 日历运营：预约冲突检测 + 月视图/多员工分栏 + 客户详情历史记录
      验收命令：`npx tsc --noEmit`；手动测试同员工同时段建两条预约应被拒绝
      可看物：docs/shots/20260928-calendar-month-view.png
      定性状态：待你确认
      证据：（执行后回填）
      依赖：单元 0

- [ ] 2. M3 Payroll：工时打卡 + 服务提成比例 + 结算周期报表页
      验收命令：`npx tsc --noEmit`；手动测试一笔 Sale 生成后 PayrollPeriod.commissionTotal 计算正确
      可看物：docs/shots/20260928-payroll-page.png
      定性状态：待你确认
      证据：（执行后回填）
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
