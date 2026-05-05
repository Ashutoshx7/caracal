# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# STS service image; build context must be the caracal/ workspace root.

FROM golang:1.26-alpine AS builder
WORKDIR /build
COPY go.work go.work
COPY packages/shared/ packages/shared/
COPY packages/caracalai-mcp-go/ packages/caracalai-mcp-go/
COPY services/audit/ services/audit/
COPY services/gateway/ services/gateway/
COPY apps/agent-coordinator/relay/ apps/agent-coordinator/relay/
COPY services/sts/ services/sts/
COPY tests/go/unit/sts/internal/ tests/go/unit/sts/internal/
WORKDIR /build/services/sts
RUN go mod download && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -o /sts ./cmd/sts

FROM gcr.io/distroless/static:nonroot
COPY --from=builder /sts /sts
USER nonroot:nonroot
ENTRYPOINT ["/sts"]
