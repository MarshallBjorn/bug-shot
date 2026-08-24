# BugShot local development commands.
# By default, use the committed development environment template.
# A real local .env can be supplied explicitly:
#   make ENV_FILE=.env config

.PHONY: dev down logs config

ENV_FILE ?= .env.example
COMPOSE = docker compose --env-file $(ENV_FILE) -f docker-compose.dev.yml

dev:
	$(COMPOSE) up --build

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

config:
	$(COMPOSE) config
