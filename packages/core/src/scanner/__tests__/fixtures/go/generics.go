package generics

// Stack is a generic stack data structure.
type Stack[T any] struct {
	items []T
}

// Push adds an item to the stack.
func (s *Stack[T]) Push(item T) {
	s.items = append(s.items, item)
}

// Pop removes and returns the top item.
func (s *Stack[T]) Pop() (T, bool) {
	if len(s.items) == 0 {
		var zero T
		return zero, false
	}
	item := s.items[len(s.items)-1]
	s.items = s.items[:len(s.items)-1]
	return item, true
}

// Pair holds two values of potentially different types.
type Pair[K comparable, V any] struct {
	Key   K
	Value V
}

// NewPair creates a new Pair.
func NewPair[K comparable, V any](key K, value V) *Pair[K, V] {
	return &Pair[K, V]{Key: key, Value: value}
}

// Map applies a function to each element of a slice.
func Map[T, U any](slice []T, fn func(T) U) []U {
	result := make([]U, len(slice))
	for i, v := range slice {
		result[i] = fn(v)
	}
	return result
}

// Filter returns elements that satisfy the predicate.
func Filter[T any](slice []T, predicate func(T) bool) []T {
	var result []T
	for _, v := range slice {
		if predicate(v) {
			result = append(result, v)
		}
	}
	return result
}

// Reduce reduces a slice to a single value.
func Reduce[T, U any](slice []T, initial U, fn func(U, T) U) U {
	result := initial
	for _, v := range slice {
		result = fn(result, v)
	}
	return result
}

// Comparable is an interface for comparable types.
type Comparable[T any] interface {
	Compare(other T) int
}

// Ordered is an interface for ordered types.
type Ordered interface {
	~int | ~int8 | ~int16 | ~int32 | ~int64 |
		~uint | ~uint8 | ~uint16 | ~uint32 | ~uint64 |
		~float32 | ~float64 | ~string
}

// Min returns the minimum of two ordered values.
func Min[T Ordered](a, b T) T {
	if a < b {
		return a
	}
	return b
}
