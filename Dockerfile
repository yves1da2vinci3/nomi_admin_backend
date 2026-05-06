# ─── Builder : deps complètes + client Prisma généré (pas de tsc ici ; CI / local : `bun run build`) ───
FROM oven/bun:1-slim AS builder
WORKDIR /usr/src/app

COPY package.json bun.lock ./
COPY bunfig.toml ./

RUN bun install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma

RUN bun run prisma:generate

# ─── Runtime : prod deps uniquement + artefacts Prisma depuis builder ───
FROM oven/bun:1-slim AS runner
WORKDIR /usr/src/app

COPY package.json bun.lock ./
COPY bunfig.toml ./

RUN bun install --production --frozen-lockfile

COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma/client ./node_modules/@prisma/client

COPY src ./src
COPY prisma ./prisma

EXPOSE 4001

RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --no-create-home --shell /bin/false nodejs

RUN chown -R nodejs:nodejs /usr/src/app
USER nodejs

CMD ["bun", "run", "src/index.ts"]
