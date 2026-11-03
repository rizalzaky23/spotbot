# ==============================================================================
# Stage 1: Build Librespot binary using Rust
# ==============================================================================
FROM rust:bookworm AS librespot-builder

WORKDIR /usr/src/librespot

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    libasound2-dev \
    libpulse-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install librespot with pipe backend and libmdns for zeroconf discovery
RUN cargo install librespot --no-default-features --features "pipe-backend with-libmdns"

# ==============================================================================
# Stage 2: Build Node.js TypeScript application
# ==============================================================================
FROM node:22-bookworm-slim AS node-builder

WORKDIR /app

# Install native compilation dependencies for @discordjs/opus
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ==============================================================================
# Stage 3: Production Runtime
# ==============================================================================
FROM node:22-bookworm-slim AS runner

WORKDIR /app

# Install runtime system packages: ffmpeg, libopus, ALSA, CA certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libopus0 \
    libasound2 \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy librespot binary from builder
COPY --from=librespot-builder /usr/local/cargo/bin/librespot /usr/local/bin/librespot

# Copy built app and dependencies
COPY package.json ./
COPY --from=node-builder /app/node_modules ./node_modules
COPY --from=node-builder /app/dist ./dist

# Create cache directory with proper permissions
RUN mkdir -p /app/cache && chown -R node:node /app

USER node

ENV NODE_ENV=production
ENV LIBRESPOT_PATH=/usr/local/bin/librespot
ENV LIBRESPOT_CACHE_DIR=/app/cache

CMD ["node", "dist/index.js"]
