//go:build linux && amd64
// +build linux,amd64

// Package edgecases tests various Go edge cases for the scanner.
package edgecases

import (
	"context"
	"io"
)

// init functions should be extracted
func init() {
	// Package initialization
}

// Multiple init functions are allowed
func init() {
	// Another init
}

// Blank identifier for interface compliance check
var _ io.Reader = (*MyReader)(nil)
var _ io.Writer = (*MyWriter)(nil)

// MyReader implements io.Reader.
type MyReader struct {
	data []byte
}

// Read implements io.Reader.
func (r *MyReader) Read(p []byte) (n int, err error) {
	return copy(p, r.data), nil
}

// MyWriter implements io.Writer.
type MyWriter struct{}

// Write implements io.Writer.
func (w *MyWriter) Write(p []byte) (n int, err error) {
	return len(p), nil
}

// Embedded struct example
type Base struct {
	ID   string
	Name string
}

// Extended embeds Base.
type Extended struct {
	Base           // Embedded
	ExtraField int // Additional field
}

// Multiple variable declarations
var (
	DefaultTimeout = 30
	MaxRetries     = 3
	MinWorkers     = 1
)

// Multiple const declarations
const (
	StatusPending  = "pending"
	StatusRunning  = "running"
	StatusComplete = "complete"
)

// Iota usage
const (
	Sunday = iota
	Monday
	Tuesday
	Wednesday
	Thursday
	Friday
	Saturday
)

// Function with context (common pattern)
func DoWork(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
		return nil
	}
}

// Variadic function
func Sum(numbers ...int) int {
	total := 0
	for _, n := range numbers {
		total += n
	}
	return total
}

// Function returning multiple values
func Divide(a, b int) (int, int, error) {
	if b == 0 {
		return 0, 0, io.EOF // Using io.EOF as placeholder error
	}
	return a / b, a % b, nil
}

// Named return values
func ParseConfig(data []byte) (config *Base, err error) {
	config = &Base{}
	// parsing logic
	return config, nil
}

// unexportedType should still be detected
type unexportedType struct {
	field string
}

// unexportedFunc should still be detected
func unexportedFunc() string {
	return "unexported"
}
