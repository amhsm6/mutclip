package clipboard

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"mutclip.server/pkg/proto"
	// "github.com/charmbracelet/log"
)

func TestId(t *testing.T) {
	s := NewServer()

	ctx := context.Background()

	_, _, err := s.Connect("id", ctx, nil)
	if err == nil {
		t.Fatal("invalid id should err")
	}

	id := s.Generate(ctx)
	_, _, err = s.Connect(id, ctx, nil)
	if err != nil {
		t.Fatal("valid id should not err: ", err)
	}
}

func TestConnect(t *testing.T) {
	s := NewServer()

	ctx, _ := context.WithTimeout(context.Background(), time.Second * 10)

	id := s.Generate(ctx)

	go s.Start(id)

	recv, sid, err, _ := connect(t, s, id, ctx)
	if err != nil {
		t.Fatal(err)
	}

	_, sid2, err, cancel2 := connect(t, s, id, ctx)
	if err != nil {
		t.Fatal(err)
	}

	_, sid3, err, cancel3 := connect(t, s, id, ctx)
	if err != nil {
		t.Fatal(err)
	}

	recv <- proto.InMessage{ Binary: false, SID: sid, Data: []byte("hello, world") }


	recv <- proto.InMessage{ Binary: false, SID: sid2, Data: []byte("hello, world") }

	cancel2()

	recv <- proto.InMessage{ Binary: false, SID: sid3, Data: []byte("{\"type\":\"MSG_TEXT\",\"data\":\"hello, world\"}") }

	cancel3()

	<-ctx.Done()
}

func connect(t *testing.T, s *ClipboardServer, id ClipboardId, ctx context.Context) (chan proto.InMessage, uuid.UUID, error, func()) {
	send := make(chan proto.OutMessage)
	ctx2, cancel := context.WithCancel(ctx)
	recv, sid, err := s.Connect(id, ctx2, send)
	if err != nil {
		return nil, uuid.UUID{}, err, nil
	}

	go func() {
		for {
			select {
			case msg := <-send:
				if msg.Binary {
					t.Logf("%v got BIN message: %v", sid, msg)
				} else {
					var a any
					err := json.Unmarshal(msg.Data, &a)
					if err != nil {
						panic(err)
					}

					t.Logf("%v got message: %v", sid, a)
				}

			case <-ctx2.Done():
				t.Logf("%v done", sid)
				return
			}
		}
	}()

	return recv, sid, nil, cancel
}
