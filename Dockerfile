# Stage 1: Dependencies
FROM node:22-slim AS deps
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/
COPY prisma.config.js ./  

RUN npm config set fetch-retry-maxtimeout 600000 \
 && npm config set fetch-retry-mintimeout 60000 \
 && npm config set fetch-retries 10 \
 && npm ci

# Stage 2: Builder
FROM node:22-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Remove development dependencies to keep production node_modules small
FROM node:22-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/
COPY prisma.config.js ./
COPY --from=deps /app/node_modules ./node_modules
RUN npm prune --production

# Stage 3: Runner
FROM node:22-slim AS runner
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# Copy pruned production node_modules — avoids missing transitive deps (effect, etc.)
COPY --from=prod-deps /app/node_modules ./node_modules

# 1. Copy standalone files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Rename generated server.js to next-server.js
RUN mv server.js next-server.js

# Copy our custom server wrapper to server.js
COPY --from=builder --chown=nextjs:nodejs /app/custom-server.js ./server.js

# 2. Copy static/public files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 3. Copy Prisma + config + data files
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma/
COPY --from=builder --chown=nextjs:nodejs /app/data ./data/
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.js ./
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]