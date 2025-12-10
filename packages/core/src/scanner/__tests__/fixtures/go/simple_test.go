// Package example contains tests for the example package.
package example

import (
	"testing"
)

// TestNewServer tests server creation.
func TestNewServer(t *testing.T) {
	cfg := &Config{Host: "localhost", Port: 8080}
	server := NewServer(cfg)
	if server == nil {
		t.Error("expected server to be created")
	}
}

// TestProcessRequest tests request processing.
func TestProcessRequest(t *testing.T) {
	req := Request{ID: "test-1", Payload: []byte("hello")}
	resp := processRequest(req)
	if resp.Status != 200 {
		t.Errorf("expected status 200, got %d", resp.Status)
	}
}

// helperFunction is a test helper (unexported).
func helperFunction() string {
	return "helper"
}
