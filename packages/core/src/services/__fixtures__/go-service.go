/**
 * Go Service Example
 *
 * Demonstrates Go best practices:
 * - Error returns
 * - Exported naming (PascalCase)
 * - Standard library imports
 * - Table-driven tests pattern (in corresponding test file)
 */

package service

import (
	"errors"
	"fmt"
	"strings"
)

var (
	ErrInvalidEmail  = errors.New("invalid email address")
	ErrEmptyName     = errors.New("name cannot be empty")
	ErrShortPassword = errors.New("password must be at least 8 characters")
)

// User represents a user in the system
type User struct {
	ID       string
	Email    string
	Name     string
	Password string
}

// ValidateEmail checks if an email address is valid
func ValidateEmail(email string) error {
	if email == "" {
		return ErrInvalidEmail
	}

	if !strings.Contains(email, "@") {
		return ErrInvalidEmail
	}

	return nil
}

// ValidatePassword checks if a password meets requirements
func ValidatePassword(password string) error {
	if len(password) < 8 {
		return ErrShortPassword
	}

	return nil
}

// CreateUser creates a new user with validation
func CreateUser(email, name, password string) (*User, error) {
	if name == "" {
		return nil, ErrEmptyName
	}

	if err := ValidateEmail(email); err != nil {
		return nil, fmt.Errorf("email validation failed: %w", err)
	}

	if err := ValidatePassword(password); err != nil {
		return nil, fmt.Errorf("password validation failed: %w", err)
	}

	user := &User{
		ID:       generateID(),
		Email:    email,
		Name:     name,
		Password: hashPassword(password),
	}

	return user, nil
}

// Private helpers
func generateID() string {
	return "user-" + randomString(16)
}

func hashPassword(password string) string {
	// Simplified for example
	return "hashed:" + password
}

func randomString(length int) string {
	// Simplified for example
	return strings.Repeat("x", length)
}
