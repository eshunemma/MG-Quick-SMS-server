# ---------------------
# Stage 1: Builder
# ---------------------
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first (to leverage Docker cache)
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy the rest of the source code
COPY . .

# If using TypeScript, build it (otherwise skip)
# RUN npm run build

# ---------------------
# Stage 2: Runtime
# ---------------------
FROM node:18-alpine AS runtime

WORKDIR /app

# Only copy package files and install prod deps
COPY package*.json ./
RUN npm install --only=production

# Copy built app from builder stage
COPY --from=builder /app . 

# Expose port (Vercel/Heroku/etc may override)
EXPOSE 3000

# Start app
CMD ["npm", "start"]
