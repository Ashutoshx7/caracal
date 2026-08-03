// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Non-blocking async writer and process-level dev-log metrics snapshot.

package logging

import (
	"io"
	"os"
	"os/signal"
	"strconv"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

// Metrics captures counters for dev-log throughput, useful for /metrics exposure.
type Metrics struct {
	Emitted    uint64 `json:"emitted"`
	Dropped    uint64 `json:"dropped"`
	QueueDepth uint64 `json:"queue_depth"`
	QueueCap   uint64 `json:"queue_cap"`
	Sampled    uint64 `json:"sampled"`
}

var globalWriter atomic.Pointer[asyncWriter]

var globalWriterMu sync.Mutex

func newAsyncWriter(sink io.Writer) *asyncWriter {
	globalWriterMu.Lock()
	defer globalWriterMu.Unlock()
	if existing := globalWriter.Load(); existing != nil {
		return existing
	}
	cap := uint64(16384)
	if v := os.Getenv("CARACAL_LOG_QUEUE_SIZE"); v != "" {
		if n, err := strconv.ParseUint(v, 10, 64); err == nil && n > 0 {
			cap = n
		}
	}
	w := &asyncWriter{
		sink:     sink,
		ch:       make(chan []byte, cap),
		queueCap: cap,
		done:     make(chan struct{}),
		stop:     make(chan struct{}),
	}
	go w.run()
	globalWriter.Store(w)
	return w
}

type asyncWriter struct {
	sink     io.Writer
	ch       chan []byte
	queueCap uint64
	emitted  atomic.Uint64
	dropped  atomic.Uint64
	pending  atomic.Int64
	closed   atomic.Bool
	done     chan struct{}
	stop     chan struct{}
}

func (w *asyncWriter) Write(p []byte) (int, error) {
	if w.closed.Load() {
		return w.sink.Write(p)
	}
	buf := make([]byte, len(p))
	copy(buf, p)
	w.pending.Add(1)
	select {
	case w.ch <- buf:
		w.emitted.Add(1)
	default:
		w.pending.Add(-1)
		w.dropped.Add(1)
	}
	return len(p), nil
}

func (w *asyncWriter) run() {
	defer close(w.done)
	for {
		select {
		case buf := <-w.ch:
			_, _ = w.sink.Write(buf)
			w.pending.Add(-1)
		case <-w.stop:
			for {
				select {
				case buf := <-w.ch:
					_, _ = w.sink.Write(buf)
					w.pending.Add(-1)
				default:
					return
				}
			}
		}
	}
}

// Flush drains pending records, blocking until every queued record has been
// written to the sink or timeout elapses.
func (w *asyncWriter) Flush(timeout time.Duration) {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if w.pending.Load() == 0 {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
}

// Close stops the background drain after flushing. Idempotent.
func (w *asyncWriter) Close(timeout time.Duration) {
	if !w.closed.CompareAndSwap(false, true) {
		return
	}
	w.Flush(timeout)
	// The record channel is deliberately never closed: a writer that passed the closed check is
	// already committed to sending, and closing underneath it would panic the process during
	// shutdown - exactly when in-flight requests are still logging.
	close(w.stop)
	select {
	case <-w.done:
	case <-time.After(timeout):
	}
}

// MetricsSnapshot returns a stable snapshot of the current dev-log counters.
func MetricsSnapshot() Metrics {
	w := globalWriter.Load()
	if w == nil {
		return Metrics{}
	}
	return Metrics{
		Emitted:    w.emitted.Load(),
		Dropped:    w.dropped.Load(),
		QueueDepth: uint64(len(w.ch)),
		QueueCap:   w.queueCap,
		Sampled:    debugCounter.Load(),
	}
}

// FlushDevLogs blocks until the background queue is drained or timeout elapses.
func FlushDevLogs(timeout time.Duration) {
	if w := globalWriter.Load(); w != nil {
		w.Flush(timeout)
	}
}

// CloseDevLogs flushes and stops the dev-log writer. Idempotent.
func CloseDevLogs(timeout time.Duration) {
	if w := globalWriter.Load(); w != nil {
		w.Close(timeout)
	}
}

// InstallShutdownHandler wires SIGTERM/SIGINT to flush the dev-log writer and
// invoke fn (typically AuditClient.Close) before exit. Returns a stop function
// that callers can invoke to remove the handler in tests.
func InstallShutdownHandler(fn func(), timeout time.Duration) func() {
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
	stopCh := make(chan struct{})
	go func() {
		select {
		case <-sigCh:
			if fn != nil {
				fn()
			}
			CloseDevLogs(timeout)
		case <-stopCh:
		}
		signal.Stop(sigCh)
	}()
	return func() { close(stopCh) }
}
