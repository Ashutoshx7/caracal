// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Redis Streams consumer for the audit-ingestor group.

package internal

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
)

const (
	auditStream   = "caracal.audit.events"
	consumerGroup = "audit-ingestor"
	consumerName  = "audit-worker-0"
	consumeBatch  = 100
	consumeBackoff = time.Second
)

type Consumer struct {
	db    *PGWriter
	redis *redis.Client
	log   zerolog.Logger
}

func (c *Consumer) Run(ctx context.Context) {
	if err := ensureGroup(ctx, c.redis, auditStream, consumerGroup); err != nil {
		c.log.Error().Err(err).Msg("ensure consumer group")
	}

	for {
		if ctx.Err() != nil {
			return
		}
		msgs, err := c.redis.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    consumerGroup,
			Consumer: consumerName,
			Streams:  []string{auditStream, ">"},
			Count:    consumeBatch,
			Block:    5 * time.Second,
		}).Result()
		if err != nil {
			if errors.Is(err, context.Canceled) {
				return
			}
			c.log.Error().Err(err).Msg("xreadgroup")
			time.Sleep(consumeBackoff)
			continue
		}
		for _, stream := range msgs {
			for _, msg := range stream.Messages {
				if err := c.handle(ctx, msg); err != nil {
					c.log.Error().Err(err).Str("id", msg.ID).Msg("handle event")
					continue
				}
				c.redis.XAck(ctx, auditStream, consumerGroup, msg.ID)
			}
		}
	}
}

func (c *Consumer) handle(ctx context.Context, msg redis.XMessage) error {
	raw, ok := msg.Values["data"].(string)
	if !ok {
		return nil
	}
	var ev AuditEvent
	if err := json.Unmarshal([]byte(raw), &ev); err != nil {
		return err
	}
	return c.db.Insert(ctx, ev)
}

func ensureGroup(ctx context.Context, r *redis.Client, stream, group string) error {
	err := r.XGroupCreateMkStream(ctx, stream, group, "$").Err()
	if err != nil && err.Error() == "BUSYGROUP Consumer Group name already exists" {
		return nil
	}
	return err
}
