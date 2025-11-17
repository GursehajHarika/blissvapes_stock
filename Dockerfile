# Use a current LTS Node version
FROM node:20-alpine

# Prisma needs OpenSSL
RUN apk add --no-cache openssl

# App directory
WORKDIR /app

# Environment
ENV NODE_ENV=production

# Install dependencies (production only) with proper caching
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force


COPY . .

# Make sure Prisma client is generated before building
RUN npx prisma generate

# Build Remix (server + client)
RUN npm run build

# Render will inject PORT at runtime; default to 3000 for local runs
ENV PORT=3000
EXPOSE 3000

# At runtime: run migrations + start the app
# "docker-start" = "npm run setup && npm run start"
CMD ["npm", "run", "docker-start"]