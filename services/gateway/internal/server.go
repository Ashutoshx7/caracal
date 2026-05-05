// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Gateway HTTP server: health endpoints and reverse proxy listener.

package internal

import (
	"context"
	"net/http"
	"os"

	"github.com/rs/zerolog"
)

type Server struct {
	cfg Config
	log zerolog.Logger
}

func New(_ context.Context) (*Server, error) {
	cfg := loadConfig()
	log := zerolog.New(os.Stderr).With().Timestamp().Logger()
	return &Server{cfg: cfg, log: log}, nil
}

func (s *Server) Run(ctx context.Context) error {
	sts := newSTSClient(s.cfg.STSURL)
	p := newProxy(sts, s.log)

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	mux.HandleFunc("/ready", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	mux.Handle("/", p)

	srv := &http.Server{Addr: ":" + s.cfg.Port, Handler: mux}
	go func() {
		<-ctx.Done()
		srv.Close()
	}()
	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		return err
	}
	return nil
}
