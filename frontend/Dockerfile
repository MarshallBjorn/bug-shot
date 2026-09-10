# --- development (docker-compose.dev.yml uzywa target: development) ---
FROM node:24-alpine3.24 AS development
WORKDIR /app
RUN apk upgrade --no-cache && apk upgrade
RUN chown node:node /app
USER node
ENV NODE_ENV=development

COPY --chown=node:node package*.json ./
RUN npm ci
COPY --chown=node:node . .
EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# --- builder (tylko wewnetrznie, produkuje dist/) ---
FROM node:24-alpine3.24 AS builder
WORKDIR /app
RUN apk upgrade --no-cache && apk upgrade
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL
ARG VITE_MEDIA_BASE_URL
ARG VITE_PROJECT_ID
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_MEDIA_BASE_URL=$VITE_MEDIA_BASE_URL \
    VITE_PROJECT_ID=$VITE_PROJECT_ID
RUN npm run build

# --- production (domyslny stage bez --target, uzywany przez CI i prod) ---
FROM nginx:1.31.4-alpine3.24 AS production
RUN apk upgrade --no-cache && apk upgrade
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
