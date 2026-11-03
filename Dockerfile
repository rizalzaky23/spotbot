# ==============================================================================
# Stage 1: Build TypeScript application
# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install build tools for native addons
RUN apk add --no-cache python3 make g++ gcc

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ==============================================================================
# Stage 2: Production Runtime (Alpine Linux + Precompiled Librespot)
# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

# Install runtime dependencies: FFmpeg, ALSA, and precompiled librespot from Alpine Edge
RUN apk add --no-cache \
    ffmpeg \
    alsa-lib \
    libgcc \
    libstdc++ \
    ca-certificates \
    && apk add --no-cache --repository=https://dl-cdn.alpinelinux.org/alpine/edge/testing librespot

COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Create cache directory with proper permissions
RUN mkdir -p /app/cache && chown -R node:node /app

USER node

ENV NODE_ENV=production
ENV LIBRESPOT_PATH=/usr/bin/librespot
ENV LIBRESPOT_CACHE_DIR=/app/cache

CMD ["node", "dist/index.js"]
