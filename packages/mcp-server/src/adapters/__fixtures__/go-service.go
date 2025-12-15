/**
 * Go service fixture for adapter tests
 */

package service

import "errors"

type User struct {
	ID   string
	Name string
}

func CreateUser(name string) (*User, error) {
	if name == "" {
		return nil, errors.New("name required")
	}

	return &User{
		ID:   "user-123",
		Name: name,
	}, nil
}
