# syntax=docker/dockerfile:1

FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable

FROM base AS dependencies
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/cms/package.json apps/cms/package.json
COPY apps/publish-web/package.json apps/publish-web/package.json
COPY packages/core/package.json packages/core/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
WORKDIR /app

ARG APP_NAME
ARG BACKEND_URL
ENV BACKEND_URL=$BACKEND_URL

COPY . ./
RUN pnpm --filter @iorder/${APP_NAME} build

# This target deliberately retains the migration tooling and source schema.
# It is run as a one-off Compose service, never exposed to the Internet.
FROM dependencies AS migrations
WORKDIR /app

COPY . ./
CMD ["pnpm", "db:migrate"]

FROM node:22-alpine AS runner
WORKDIR /app

ARG APP_NAME

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=build --chown=nextjs:nodejs /app/apps/${APP_NAME}/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/${APP_NAME}/.next/static ./apps/${APP_NAME}/.next/static
COPY --from=build --chown=nextjs:nodejs /app/apps/${APP_NAME}/public ./apps/${APP_NAME}/public

USER nextjs

EXPOSE 3000

WORKDIR /app/apps/${APP_NAME}

CMD ["node", "server.js"]
