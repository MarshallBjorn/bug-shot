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

# --- image pipeline (CI + local repro) ---
# Uzycie: make image-scan SERVICE=backend

SERVICE 	?=
IMAGE_OWNER ?= $(shell echo "$${GITHUB_REPOSITORY_OWNER:-local}" | tr '[:upper:]' '[:lower:]')
REGISTRY	?= ghcr.io
IMAGE_TAG 	?= $(shell git rev-parse --short HEAD)
IMAGE		= $(REGISTRY)/$(IMAGE_OWNER)/bugshot-$(SERVICE):$(IMAGE_TAG)

HADOLINT_VERSION ?= v2.12.0
TRIVY_VERSION    ?= 0.58.0
DOCKLE_VERSION   ?= v0.4.15

HADOLINT_IMAGE = hadolint/hadolint:$(HADOLINT_VERSION)
TRIVY_IMAGE    = aquasec/trivy:$(TRIVY_VERSION)
DOCKLE_IMAGE   = goodwithtech/dockle:$(DOCKLE_VERSION)

CI_CACHE       ?= $(HOME)/.cache/bugshot-ci

secret_scan:
	@echo "==> Trivy Secrets Scan"
	docker run --rm \
		-v $(CURDIR):/src \
		aquasec/trivy \
		fs --scanners secret /src \
			--severity HIGH,CRITICAL \
			--exit-code 1

_check-service:
	@if [ -z "$(SERVICE)" ]; then \
	    echo "SERVICE required <backend|frontend|wiget>"; exit 1; fi

image-lint: _check-service
	docker run --rm -i $(HADOLINT_IMAGE) < $(SERVICE)/Dockerfile

image-build: _check-service
	docker build -t $(IMAGE) $(SERVICE)

image-scan-trivy: _check-service
	@mkdir -p $(CI_CACHE)/trivy
	docker run --rm \
		-v /var/run/docker.sock:/var/run/docker.sock \
		-v $(CI_CACHE)/trivy:/root/.cache/trivy \
		$(TRIVY_IMAGE) image \
			--exit-code 1 \
			--severity HIGH,CRITICAL \
			--ignore-unfixed \
			--format table \
			$(IMAGE)

image-scan-dockle: _check-service
	docker run --rm \
		-v /var/run/docker.sock:/var/run/docker.sock \
		$(DOCKLE_IMAGE) --accept-key KEY_SHA512 --exit-code 1 --exit-level fatal $(IMAGE)

# For local testing, one command
image-scan: image-scan-trivy image-scan-dockle

image-push: _check-service
	docker push $(IMAGE)
