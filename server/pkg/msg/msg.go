package msg

import (
	pb "mutclip/pkg/pb/clip"

	"github.com/google/uuid"
	"google.golang.org/protobuf/proto"
)

type InMessage struct {
	SID uuid.UUID
	*pb.Message
}

type OutMessage = []byte

func In(sid uuid.UUID, data []byte) (*InMessage, error) {
	m := &pb.Message{}

	err := proto.Unmarshal(data, m)
	if err != nil {
		return nil, err
	}

	return &InMessage{ sid, m }, nil
}

func Out(m *pb.Message) OutMessage {
	data, err := proto.Marshal(m)
	if err != nil {
		panic(err)
	}

	return data
}

func Err(err error) OutMessage {
	return Out(&pb.Message{ Msg: &pb.Message_Err{ Err: &pb.Error{ Desc: err.Error() } } })
}
