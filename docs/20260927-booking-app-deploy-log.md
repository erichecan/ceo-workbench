# booking-app 部署效果日志

## 2026-09-27 · 新增公开预约页面 `/book/[slug]`

**这次改动想达成什么**：给还没签约的新客户（美甲/美容等）看 demo、促成交用——不用注册登录，客户打开
`/book/<店铺slug>` 就能看到这家店的服务项目并提交预约请求。换一个店的 demo 只需要在数据库里加一条
Workspace + Service 记录（换店名/logo/服务项），不用改代码。

**技术观测**（我负责，见下）：
- GitHub Actions `deploy-booking-portal.yml` 跑绿：https://github.com/erichecan/ceo-workbench/actions/runs/36292824276
- 生产库手动加了 `Workspace.logoUrl` 字段（精确 ALTER TABLE，避开 db push 漂移风险，见任务台账
  `docs/20260913-预约系统迁移archive-beauty-tasks.md` 2026-09-27 条目）
- 部署后独立验证（不是只信 workflow 自带的 verify 步骤）：
  - `/book/lead-99`（真实客户 Shine Nail Studio）→ 200
  - `/book/不存在的slug` → 404
  - `/login` → 200，`/calendar`（未登录）→ 307，老功能未受影响
- `code-review high` + `security-review` 跑过，无高/中置信度问题；时区换算用 EDT/EST/Dublin 三组夏令时
  边界案例验证过

**定性观测**（Eric/客户负责，具体问一句什么、问谁）：
- 还没有真实的新客户 demo 数据配置进去（Shine Nail Studio 目前 0 个可在线预约的服务项，`/book/lead-99`
  打开是空列表，这是预期状态，不是 bug）。下一步是给某个目标行业（美甲/美容/私教）配一条真实 Workspace +
  几个 Service 记录，然后拿这个链接去问一个具体的目标客户："这个预约页面像不像给你店做的、你愿不愿意
  在这上面填一次预约看看" —— 这句话还没问出去，不能算这个功能已经产生获客效果
- 状态：**待观测**（技术上线，定性效果没验证）——下次会话开头先看这句是否已经问出去、得到了什么回应

## 遗留缺口（非本次范围，记录不阻塞）
- U11 卡片预览功能仍未搬迁到 booking-app，如果 Shine Nail Studio 需要这个功能，是当前生产环境的真实
  功能缺口（详见任务台账）
