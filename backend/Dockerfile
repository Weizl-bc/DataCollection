# Build the TypeScript backend in a separate stage so the final image only
# contains the compiled application and production dependencies.
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Runtime image
FROM node:22-alpine

WORKDIR /app
# Docker keeps port 3001 even though the local development .env uses 3002.
ENV NODE_ENV=production \
    PORT=3001

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# The backend loads its environment from /app/.env.
# Keep backend/.env available in the Docker build context when building this image.
COPY .env ./.env

EXPOSE 3001

CMD ["npm", "start"]
