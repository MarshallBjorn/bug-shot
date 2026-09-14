FROM golang:1.26-alpine AS builder

ARG SUPERCRONIC_VERSION=v0.2.33
RUN go install github.com/aptible/supercronic@${SUPERCRONIC_VERSION}

# Kontener obok API z cronem. Robi backupy Postgres i wolumenu mediów,
# szyfruje age i wypycha na S3-kompatybilny endpoint (Garage w dev, R2 w prod).
FROM alpine:3.20

# TZ=UTC wprost — nie zdajemy sie na defaulty base image.
# Cron nie ma zadnej retry logiki, wiec zla godzina = brak backupu.
ENV TZ=UTC

# postgresql16-client musi matchowac wersje serwera z docker-compose (postgres:16-alpine).
# age — szyfrowanie asymetryczne.
# aws-cli — upload na S3 endpoint.
# tini — porzadny init (obsluga sygnalow, reaping zombie).
# bash — wygodniejszy niz sh do skryptow z pipefail.
RUN apk add --no-cache \
        bash \
        tini \
        tzdata \
        postgresql16-client \
        age \
        aws-cli \
        curl \
        gzip \
        tar \
        coreutils\
        jq \
    && mkdir -p /scripts /var/log

COPY --from=builder /go/bin/supercronic /usr/local/bin/supercronic

RUN adduser -D -u 1000 backup \
    && chown -R backup:backup /var/log

COPY --chown=backup:backup --chmod=0755 entrypoint.sh /entrypoint.sh
COPY --chown=backup:backup --chmod=0755 scripts/      /scripts/

USER backup

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
