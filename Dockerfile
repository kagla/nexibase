# syntax=docker/dockerfile:1.6

# =========================================
# Builder — installs deps and builds Next.js
# =========================================
FROM node:20-slim AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY . .
RUN npm ci
RUN npm run build

# =========================================
# Runner — minimal runtime image
# =========================================
FROM node:20-slim AS runner

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=builder /app ./

EXPOSE 3000

# On startup: apply DB migrations, then start Next.js
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
