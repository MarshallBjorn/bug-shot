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
# Env-agnostic build: NIE zapiekamy VITE_* w bundle. Konfiguracja srodowiskowa
# (API URL itd.) wstrzykiwana jest w runtime przez /config.js — patrz
# docker-entrypoint.sh + src/config.ts. Dzieki temu ten sam obraz jedzie na kazde
# srodowisko (build once -> retag -> deploy).
RUN npm run build

# --- production (domyslny stage bez --target, uzywany przez CI i prod) ---
FROM nginx:1.31.4-alpine3.24 AS production
RUN apk upgrade --no-cache && apk upgrade
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 80
# Entrypoint generuje /tmp/config.js z env, potem uruchamia nginx (CMD).
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]