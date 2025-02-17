package clipboard

import (
	"bytes"
	"context"
	"testing"
	"time"

	"mutclip.server/pkg/proto"

	"github.com/google/uuid"
)

func TestId(t *testing.T) {
	s := NewServer()

	ctx := context.Background()

	_, _, err := s.Connect("id", ctx, make(chan proto.OutMessage, 15))
	if err == nil {
		t.Fatal("invalid id should err")
	}

	id := s.Generate(ctx)
	_, _, err = s.Connect(id, ctx, make(chan proto.OutMessage, 15))
	if err != nil {
		t.Fatal("valid id should not err: ", err)
	}
}

func connect(t *testing.T, s *ClipboardServer, id ClipboardId, ctx context.Context) (chan proto.InMessage, chan proto.OutMessage, uuid.UUID, error, func()) {
	send := make(chan proto.OutMessage, 15)
	ctx2, cancel := context.WithCancel(ctx)
	recv, sid, err := s.Connect(id, ctx2, send)
	if err != nil {
		return nil, nil, uuid.UUID{}, err, nil
	}

	//go func() {
	//	for {
	//		select {
	//		case msg := <-send:
	//			if msg.Binary {
	//				t.Logf("%v got BIN message: %v", sid, msg)
	//			} else {
	//				var a any
	//				err := json.Unmarshal(msg.Data, &a)
	//				if err != nil {
	//					panic(err)
	//				}

	//				t.Logf("%v got message: %v", sid, a)
	//			}

	//		case <-ctx2.Done():
	//			t.Logf("%v done", sid)
	//			return
	//		}
	//	}
	//}()

	return recv, send, sid, nil, cancel
}

func TestBasic(t *testing.T) {
	s := NewServer()

	ctx, cancel := context.WithTimeout(context.Background(), time.Second * 10)

	id := s.Generate(ctx)

	go s.Start(id)

	recv, send1, sid1, err, cancel1 := connect(t, s, id, ctx)
	if err != nil {
		t.Fatal(err)
	}

	_, send2, sid2, err, cancel2 := connect(t, s, id, ctx)
	if err != nil {
		t.Fatal(err)
	}

	msg := <-send1
	if msg.Binary || !bytes.Equal(msg.Data, []byte("{\"type\":\"MSG_TEXT\",\"data\":\"\"}")) { t.Fatalf("expected initial empty message for send1, but got: %v", msg) }

	msg = <-send2
	if msg.Binary || !bytes.Equal(msg.Data, []byte("{\"type\":\"MSG_TEXT\",\"data\":\"\"}")) { t.Fatalf("expected initial empty message for send2, but got: %v", msg) }
	

	recv <- proto.InMessage{ Binary: false, SID: sid2, Data: []byte("{\"type\":\"MSG_TEXT\",\"data\":\"hello, world\"}") }

	msg = <-send1
	if msg.Binary || !bytes.Equal(msg.Data, []byte("{\"type\":\"MSG_TEXT\",\"data\":\"hello, world\"}")) { t.Fatalf("expected message for send1, but got: %v", msg) }

	msg = <-send2
	if msg.Binary || !bytes.Equal(msg.Data, []byte("{\"type\":\"MSG_ACK\"}")) { t.Fatalf("expected ack message for send2, but got: %v", msg) }


	recv <- proto.InMessage{ Binary: false, SID: sid2, Data: []byte("{\"type\":\"MSG_TEXT\",\"data\":\"new message\"}") }

	msg = <-send1
	if msg.Binary || !bytes.Equal(msg.Data, []byte("{\"type\":\"MSG_TEXT\",\"data\":\"new message\"}")) { t.Fatalf("expected message for send1, but got: %v", msg) }

	msg = <-send2
	if msg.Binary || !bytes.Equal(msg.Data, []byte("{\"type\":\"MSG_ACK\"}")) { t.Fatalf("expected ack message for send2, but got: %v", msg) }


	recv <- proto.InMessage{ Binary: false, SID: sid2, Data: []byte("{\"type\":\"MSG_TEXT\",\"data\":\"another\"}") }

	msg = <-send1
	if msg.Binary || !bytes.Equal(msg.Data, []byte("{\"type\":\"MSG_TEXT\",\"data\":\"another\"}")) { t.Fatalf("expected message for send1, but got: %v", msg) }

	msg = <-send2
	if msg.Binary || !bytes.Equal(msg.Data, []byte("{\"type\":\"MSG_ACK\"}")) { t.Fatalf("expected ack message for send2, but got: %v", msg) }

	_, send3, sid3, err, cancel3 := connect(t, s, id, ctx)
	if err != nil {
		t.Fatal(err)
	}

	msg = <-send3
	if msg.Binary || !bytes.Equal(msg.Data, []byte("{\"type\":\"MSG_TEXT\",\"data\":\"another\"}")) { t.Fatalf("expected initial message for send3, but got: %v", msg) }


	recv <- proto.InMessage{ Binary: false, SID: sid3, Data: []byte("{\"type\":\"MSG_TEXT\",\"data\":\"HI!!!!!\"}") }

	msg = <-send1
	if msg.Binary || !bytes.Equal(msg.Data, []byte("{\"type\":\"MSG_TEXT\",\"data\":\"HI!!!!!\"}")) { t.Fatalf("expected message for send1, but got: %v", msg) }

	msg = <-send2
	if msg.Binary || !bytes.Equal(msg.Data, []byte("{\"type\":\"MSG_TEXT\",\"data\":\"HI!!!!!\"}")) { t.Fatalf("expected message for send2, but got: %v", msg) }

	msg = <-send3
	if msg.Binary || !bytes.Equal(msg.Data, []byte("{\"type\":\"MSG_ACK\"}")) { t.Fatalf("expected ack message for send3, but got: %v", msg) }


	recv <- proto.InMessage{ Binary: false, SID: sid1, Data: []byte("{\"type\":\"MSG_TEXT\",\"data\":\"bye\"}") }

	msg = <-send1
	if msg.Binary || !bytes.Equal(msg.Data, []byte("{\"type\":\"MSG_ACK\"}")) { t.Fatalf("expected ack for send1, but got: %v", msg) }

	msg = <-send2
	if msg.Binary || !bytes.Equal(msg.Data, []byte("{\"type\":\"MSG_TEXT\",\"data\":\"bye\"}")) { t.Fatalf("expected message for send2, but got: %v", msg) }

	msg = <-send3
	if msg.Binary || !bytes.Equal(msg.Data, []byte("{\"type\":\"MSG_TEXT\",\"data\":\"bye\"}")) { t.Fatalf("expected message for send3, but got: %v", msg) }

	cancel1()

	recv <- proto.InMessage{ Binary: false, SID: sid2, Data: []byte("{\"type\":\"MSG_TEXT\",\"data\":\"Ohhhhhhhh\"}") }

	msg = <-send2
	if msg.Binary || !bytes.Equal(msg.Data, []byte("{\"type\":\"MSG_ACK\"}")) { t.Fatalf("expected ack for send2, but got: %v", msg) }

	msg = <-send3
	if msg.Binary || !bytes.Equal(msg.Data, []byte("{\"type\":\"MSG_TEXT\",\"data\":\"Ohhhhhhhh\"}")) { t.Fatalf("expected message for send3, but got: %v", msg) }

	cancel()

	time.Sleep(time.Second)

	<-ctx.Done()
	cancel1()
	cancel2()
	cancel3()
}
