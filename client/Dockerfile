FROM node:18-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY .next .next
COPY public public
COPY pages pages
COPY next.config.js package.json ./

RUN npm run build || true

EXPOSE 3000
CMD ["npm", "run", "start"]
