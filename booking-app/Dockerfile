# 预约系统后台(booking-app,原 archive/beauty 的 apps/web)——直接替换 booking-portal
# 这个 Cloud Run 服务(原来跑 portal.js),不新建独立服务。
#
# Prisma 的生成产物在 lib/generated/prisma(schema.prisma 里自定义了 output,不在
# node_modules 下)。Next standalone 构建自带的文件追踪(outputFileTracingIncludes)
# 实测只会带上 schema.prisma,不会带上真正的 client.js/wasm 查询引擎(2026-09-13
# 本机构建验证过),所以下面手动从 builder 阶段整个目录拷过去,不依赖追踪结果。
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# 构建期占位值——Prisma generate/Next build 只需要能解析出格式合法的值,
# 真正的连接串和密钥由 Cloud Run 在运行期通过环境变量/Secret 注入。
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder?sslmode=require"
ENV JWT_SECRET="build-time-placeholder-do-not-use"

RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone/ ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/lib/generated/prisma ./lib/generated/prisma

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 bookingapp
USER bookingapp

EXPOSE 8080
CMD ["node", "server.js"]
