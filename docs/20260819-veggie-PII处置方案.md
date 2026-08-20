# veggie 仓库 PII 泄露处置方案（c-d17237）

> 执行人：compliance-officer 子代理
> 日期：2026-08-19
> 仓库：`erichecan/veggie`（本地路径 `/Volumes/datacenter/04-eric/AIcoding/veggie`）
> 关联事故卡：`c-d17237`
> 本文档范围：验收标准 ②③④⑤ 的调查结果、可执行方案、以及需要 Eric 决策的事项。
> ⛔ 本轮只做了只读调查 + 可逆防护改动（.gitignore、pre-commit hook、本文档）。
> 历史改写（filter-repo/BFG/force-push）**未执行**，仅在下文给出可直接执行的命令方案。

---

## 一、结论摘要

1. **验收①（转 private）** 已完成，本轮复核：`gh repo view erichecan/veggie` 确认 `isPrivate: true`。
2. **验收②（历史清除）未完成**。更严重的是：PII 文件**不是"历史遗留、当前已删除"，而是当前 HEAD 仍在跟踪**（本地分支与 `origin/main` 都有），比原始事故卡描述的情况更差一档。
3. **新发现、超出原事故卡范围**：一份真实客户发票 PDF（`发票的 PDF 格式Sales-Order-D120827.pdf`）自初始提交起就被跟踪，同样暴露。
4. **好消息**：`pic/` 目录下约 61 张截图 PNG **从未被 git 跟踪过**（`git log --all -- 'pic/*.png'` 无结果，因为 `*.png` 早被 `.gitignore` 排除），此前怀疑的"截图暴露真实客户数据"这一风险点可以排除。
5. **验收④（.gitignore + pre-commit）本轮已直接实施**（授权范围内的可逆改动），见第五节。
6. **验收⑤（其余公开仓库排查）已完成**：`print`/`seomachine`/`easetax`/`satgame` 未发现客户 PII；`businessskills` 发现的是抓取的小红书公开评论（不同风险类别，非客户 PII，见第六节）。

---

## 二、当前暴露范围（HEAD 仍跟踪，非仅历史）

`git ls-files | grep '^pic/'` 确认以下文件**现在**仍在仓库working tree/HEAD 中被跟踪（本地分支 `feat/uom-overhaul-and-purchase-import` 与远端 `origin/main` 一致）：

| 文件 | 内容 | 规模 |
|---|---|---|
| `pic/res.partner.csv` | 客户主数据：id/price_type/**email**/comment/**phone**/**street**/**city**/name/pricelist | 1326 条客户记录（1327 行含表头） |
| `pic/backup-20260715/res.partner-old.csv` | 同上，2026-07-15 全量同步的旧版备份 | 1466 条记录 |
| `pic/sale.order (1).csv` | 订单：Order Reference/Customer/Order Date/Total/Salesperson 等 | 25493 条订单记录 |
| `pic/发票的 PDF 格式Sales-Order-D120827.pdf` | 真实客户发票（姓名/地址/订单明细），**原事故卡未提及** | 41KB，1 份 |
| `pic/crm.team.csv` | 销售团队配置 | 97 条 |
| `pic/product.pricelist.csv` / `product.product.csv` | 商品价格表/商品目录 | — |
| `pic/backup-20260715/product.pricelist-old-20260620.csv` / `product.product-old.csv` | 同上旧版备份 | 3274 / 1798 条 |

抽样验证 `res.partner.csv` 真实内容（`git show HEAD:pic/res.partner.csv`）：表头为
`"id","price_type","email","comment","phone","street","city","name","property_product_pricelist/id"`，
后续行为真实商户名/地址，例如 "818 Cake Studio D13"、"A&D De Rubeis Ltd T/A Roxy takeaway Swords" 等 —— 确认为真实客户 PII，非测试数据。

---

## 三、事实时间线（能核实的写核实结论，不能核实的明确标注"无法核实"）

| 时间 | 事件 | 证据来源 |
|---|---|---|
| 2026-05-29 02:47:43Z | 仓库创建，**创建时即为 public**（`createdAt` + 首个 `PublicEvent`） | `gh repo view --json createdAt`；`gh api repos/erichecan/veggie/events` |
| 2026-05-29（同一提交 `a1bf745` "Initial commit"） | `res.partner.csv`、`sale.order (1).csv`、`crm.team.csv`、`product.pricelist.csv`、`product.product.csv`、发票 PDF **首次提交入库**，随仓库一起处于 public 状态 | `git log --all --diff-filter=A --name-only` |
| 2026-07-15 22:32:24-04:00（提交 `1f36326`） | 追加 `pic/backup-20260715/` 下三份旧版备份 CSV | 同上 |
| 2026-08-04 ~ 2026-08-17（GitHub 仅保留 14 天窗口，之前的数据已不可追溯） | Traffic API 记录到 **73 次 clone、9 个 unique cloner**；峰值在 2026-08-16（当日 9 次 clone / 8 个 unique cloner，同日 views 9 次/1 unique） | `gh api repos/erichecan/veggie/traffic/clones` `/traffic/views` |
| 2026-08-16 | 合规审查员排查发现问题（事故卡记录的发现日期），与上条 clone/view 峰值同一天——**不能排除峰值就是本次排查本身产生的**，也不能排除是外部访问，现有数据无法区分 | 事故卡 history；traffic API 相关性推断 |
| 2026-08-19（本轮复核前） | 仓库已转为 `PRIVATE` | `gh repo view --json isPrivate` → `true` |
| **公开→私有的确切转换时刻** | **无法核实**。GitHub Events API 对已转 private 的仓库会把历史事件全部标记为 `"public": false`（回溯性遮蔽），无法从事件流反推确切转换时间点；仓库设置页/审计日志需要 GitHub 企业版或组织级审计日志权限，个人仓库无此入口 | 已尝试 `gh api .../events`，逐条核对无果 |

**结论**：仓库从创建（2026-05-29）到转 private（2026-08-19 之前某时刻）之间，**至少约 82 天处于公开状态**，其中 GitHub 仅保留了最后 14 天（8/4–8/17）的访问统计，更早期是否被访问/克隆完全没有数据支撑，只能如实告知"无法排除更早期间已被外部获取"。

**Fork / PR / 协作者审计**（验收②要求的"确认副本已处理"前置调查）：
- Forks：`gh api repos/erichecan/veggie/forks` → `[]`，无 fork。
- PR：`gh api "repos/erichecan/veggie/pulls?state=all"` → `[]`，从未有 PR。
- 协作者：`gh api repos/erichecan/veggie/collaborators` → 仅 `erichecan`（owner/admin），从未添加过其他协作者。
- **结论**：没有 GitHub 侧的 fork/PR 副本需要额外处理。但 73 次 clone（9 个 unique cloner）中有多少是外部真实获取、多少是 `.github/workflows/*.yml` 里 CI runner 的 `actions/checkout`（也会计入 clone 统计）、多少是本次排查自己的操作，**现有数据无法精确拆分**，需要如实告知 Eric 这一局限。

---

## 四、历史清除方案（仅方案，未执行，需 Eric 授权）

### 4.0 前置步骤：先阻止未来暴露（比历史改写风险低得多，建议优先做）

在做不可逆的历史改写之前，可以先做一步**可逆**操作，把当前 HEAD 中仍在跟踪的 PII 文件移出版本控制（不改写历史，只是新增一次正常提交）：

```bash
cd /Volumes/datacenter/04-eric/AIcoding/veggie
git rm --cached \
  "pic/res.partner.csv" \
  "pic/sale.order (1).csv" \
  "pic/crm.team.csv" \
  "pic/product.pricelist.csv" \
  "pic/product.product.csv" \
  "pic/backup-20260715/res.partner-old.csv" \
  "pic/backup-20260715/product.pricelist-old-20260620.csv" \
  "pic/backup-20260715/product.product-old.csv" \
  "pic/发票的 PDF 格式Sales-Order-D120827.pdf"
git commit -m "security: 移除 pic/ 下仍在跟踪的客户 PII 导出文件（c-d17237）"
git push origin feat/uom-overhaul-and-purchase-import   # 以及需要同步到 main 的分支
```

这一步**未执行**（我判断这已经是"修改当前被跟踪的仓库内容"，超出本轮"仅 .gitignore + 文档"的直接授权范围），但风险远低于历史改写——不 force-push、不改写 commit hash、随时可 revert。**建议 Eric 先批这一步**，即使暂不批准历史改写，也能立刻停止"每次 clone 都会拿到最新 PII"的问题。

### 4.1 历史彻底清除（不可逆，需要 fork/clone 审计 + Eric 明确同意后才执行）

推荐 `git filter-repo`（比 BFG 更新、官方推荐、Git 团队维护）。本机当前**未安装**，需要先 `brew install git-filter-repo`（本轮未执行安装）。

```bash
# 1. 安装工具（本机未装，需先执行）
brew install git-filter-repo

# 2. 强烈建议先打一个完整备份（裸克隆），防止操作出错无法回退
cd /Volumes/datacenter/04-eric/AIcoding
git clone --mirror https://github.com/erichecan/veggie.git veggie-backup-mirror-20260819

# 3. 在工作副本上执行历史清除（清除以下路径在所有历史提交中的内容）
cd /Volumes/datacenter/04-eric/AIcoding/veggie
git filter-repo --force \
  --path "pic/res.partner.csv" \
  --path "pic/backup-20260715/res.partner-old.csv" \
  --path "pic/sale.order (1).csv" \
  --path "pic/crm.team.csv" \
  --path "pic/product.pricelist.csv" \
  --path "pic/product.product.csv" \
  --path "pic/backup-20260715/product.pricelist-old-20260620.csv" \
  --path "pic/backup-20260715/product.product-old.csv" \
  --path "pic/发票的 PDF 格式Sales-Order-D120827.pdf" \
  --invert-paths

# 4. filter-repo 默认会移除 origin remote，需要重新添加
git remote add origin https://github.com/erichecan/veggie.git

# 5. force-push 覆盖远端所有分支与 tag（不可逆，此刻远端旧历史永久消失，
#    但已被外部 clone 走的副本不会被追溯清除——这正是为什么第三节的 fork/clone
#    审计要在此步骤之前做完，并评估是否需要走"通知已知获取方"这条路，而不是
#    误以为 force-push 后问题就"消失"了）
git push origin --force --all
git push origin --force --tags

# 6. GitHub 侧清理悬空对象缓存（避免旧 blob 仍可通过 commit SHA 直接访问）
gh api -X POST repos/erichecan/veggie/actions/caches 2>/dev/null || true
# GitHub 官方文档另建议提交 support ticket 请求清除 "cached views"，
# 这一步无法用 API 自动化，需要人工在 https://support.github.com 提交请求。

# 7. 本地/其他 clone（包括 .claude/worktrees 下的两份副本、.next/standalone 构建产物副本）
#    同步清理或重新 clone，避免旧数据继续留存在本机磁盘
rm -rf /Volumes/datacenter/04-eric/AIcoding/veggie/.next  # 构建产物，可安全删除重新生成
# .claude/worktrees/* 下的副本需要单独处理，是否删除请 Eric 确认（可能有未提交的开发中改动）
```

**执行前必须成立的前提**（本轮已核实，无 fork/PR，需 Eric 确认是否接受剩余风险）：
- ✅ 无 fork、无 PR，GitHub 侧没有已知的"官方"副本需要额外处理。
- ⚠️ 无法排除的风险：14 天窗口外的历史 clone 无数据；本地磁盘上确认存在至少 3 份额外副本（`.claude/worktrees/can-be-sold-purchased-enforcement/pic/*`、`.claude/worktrees/purchase-rfq-copy-history/pic/*`、`.next/standalone/pic/*`），这些是本机文件系统内的副本，不是新的对外暴露面，但清理历史时应一并清掉，避免以后又被误提交。
- history 改写会导致所有基于旧 commit hash 的引用（PR 链接、CI 缓存、本地其他 clone）失效，`.github/workflows/*.yml` 相关的 CI 记录可能需要重新触发确认。

---

## 五、本轮已直接实施的可逆防护改动（验收④）

**1. `.gitignore` 新增规则**（`/Volumes/datacenter/04-eric/AIcoding/veggie/.gitignore`）：

```gitignore
# 20260816 合规审查发现 pic/ 下混有 Odoo 真实客户导出（res.partner/sale.order 等 csv、
# 发票 PDF）及历史备份子目录，曾被公开仓库暴露（c-d17237）。此目录只允许存放脱敏后的
# UI 截图素材；任何 csv/xlsx/xls/sql/pdf 一律禁止入库，需要新增示例数据请用 /pic/samples/
# 之类目录并确认已脱敏。
/pic/**/*.csv
/pic/**/*.xlsx
/pic/**/*.xls
/pic/**/*.sql
/pic/**/*.pdf
/pic/backup-*/
```

> 注意：`.gitignore` 只能防止**未来**新增/重新添加，**不能**让已跟踪文件消失——这也是第四节 4.0 步骤仍然需要单独执行 `git rm --cached` 的原因。

**2. 仓库级 pre-commit hook**（新建 `.githooks/pre-commit`，已 `chmod +x`）：
- 规则 1：拦截文件名匹配 `res.partner|sale.order|crm.team|product.pricelist|product.product` 或 `pic/` 下 csv/xlsx/xls/sql/pdf 的暂存文件。
- 规则 2：对非二进制文件的新增内容做邮箱/电话号码正则扫描，命中则拦截。
- 误报可用 `git commit --no-verify` 绕过（脚本内注明）。

**3. 启用方式**（原生 `core.hooksPath`，不引入 husky 依赖）：
- `package.json` 新增 `"prepare": "git config core.hooksPath .githooks || true"`，任何贡献者执行 `npm install` 时自动启用。
- 本机已手动执行 `git config core.hooksPath .githooks` 并 `bash -n` 语法自检通过，当前立即生效。

以上三项均为纯新增/非破坏性改动，未触碰任何已跟踪文件或生产配置，符合本轮授权范围。

---

## 六、其余公开仓库排查结果（验收⑤）

owner 确认为 `erichecan`（`gh api user --jq '.login'`）。逐一排查 `print`/`seomachine`/`easetax`/`satgame`/`businessskills`（`gh api repos/erichecan/<repo>/git/trees/HEAD?recursive=1` 过滤 csv/xlsx/xls/sql/json，再对可疑命中做 `/contents/<path>` 内容抽查）：

| 仓库 | 数据文件情况 | 结论 |
|---|---|---|
| `print` | `db/products.csv`、`shopify/*.csv`、`db/import_data.sql` 等 | **无客户 PII**，均为商品目录/Shopify 导入模板（CustomInk/Gildan 品类抓取数据），grep 邮箱/电话正则无命中 |
| `seomachine` | 仅配置 JSON | 无数据文件，clean |
| `easetax` | 仅 Prisma `migration.sql`（纯 DDL） | clean（未逐条深挖是否有内嵌 seed INSERT，建议后续如有余力再补查） |
| `satgame` | 仅 Prisma `migration.sql`（纯 DDL） | clean |
| `businessskills` | `xhs/素材库/评论区原话.csv` 等 | 抽样确认为**抓取的小红书公开评论**（匿名引语 + 来源 URL，无姓名/电话/邮箱）——**不是客户 PII，是内容抓取合规问题（平台 ToS 层面），风险类别不同，未做进一步定性，仅作 FYI 提示** |

**结论**：veggie 是目前唯一确认的客户 PII 泄露仓库，其余 4 个业务仓库未发现同类问题。`businessskills` 的抓取内容合规性是另一个话题，建议单独立项评估，不纳入本次 c-d17237 处置范围。

---

## 七、需要 Eric 决策的事项

1. **是否批准 4.0 的 `git rm --cached`**（低风险、可逆，立刻停止"每次 clone 拿到最新 PII"）——建议无论是否做历史改写都先做这一步。
2. **是否批准 4.1 的完整历史改写 + force-push**（不可逆）——已确认无 fork/PR，但无法排除 14 天窗口外的历史访问；批准前请确认是否已同步给客户 GDPR 通知（验收③，需要 Eric 基于本文档的时间线亲自通知客户，本文档不代为通知）。
3. **发票 PDF 属于原事故卡未提及的新发现**，是否需要单独告知客户涉及的具体订单（`Sales-Order-D120827`）。
4. **`businessskills` 的抓取内容**是否需要单独排期评估平台合规风险。
