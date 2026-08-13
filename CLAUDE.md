# CLAUDE.md

本文件为 Claude Code 在本项目中的常驻规则。

## 联网抓取规则（⛔ 不可绕过）

**所有联网抓取优先走 `opencli`，禁用 Playwright / chrome-devtools-mcp。**

### 为什么

opencli 走 Browser Bridge（Chrome 扩展）附着到**日常那个 Chrome** 的 profile，用的就是平时刷网页的 cookie。Playwright / chrome-devtools-mcp 起的是独立 `user-data-dir` 的干净实例，调试时新开窗口登录态就丢，每次都要重新扫码。

附带两个好处：`-f json` 直接拿结构化字段省 token；站点改版由适配器兜底，不用自己修 DOM 选择器。

### 怎么用

动手抓之前先查有没有现成适配器：

```bash
opencli list              # 全部可用命令（160+ 站点适配器）
opencli <site> --help     # 某站点支持的子命令
opencli doctor            # 环境自检（daemon + 扩展是否 connected）
```

常见适配器：xiaohongshu、weibo、bilibili、douyin、zhihu、twitter、youtube、reddit、github、v2ex、xueqiu、taobao、jd、linkedin、instagram、tiktok、weixin、toutiao、juejin、douban、xiaoyuzhou 等。

⛔ **小红书（xiaohongshu）强制走 opencli**，不要用 CDP / Playwright / chrome-devtools-mcp。

### 登录态的坑

⚠️ **`opencli auth status` 不能当真相** —— 它只做 quick check（看 cookie 存不存在），不验证有效性。实测出现过它报 `logged_in: true` 但真实请求直接 `AUTH_REQUIRED`。

确认登录态要跑真实的只读命令，例如：

```bash
opencli xiaohongshu search 测试 --limit 1
```

同一站点的**主站与创作者/后台子域 cookie 往往相互独立**（如 www.xiaohongshu.com 与 creator.xiaohongshu.com），可能一个通一个不通，按需分别验。

登录过期时跑 `opencli <site> login`——会在用户浏览器里开登录页等扫码，属于需要用户参与的动作，先告知用户，不要自己闷头跑。

### 回退路径

opencli 未覆盖的站点，或适配器结果不满足需求时，才回退到 `web-access` skill 的 CDP 模式（该 skill 已同步为「opencli 第 0 优先级」）。
