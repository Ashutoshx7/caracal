# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Redis 8 image for the Caracal message bus.

# syntax=docker/dockerfile:1.7
FROM redis:8-alpine@sha256:978f0e01593e65eed801f2402944efcd936d43b5027e4908a7897baf88ed6241

RUN apk add --no-cache tini
COPY redis.conf /etc/caracal/redis.conf
COPY --chmod=0755 entrypoint.sh /usr/local/bin/caracal-redis-entrypoint
COPY --chmod=0755 provision-streams.sh /usr/local/bin/caracal-provision-streams
RUN mkdir -p /run/caracal && chown -R redis:redis /etc/caracal /run/caracal

USER redis
EXPOSE 6379
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/caracal-redis-entrypoint"]
