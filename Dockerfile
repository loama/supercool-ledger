FROM oven/bun:1.4.0-alpine AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.4.0-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY migrations ./migrations
COPY scripts ./scripts
COPY src ./src
USER bun
EXPOSE 3000
CMD ["bun", "run", "start"]
