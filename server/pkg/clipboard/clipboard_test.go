package clipboard

import "testing"

func TestConnect(t *testing.T) {
	_, err := Connect("id", nil)
	if err == nil {
		t.Fatal("invalid id should err")
	}

	t.Log(err)

	id := Generate()
	_, err = Connect(id, nil)
	if err != nil {
		t.Fatal("valid id should not err")
	}
}
