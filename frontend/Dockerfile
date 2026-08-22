# syntax=docker/dockerfile:1

FROM node:24-alpine AS development
WORKDIR /app

ENV NODE_ENV=development

# Future React npm project files should live in this build context.
COPY --chown=node:node package*.json ./
RUN npm ci

COPY --chown=node:node . .

EXPOSE 5173

USER node
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
