# CEO 站点 — 构建期把看板/账本/文档编译成静态页，运行期零依赖。
#
# ⚠️ server 是 .cjs 不是 .js：本仓库 package.json 带 "type": "module"，
#    而这个服务器用的是 require/__dirname。改扩展名是最小代价的解法，
#    改写成 ESM 会动到一个带 Basic Auth 的生产服务，不值得。
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
# ⚠️ --ignore-scripts 是必需的，不是优化：
#    本仓库的线索发现器依赖 better-sqlite3（原生模块），而 alpine 是 musl，
#    拿不到预编译包会现场 node-gyp，node:20-alpine 里没有 python3/make/g++，
#    直接 `npm ci` 必定失败（2026-08-12 实测 exit 1）。
#    站点构建期只用到 marked（纯 JS，无 install 脚本），跳过脚本完全够用；
#    lockfile 仍然生效，版本确定性没丢。
RUN npm ci --ignore-scripts
COPY . .
RUN node site/build.mjs

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 site
COPY --from=builder --chown=site:nodejs /app/site/dist ./site/dist
COPY --chown=site:nodejs site/server.cjs ./site/server.cjs
USER site
EXPOSE 8080
CMD ["node", "site/server.cjs"]
