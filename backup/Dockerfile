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

# supercronic — cron dla kontenerow, dziala jako non-root.
# Pinujemy wersje + checksume (nie zaciagamy latest).
ARG SUPERCRONIC_VERSION=0.2.33
ARG SUPERCRONIC_SHA256=feefa310da569c81b99e1027b86b27b51e6ee9ab647747b49099645120cfc671
RUN curl -fsSLo /usr/local/bin/supercronic \
        "https://github.com/aptible/supercronic/releases/download/v${SUPERCRONIC_VERSION}/supercronic-linux-amd64" \
    && echo "${SUPERCRONIC_SHA256}  /usr/local/bin/supercronic" | sha256sum -c - \
    && chmod +x /usr/local/bin/supercronic

RUN adduser -D -u 1000 backup \
    && chown -R backup:backup /var/log

COPY --chown=backup:backup --chmod=0755 entrypoint.sh /entrypoint.sh
COPY --chown=backup:backup --chmod=0755 scripts/      /scripts/

USER backup

ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
