# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# PostgreSQL 18 base image for Caracal. Schema migrations are applied by the
# dbMigrate one-shot at boot. Runtime tuning is supplied via `command:` in
# compose to remain environment-aware.

# syntax=docker/dockerfile:1.7
FROM postgres:18-alpine@sha256:d3e1620b530c944afa6e887d22eb899824da68e19c52024bf98f5220c88a65b2

# The pinned base digest lags Alpine security releases between upstream
# rebuilds; upgrading at build time keeps apk packages at their current fixes.
RUN apk upgrade --no-cache

ENV POSTGRES_DB=caracal \
    POSTGRES_INITDB_ARGS="--data-checksums --auth-host=scram-sha-256"

COPY migrations/ /migrations/
COPY --chmod=0755 scripts/migrate.sh /usr/local/bin/caracal-migrate

EXPOSE 5432
