FROM node:18-alpine

# 1. System deps
RUN apk add --no-cache openssl

# 2. App directory
WORKDIR /app

# 3. Environment
ENV NODE_ENV=production
ENV PORT=10000

# 4. Install deps (INCLUDING devDependencies so Remix can build)
COPY package.json package-lock.json* ./
COPY prisma ./prisma

# Install everything; don't omit dev here because build uses dev tools
RUN npm ci && npm cache clean --force

# 5. Generate Prisma client at build time so it's baked into the image
RUN npx prisma generate

# 6. Copy the rest of the app
COPY . .

# 7. Build Remix app
RUN npm run build

# 8. Start: runs "setup" (migrations) then "start" (Remix server)
# In your package.json:
#   "docker-start": "npm run setup && npm run start"
CMD ["npm", "run", "docker-start"]