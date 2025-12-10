// Package example demonstrates methods with receivers.
package example

import (
	"context"
	"fmt"
	"time"
)

// ExpBackoff helps implement exponential backoff for retries.
// It is useful in distributed systems for retrying operations.
type ExpBackoff struct {
	initialWait time.Duration
	maxWait     time.Duration
	multiplier  float64
	numFailures int
}

// NewExpBackoff creates a new ExpBackoff instance.
func NewExpBackoff(initial, max time.Duration, mult float64) *ExpBackoff {
	return &ExpBackoff{
		initialWait: initial,
		maxWait:     max,
		multiplier:  mult,
	}
}

// Success resets the backoff state after a successful operation.
func (e *ExpBackoff) Success() {
	e.numFailures = 0
}

// MarkFailAndGetWait increments failure count and returns wait duration.
// This uses a pointer receiver because it modifies state.
func (e *ExpBackoff) MarkFailAndGetWait() time.Duration {
	e.numFailures++
	return e.calculateWait()
}

// calculateWait computes the wait time (unexported method).
func (e *ExpBackoff) calculateWait() time.Duration {
	// Implementation details...
	return e.initialWait
}

// String returns a string representation (value receiver).
func (e ExpBackoff) String() string {
	return fmt.Sprintf("ExpBackoff{failures: %d}", e.numFailures)
}

// Connection represents a network connection.
type Connection struct {
	host     string
	port     int
	timeout  time.Duration
	isActive bool
}

// Connect establishes a connection to the remote host.
func (c *Connection) Connect(ctx context.Context) error {
	c.isActive = true
	return nil
}

// Close terminates the connection.
func (c *Connection) Close() error {
	c.isActive = false
	return nil
}

// IsActive returns whether the connection is currently active.
// Uses value receiver since it doesn't modify state.
func (c Connection) IsActive() bool {
	return c.isActive
}

// Host returns the connection host.
func (c Connection) Host() string {
	return c.host
}

