# syntax=docker/dockerfile:1

# Stage 1: production dependencies only (cached unless package*.json changes).
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: install all deps and compile TypeScript -> dist.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
# Source copied after npm ci so code changes don't invalidate the deps layer.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 3: minimal runtime — alpine + prod deps + compiled dist only.
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
USER node
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node package.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
