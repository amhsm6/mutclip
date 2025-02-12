package clipboard

import (
	"fmt"
	"testing"
)

func TestError(t *testing.T) {
	var err error

	err = nil
	if IsPublic(err) {
		t.Error("ok should not be public")
	}

	err = fmt.Errorf("some error")
	if IsPublic(err) {
		t.Error("any error should be private")
	}

	err = PublicErr(fmt.Errorf("a public err"))
	if !IsPublic(err) {
		t.Error("public error should be public")
	}
}
