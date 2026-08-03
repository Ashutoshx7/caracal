// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// OpenTelemetry bootstrap helpers for Go services.

package telemetry

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"runtime/debug"
	"strings"

	"github.com/garudex-labs/caracal/packages/core/go/logging"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"
)

func Setup(ctx context.Context, serviceName string) (func(context.Context) error, error) {
	endpoint := strings.TrimSpace(os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"))
	if endpoint == "" {
		otel.SetTextMapPropagator(propagation.TraceContext{})
		return func(context.Context) error { return nil }, nil
	}
	protocol := strings.TrimSpace(os.Getenv("OTEL_EXPORTER_OTLP_PROTOCOL"))
	if protocol != "" && protocol != "http/protobuf" {
		return nil, fmt.Errorf("unsupported OTEL_EXPORTER_OTLP_PROTOCOL %q", protocol)
	}
	exporter, err := otlptracehttp.New(ctx, otlptracehttp.WithEndpointURL(endpoint))
	if err != nil {
		return nil, err
	}
	provider := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(resource.NewSchemaless(resourceAttributes(serviceName)...)),
	)
	otel.SetTracerProvider(provider)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(propagation.TraceContext{}, propagation.Baggage{}))
	return provider.Shutdown, nil
}

func HTTPHandler(operation string, next http.Handler) http.Handler {
	return otelhttp.NewHandler(recoverPanics(operation, next), operation)
}

// recoverPanics turns a handler panic into a recorded error and a clean 500. net/http already keeps
// a panic from killing the process, but it does so by logging to stderr and dropping the connection:
// the span stays unmarked, no service log carries the trace id, and the caller sees a severed
// request rather than an error it can act on.
func recoverPanics(operation string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			cause := recover()
			if cause == nil {
				return
			}
			// ErrAbortHandler is the documented way to abandon a response silently; honouring it
			// keeps reverse-proxy and streaming shutdowns quiet.
			if cause == http.ErrAbortHandler {
				panic(cause)
			}
			span := trace.SpanFromContext(r.Context())
			span.SetStatus(codes.Error, "handler panic")
			span.SetAttributes(attribute.String("caracal.panic", fmt.Sprint(cause)))
			log := logging.WithTrace(logging.New(operation), r.Context())
			log.Error().
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Str("panic", fmt.Sprint(cause)).
				Str("stack", string(debug.Stack())).
				Msg("recovered panic in http handler")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`{"error":"internal_error"}`))
		}()
		next.ServeHTTP(w, r)
	})
}

func resourceAttributes(serviceName string) []attribute.KeyValue {
	attrs := []attribute.KeyValue{attribute.String("service.name", serviceName)}
	for _, raw := range strings.Split(os.Getenv("OTEL_RESOURCE_ATTRIBUTES"), ",") {
		key, value, ok := strings.Cut(strings.TrimSpace(raw), "=")
		if !ok || strings.TrimSpace(key) == "" {
			continue
		}
		attrs = append(attrs, attribute.String(strings.TrimSpace(key), strings.TrimSpace(value)))
	}
	return attrs
}
