FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
RUN mkdir log && chown node:node log

ENV NODE_ENV=production
EXPOSE 3376
USER node
CMD ["node", "src/server.js"]
