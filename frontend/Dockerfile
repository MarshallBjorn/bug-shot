# --- development (docker-compose.dev.yml uzywa target: development) ---
FROM node:24-alpine AS development
USER node
WORKDIR /app
ENV NODE_ENV=development
COPY --chown=node:node package*.json ./
RUN npm ci
COPY --chown=node:node . .
EXPOSE 5173
USER node
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# --- builder (tylko wewnetrznie, produkuje dist/) ---
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- production (domyslny stage bez --target, uzywany przez CI i prod) ---
FROM nginx:1.28-alpine AS production
RUN apk update && apk upgrade --no-cache
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
