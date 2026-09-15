ARG NODE_BASE_IMAGE=node:22.23.1-bookworm-slim@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3
ARG POWERSHELL_BASE_IMAGE=mcr.microsoft.com/powershell:7.5-debian-12@sha256:7ab5bd5ca6f95a3351fa0c6a1205237d57048c94542355aab55519a0861a9b25
ARG WORKBENCH_DEPLOYMENT_ID

FROM ${NODE_BASE_IMAGE} AS ci-base
WORKDIR /app

FROM ${POWERSHELL_BASE_IMAGE} AS powershell

FROM ci-base AS ci-tools
COPY --from=powershell /opt/microsoft/powershell/7 /opt/microsoft/powershell/7
RUN apt-get update \
    && apt-get install --no-install-recommends --yes git libicu72 libssl3 python-is-python3 python3 \
    && ln -s /opt/microsoft/powershell/7/pwsh /usr/local/bin/pwsh \
    && rm -rf /var/lib/apt/lists/*

FROM ci-base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM ci-base AS builder
WORKDIR /app
ARG WORKBENCH_DEPLOYMENT_ID
ENV WORKBENCH_DEPLOYMENT_ID=${WORKBENCH_DEPLOYMENT_ID}
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json next.config.mjs tsconfig.json ./
COPY src ./src
COPY scripts/config/next-artifact-layout.mjs ./scripts/config/next-artifact-layout.mjs
COPY scripts/quality/clean-next-build-artifacts.mjs ./scripts/quality/clean-next-build-artifacts.mjs
COPY scripts/quality/check-portfolio-record-bundles.mjs ./scripts/quality/check-portfolio-record-bundles.mjs
RUN test -n "$WORKBENCH_DEPLOYMENT_ID" && npm run build

FROM ci-base AS runner
WORKDIR /app
ARG WORKBENCH_DEPLOYMENT_ID
ENV NODE_ENV=production
ENV WORKBENCH_DEPLOYMENT_ID=${WORKBENCH_DEPLOYMENT_ID}
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN apt-get update \
    && apt-get install --no-install-recommends --only-upgrade --yes libpcre2-8-0=10.42-1+deb12u1 \
    && rm -rf /var/lib/apt/lists/*
COPY --chown=node:node --from=builder /app/.next-build/standalone ./
COPY --chown=node:node --from=builder /app/.next-build/static ./.next-build/static
COPY --chown=node:node scripts/runtime/workbench-healthcheck.mjs ./healthcheck.mjs
RUN rm -rf \
    /usr/local/lib/node_modules/npm \
    /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/bin/corepack \
    /usr/local/bin/yarn \
    /usr/local/bin/yarnpkg \
    /opt/yarn-v1.22.22
USER node
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=5 CMD ["node", "healthcheck.mjs"]
CMD ["node", "server.js"]
