# ---------- deps ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --production

# ---------- prisma generate ----------
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY prisma ./prisma
RUN npx prisma generate

# ---------- runner ----------
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
COPY src ./src
COPY package.json ./
EXPOSE 3000
CMD sh -c "npx prisma migrate deploy; node src/app.js"
