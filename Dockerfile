# Stage 1: Dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Install runtime deps
RUN npm install -g prisma tsx

# 1. Copy the standalone files FIRST
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# 2. Copy the static/public files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 3. Copy required files for Prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma/
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.js ./
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./

# Install bcryptjs locally in the app directory
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/@types/bcryptjs 2>/dev/null || true

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run migrations and seed on startup
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && node server.js"]