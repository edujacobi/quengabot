# --- Build Stage ---
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Install build tools needed for native C/C++ node-gyp bindings
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json tsconfig.json ./
# Copy scripts folder first, as npm ci triggers the postinstall patch script
COPY scripts/ ./scripts/

RUN npm ci

COPY . .
RUN npm run build

# Remove development dependencies (prune) to minimize size
RUN npm prune --omit=dev

# --- Production Stage ---
FROM node:22-bookworm-slim
WORKDIR /app

# Install Python 3 (required by yt-dlp at runtime)
RUN apt-get update && apt-get install -y \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Copy package metadata
COPY package*.json ./

# Copy pre-compiled node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled TypeScript from builder stage
COPY --from=builder /app/build ./build

# Create directory for persistent cookies volume mount
RUN mkdir -p data

CMD ["npm", "start"]