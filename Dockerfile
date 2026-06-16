# --- Build Stage ---
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Install build tools needed for native C/C++ node-gyp bindings
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json tsconfig.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Production Stage ---
FROM node:20-bookworm-slim
WORKDIR /app

# Install Python 3 (required by yt-dlp at runtime)
RUN apt-get update && apt-get install -y \
    python3 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY scripts/ ./scripts/

# Install only production dependencies and trigger postinstall patch script
RUN npm ci --omit=dev

# Copy compiled TypeScript from build stage
COPY --from=builder /app/build ./build

# Create directory for persistent cookies volume mount
RUN mkdir -p data

CMD ["npm", "start"]