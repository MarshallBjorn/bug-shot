# BugShot local development commands.
# By default, use the committed development environment template.
# A real local .env can be supplied explicitly:
#   make ENV_FILE=.env config

.PHONY: dev dev-d down logs config migrate test test-backend test-frontend e2e e2e-install seed seed-reset backup-pg backup-media cleanup restore-test

ENV_FILE ?= .env
COMPOSE = docker compose --env-file $(ENV_FILE) -f docker-compose.yml

dev:
	$(COMPOSE) up --build

dev-d:
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

config:
	$(COMPOSE) config

# --- testy ---
# Wlasna baza obok tej z compose bo testy czyszcza tabele i nie moga siegac po dane deweloperskie.
# Schemat zaklada sie sam przy pierwszym uruchomieniu, wystarczy zeby postgres z compose chodzil.
TEST_CONNECTION ?= Host=127.0.0.1;Port=5433;Database=bugshot_test;Username=bugshot;Password=change-me-dev-only

test: test-backend test-frontend

test-backend:
	cd backend && ConnectionStrings__DefaultConnection="$(TEST_CONNECTION)" dotnet test BugShot.slnx

test-frontend: frontend/node_modules
	cd frontend && npm test

# ─── load test ───
loadtest: loadtest/reports
	k6 run loadtest/k6-tickets.js --env BASE_URL=http://localhost:8080

loadtest-quick:
	k6 run loadtest/k6-tickets.js --env BASE_URL=http://localhost:8080 --env K6_QUICK=1

loadtest/reports:
	mkdir -p loadtest/reports

# stawia wlasne API i panel na osobnych portach i wlasnej bazie wiec nie koliduje z make dev
# potrzebuje za to bazy z compose wiec make dev musi chodzic
e2e: e2e/node_modules
	dotnet tool restore
	cd e2e && npm test

e2e-install:
	cd e2e && npm ci && npx playwright install chromium
# --- dane testowe ---
# zgloszenia z ostatnich 90 dni w projekcie seed idace przez API z docker-compose.dev.yml
# wiecej pod testy wydajnosci: make seed SEED_COUNT=10000
SEED_COUNT ?= 600

seed:
	node scripts/seed.mjs --count $(SEED_COUNT) --env-file $(ENV_FILE)

# najpierw kasuje zgloszenia projektu seed razem z plikami
seed-reset:
	node scripts/seed.mjs --reset --count $(SEED_COUNT) --env-file $(ENV_FILE)

# katalog jest celem a nie akcja wiec instalacja rusza tylko na czystym klonie
# albo gdy ktos zmienil zaleznosci
frontend/node_modules: frontend/package-lock.json
	cd frontend && npm ci
	@touch $@

e2e/node_modules: e2e/package-lock.json
	cd e2e && npm ci && npx playwright install chromium
	@touch $@

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
		$(TRIVY_IMAGE) \
		fs --scanners secret /src \
			--severity HIGH,CRITICAL \
			--exit-code 1

_check-service:
	@if [ -z "$(SERVICE)" ]; then \
	    echo "SERVICE required <backend|frontend|wiget|backup>"; exit 1; fi

image-lint: _check-service
	docker run --rm -v $(CURDIR)/.hadolint.yaml:/.hadolint.yaml -i $(HADOLINT_IMAGE) < $(SERVICE)/Dockerfile

image-build: _check-service
	docker build -t $(IMAGE) $(SERVICE)

image-scan-trivy: _check-service
	@mkdir -p $(CI_CACHE)/trivy
	docker run --rm \
		-v /var/run/docker.sock:/var/run/docker.sock \
		-v $(CI_CACHE)/trivy:/root/.cache/trivy \
		-v $(CURDIR)/.trivyignore:/.trivyignore \
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

migrate:
	dotnet ef database update --project backend/BugShot.Api/BugShot.Api.csproj --startup-project backend/BugShot.Api/BugShot.Api.csproj

backup-pg:
	docker compose -f docker-compose.dev.yml exec backup /scripts/backup-pg.sh

backup-media:
	docker compose -f docker-compose.dev.yml exec backup /scripts/backup-media.sh

cleanup:
	docker compose -f docker-compose.dev.yml exec backup /scripts/cleanup.sh

restore-test:
	@bash scripts/restore-test.sh
