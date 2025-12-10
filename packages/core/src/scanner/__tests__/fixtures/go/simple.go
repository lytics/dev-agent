// Package example provides example Go code for scanner testing.
package example

import (
	"context"
	"fmt"
)

// MaxRetries is the maximum number of retry attempts.
const MaxRetries = 3

// DefaultTimeout is the default timeout duration.
const DefaultTimeout = 30

// privateConst should not be extracted (unexported).
const privateConst = "hidden"

// Config holds application configuration.
type Config struct {
	Host    string
	Port    int
	Timeout int
}

// Server represents a server instance.
// It handles incoming requests and manages connections.
type Server struct {
	config  *Config
	running bool
}

// Reader defines the interface for reading data.
type Reader interface {
	// Read reads data into the provided buffer.
	Read(p []byte) (n int, err error)
}

// Writer defines the interface for writing data.
type Writer interface {
	Write(p []byte) (n int, err error)
}

// ReadWriter combines Reader and Writer interfaces.
type ReadWriter interface {
	Reader
	Writer
}

// ID is a type alias for string identifiers.
type ID string

// Handler is a function type for request handlers.
type Handler func(ctx context.Context, req Request) Response

// Request represents an incoming request.
type Request struct {
	ID      ID
	Payload []byte
}

// Response represents an outgoing response.
type Response struct {
	ID     ID
	Status int
	Body   []byte
}

// NewServer creates a new server with the given configuration.
// It initializes all internal state and validates the config.
func NewServer(cfg *Config) *Server {
	return &Server{
		config:  cfg,
		running: false,
	}
}

// Start begins the server and starts accepting connections.
func Start(ctx context.Context) error {
	fmt.Println("Starting server...")
	return nil
}

// processRequest handles a single request.
// This is an unexported function.
func processRequest(req Request) Response {
	return Response{
		ID:     req.ID,
		Status: 200,
		Body:   []byte("OK"),
	}
}
