# 预约后台（portal.js）—— 给客户用、部署到公网的那份。
#
# 单文件 Node 服务，没有编译/打包步骤，跟 site/Dockerfile 的多阶段构建
# 不是一回事。数据在 Postgres（Neon），不用本地 SQLite——所以这里
# --ignore-scripts 能安全跳过 better-sqlite3 的原生编译：portal.js 的整条
# 依赖链（booking.js/card.js/booking-db.js/auth.js）不 import storage.js，
# 运行期不会摸到那个包，alpine 缺 node-gyp 工具链也不影响启动。
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# card.js 靠本机 Chrome headless 截图渲染预约卡（不引 puppeteer——见 card.js
# 文件头注释），本地是 macOS 版 Chrome，容器里换成 apk 装的 chromium，
# 用 CHROME_PATH 指过去，渲染逻辑一行不用改。
#
# font-noto-cjk：macOS 本机渲染时中文能显示，靠的是系统自带的 PingFang 之类
# CJK 字体兜底（CSS 里 "Noto Sans SC" 加载慢/失败时 sans-serif 通用族还有救）；
# alpine 默认一个 CJK 字形都没有，同样的 CSS 在容器里中文全变方块
# （2026-09-13 实测），必须装一个本地 CJK 字体撑住这个兜底，不能只指望
# 截图那一刻 Google Fonts 一定加载完。
RUN apk add --no-cache chromium font-noto-cjk
ENV CHROME_PATH=/usr/bin/chromium-browser

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# 只拷贝 portal.js 真正会用到的东西：代码 + 预约卡底图素材。
# 不拷贝 data/leads.db、data/screenshots 等本地线索抓取产物——那些从不
# 该出现在这个公网服务的镜像里。
COPY src/ ./src/
COPY data/cards/backgrounds/ ./data/cards/backgrounds/

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 portal
RUN mkdir -p /app/data/cards/output && chown -R portal:nodejs /app/data
USER portal

EXPOSE 8080
CMD ["node", "src/portal.js"]
