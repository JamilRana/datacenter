# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json ./
# Copy prisma directory for the 'prisma generate' postinstall script
COPY prisma ./prisma
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Environment variables must be present at build time for Next.js to inline them
# Note: We'll use .env.production if it's there
# But for standalone build, some vars are needed during build if they're used in the frontend
# Since we're dockerizing, we'll try to keep them as runtime vars if possible
# or use ARG if they're needed at build time.

# Generate Prisma Client
RUN npx prisma generate

# Disable Next.js telemetry during the build
ENV NEXT_TELEMETRY_DISABLED 1

# Build the Next.js app
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public/ to serve from within the container
COPY --from=builder /app/public ./public
# Copy prisma directory so db push/migrate can be run from within the container
COPY --from=builder /app/prisma ./prisma

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
# set hostname to 0.0.0.0 because it's in a container
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
