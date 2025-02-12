package clipboard

type PublicError struct {
	error
}

func PublicErr(err error) error {
	return &PublicError{ err }
}

func IsPublic(err error) bool {
	_, ok := err.(*PublicError)
	return ok
}
