// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Control service entry point: launches the external control HTTP surface only when CARACAL_CONTROL_ENABLED=true.

package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/garudex-labs/caracal/control/internal"
	"github.com/garudex-labs/caracal/core/config"
	"github.com/garudex-labs/caracal/core/logging"
)

func main() {
	config.AssertRuntimeSafe()
	log := logging.New("control")

	enabled := os.Getenv("CARACAL_CONTROL_ENABLED")
	if enabled != "true" {
		log.Info().Str("enabled", enabled).Msg("control surface disabled; exiting (set CARACAL_CONTROL_ENABLED=true to enable)")
		return
	}

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	srv, err := internal.New(ctx, log)
	if err != nil {
		log.Fatal().Err(err).Msg("init failed")
	}
	if err := srv.Run(ctx); err != nil {
		log.Fatal().Err(err).Msg("run failed")
	}
}
