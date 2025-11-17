FROM node:18-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

# 1. Copy manifest files
COPY package.json package-lock.json* ./

# 2. 🔑 Make sure Prisma schema is present for postinstall ("prisma generate")
COPY prisma ./prisma

# 3. Install deps (prod only); postinstall will now see prisma/schema.prisma
RUN npm ci --omit=dev && npm cache clean --force

# 4. Optional: remove Shopify CLI if you don’t need it in the container
RUN npm remove @shopify/cli || true

# 5. Copy the rest of your app
COPY . .

# 6. Build Remix app
RUN npm run build

# 7. Start: runs "setup" (migrations) then "start" (Remix server)
CMD ["npm", "run", "docker-start"]