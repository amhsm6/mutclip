package msg

import (
	pb "mutclip/pkg/pb/clip"

	"github.com/google/uuid"
	"google.golang.org/protobuf/proto"
)

type InMessage struct {
	*pb.Message

	SID uuid.UUID
}

type OutMessage = *pb.Message

func In(sid uuid.UUID, b []byte) (*InMessage, error) {
	m := &pb.Message{}

	err := proto.Unmarshal(b, m)
	if err != nil {
		return nil, err
	}

	return &InMessage{ SID: sid, Message: m }, nil
}

func Out(m OutMessage) []byte {
	b, err := proto.Marshal(m)
	if err != nil {
		panic(err)
	}

	return b
}

func Err(err error) OutMessage {
	return &pb.Message{ Msg: &pb.Message_Err{ Err: &pb.Error{ Desc: err.Error() } } }
}
