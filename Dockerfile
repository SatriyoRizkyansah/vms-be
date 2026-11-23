FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npm run db:generate

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
