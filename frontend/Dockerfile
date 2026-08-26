# syntax=docker/dockerfile:1

FROM node:24-alpine AS development
WORKDIR /app

ENV NODE_ENV=development

# instalacja jako node zeby node_modules nie nalezalo do roota
RUN chown node:node /app
USER node

COPY --chown=node:node package*.json ./
RUN npm ci

COPY --chown=node:node . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
