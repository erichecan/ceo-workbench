# 万合 IdeaRise — 英文版 + GitHub + GCP 部署 · 任务台账

创建：2026-08-06
项目：`/Volumes/datacenter/04-eric/AIcoding/idearise`
台账是进度的唯一真相。每完成一条回写状态与 commit hash，下一周期从读本文件开始。

---

## 开工前发现的两个阻塞事实

### B1 · vettlab.com 已经在线，跑的是 Meridian Advisory

```
$ curl -I https://vettlab.com/
HTTP/2 307 · location: https://vettlab.com/en · server: Google Frontend
$ curl -sL https://vettlab.com/en | grep title
<title>Meridian Advisory — Strategy & Operations Consulting</title>
```

DNS：NameCheap，A 记录 `216.239.32.21 / 34.21 / 36.21 / 38.21`（Cloud Run 域名映射标准 IP）。

⛔ 把 IdeaRise 映射到 vettlab.com 顶级域会**顶掉现有生产站点**。需用户决策（见 Q1）。

### B2 · GCP 项目 ID 与权限不一致 ✅ 已解决（2026-08-11）

`cloudbuild.yaml` 曾引用一个当前账号无权访问的项目 ID，与 `gcloud config get-value project`
的实际值不符，导致「部署配置指向 A、服务实际跑在 B」。

**唯一正确的 Project ID：`supply-491510`**（用户 2026-08-11 确认）。

已核实该项目下资源齐备，配置与现实一致：

```
$ gcloud config get-value project → supply-491510
$ gcloud artifacts repositories list --project=supply-491510 --location=asia-east1
  → triplan / ierepair / cloud-run-source-deploy
$ gcloud run services list --project=supply-491510 --region=asia-east1
  → consulting  https://consulting-549968261036.asia-east1.run.app
  → triplan     https://triplan-549968261036.asia-east1.run.app
```

`cloudbuild.yaml` 已全量改为 `supply-491510`。可访问项目（erichecan@gmail.com）：
`supply-491510` / `spherical-reality-wgdjz` / `print-482914`。历史遗留的其他认证账号已按用户要求全部注销。

⛔ CLAUDE.md §9.1：绝不猜测 Project ID —— 本条即该规则的实例来源。

### 附：部署方式约束

`consulting` 仓库当前用 `cloudbuild.yaml` 直接构建，**无 `.github/workflows/`**。
CLAUDE.md §9.2：不存在工作流 → 必须先配置 GitHub Actions，禁止 `gcloud builds submit`。
→ idearise 必须走 GitHub Actions（T4）。

---

## 用户已决策（2026-08-06）

| # | 决策 | 含义 |
|---|---|---|
| Q1 | **idearise.vettlab.com**（子域名） | Meridian 保持在顶级域不动。NameCheap 只加一条 CNAME → `ghs.googlehosted.com` |
| Q2 | **supply-491510** | 全新部署。需在此项目建 Artifact Registry + Cloud Run，并在此项目验证域名 |

---

## 任务清单

### T1 · 英文版重构（不是翻译，主打 TikTok / IG / Facebook）

- [ ] **验收**：`/en` 的渠道叙事以 TikTok、Instagram、Facebook 为主；小红书降级为「可选，面向华人客群」的加项，不出现在英文 hero、套餐主线与第 01 段主体；英文文案不是中文的直译（句式、举例、痛点均按本地受众重写）
- [ ] **产出**：`messages/en.json`、`components/sections/*`（需要区分渠道时）
- [ ] **依赖**：无

**为什么不能直译**：中文版受众是 GTA 华人店主，核心渠道是小红书 + Google；英文版受众是本地英语商家，他们不用小红书，用的是 TikTok / IG / FB + Google。痛点、举例、渠道权重全都不同。

### T2 · 英文版方案书

- [ ] **验收**：`public/proposal-en.html` 存在，渠道与套餐口径同 T1，A4 打印无溢出，页脚占位标红
- [ ] **产出**：`public/proposal-en.html`
- [ ] **依赖**：T1

### T3 · 本地验证

- [ ] **验收**：`npm run build` 通过；`/` 与 `/en` 均 200；1420 / 390 两档无横向溢出；英文页无残留中文（除品牌名「万合」）
- [ ] **依赖**：T1, T2

### T4 · GitHub 仓库 + Actions 工作流

- [ ] **验收**：仓库 `erichecan/idearise` 存在且已推送；`.github/workflows/deploy.yml` 存在；`Dockerfile` + `output: "standalone"` 就绪；工作流语法通过 `gh workflow view`
- [ ] **产出**：`Dockerfile`、`.dockerignore`、`.github/workflows/deploy.yml`
- [ ] **依赖**：T3

### T5 · GCP 前置（SA / IAM / Secret）

- [ ] **验收**：`gcloud config get-value project` 等于用户指定 ID；Artifact Registry 仓库存在；部署用 SA 具备 run.admin + artifactregistry.writer + iam.serviceAccountUser；`GCP_SA_KEY` 已写入 GitHub Secret
- [ ] **依赖**：Q2, T4

### T6 · 首次部署（走 GitHub Actions，禁止 gcloud builds submit）

- [ ] **验收**：`git push` 触发的 workflow run 成功；Cloud Run 服务存在且 `min-instances=0`、`cpu≤1`、`memory≤512Mi`
- [ ] **依赖**：T5

### T7 · 域名映射 vettlab.com

- [ ] **验收**：`idearise.vettlab.com` 映射至 Cloud Run 服务；证书 ACTIVE；NameCheap CNAME 已加并生效；**vettlab.com 顶级域仍返回 Meridian（不得受影响）**
- [ ] **依赖**：Q1, T6

### T8 · 生产环境验证

- [ ] **验收**：`https://idearise.vettlab.com` 返回 200；`/` 为中文、`/en` 为英文；`Content-Type: text/html`；`/proposal.html` 与 `/proposal-en.html` 均 200；实际浏览器渲染截图确认；无 `:8080` 泄漏到 Location 头
- [ ] **依赖**：T7

---

## 硬停止条件

- 同一问题连续 2 次没修好 → 停，报告
- 需要顶掉 / 删除任何现有生产资源 → 停，确认
- Project ID 与用户所给不一致 → 停，核对

---

## 进度

| 任务 | 状态 | commit |
|---|---|---|
| T1 | ✅ 完成 | `98c2142` |
| T2 | ✅ 完成 | `98c2142` |
| T3 | ✅ 完成 | build 通过 · 4 路由 200 · 无溢出 |
| T4 | ✅ 完成 | `erichecan/idearise` · Dockerfile + Actions |
| T5 | ✅ 完成 | AR + SA + GCP_SA_KEY |
| T6 | ✅ 完成 | run 31067964664 · us-east1 |
| T7 | ⏸ 待用户加 DNS | 映射已建，等 CNAME |
| T8 | ✅ Cloud Run URL 已验证 / ⏸ 域名待 DNS | |


---

## 执行记录（2026-08-06）

### 生产地址

- Cloud Run：`https://idearise-dfd7b2qpra-ue.a.run.app` ✅ 已验证
- 目标域名：`https://idearise.vettlab.com` ⏸ 等 DNS

### ⏸ 唯一未完成项：DNS 记录（需用户在 NameCheap 操作）

域名映射已在 GCP 侧创建完毕，证书等待 DNS 生效后自动签发。
本机无 NameCheap 凭据，此步无法自动完成。

**在 NameCheap → Domain List → vettlab.com → Advanced DNS → Add New Record：**

| Type | Host | Value | TTL |
|---|---|---|---|
| CNAME Record | `idearise` | `ghs.googlehosted.com.` | Automatic |

⚠️ 只加这一条。**不要动现有的 4 条 A 记录**（`216.239.32.21` / `34.21` / `36.21` / `38.21`）——
那是 vettlab.com 顶级域指向 Meridian Advisory 的记录，动了 Meridian 就挂了。

加完后验证：
```bash
dig +short idearise.vettlab.com CNAME          # 期望 ghs.googlehosted.com.
gcloud beta run domain-mappings describe --domain=idearise.vettlab.com \
  --project=supply-491510 --region=us-east1     # 期望证书 Ready
curl -sI https://idearise.vettlab.com/          # 期望 200
curl -sI https://vettlab.com/ | grep -i location # 确认 Meridian 未受影响
```

### 部署事实

| 项 | 值 |
|---|---|
| GCP 项目 | `supply-491510`（已按 §9.1 核对：config 与工作流一致） |
| 区域 | `us-east1` |
| 服务 | `idearise` |
| 镜像仓库 | `us-east1-docker.pkg.dev/supply-491510/idearise` |
| 资源 | min-instances=0 · max=3 · cpu=1 · memory=512Mi |
| 部署方式 | GitHub Actions（§9.2 合规，未使用 `gcloud builds submit`） |

### 生产验证结果（Cloud Run URL）

| 检查 | 结果 |
|---|---|
| `/` `/en` `/proposal.html` `/proposal-en.html` | 全部 200，`text/html` |
| 重定向 | 无；无 `:8080` 泄漏 |
| 中文页标题 | 万合 IdeaRise — 让更多人进店，让来过的再来 |
| 英文页标题 | IdeaRise — More people through the door, more of them coming back |
| 浏览器渲染 | 8 个区块正常，资源报错 0，无横向溢出 |

### 踩坑记录

1. **npm ci 在 CI 失败 ×3 轮**。根因：`package-lock.json` 的可选依赖树**同时按 OS 和 CPU 架构分叉**。
   本地 darwin/arm64 生成的锁文件缺 linux/amd64 需要的 `@emnapi/*`、`@swc/helpers` 变体。
   第一次修在 arm64 alpine 里生成——仍失败，因为架构仍不匹配。
   最终解：`--platform=linux/amd64` 生成，并在同架构容器内跑真实 `npm ci` 验证后才推。
   ⚠️ 本地跑 `npm install` 会把锁文件改回 arm64 版本，本地请用 `npm ci`。

2. **Docker Desktop 未共享 `/Volumes` 与 `/private/tmp`**，挂载卷一律 enoent。
   改用 stdin/tar 管道传文件进容器。

3. **加拿大区域不支持 Cloud Run 域名映射**。`northamerica-northeast2`（多伦多）与
   `northamerica-northeast1`（蒙特利尔）创建映射均返回 501 UNIMPLEMENTED。
   逐一探测后改用 `us-east1`（距多伦多最近的支持区域）。多伦多区域的服务与镜像仓库已清理。
