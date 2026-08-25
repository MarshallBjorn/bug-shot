# BugShot local development commands.
# By default, use the committed development environment template.
# A real local .env can be supplied explicitly:
#   make ENV_FILE=.env config

.PHONY: dev dev-d down logs config

ENV_FILE ?= .env
COMPOSE = docker compose --env-file $(ENV_FILE) -f docker-compose.dev.yml

dev:
	$(COMPOSE) up --build

dev-d:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

config:
	$(COMPOSE) config
