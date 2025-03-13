package net

import "github.com/google/uuid"

type CID uuid.UUID

func newCID() CID {
	return CID(uuid.New())
}

func (cid CID) String() string {
	str := uuid.UUID(cid).String()
	return str[:8]
}
