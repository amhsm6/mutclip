package clipboard

import (
	"context"
	"testing"
	"time"

	"mutclip/pkg/msg"
	pb "mutclip/pkg/pb/clip"

	"github.com/google/uuid"
	"google.golang.org/protobuf/proto"
)

func TestId(t *testing.T) {
	s := NewServer()

	ctx := context.Background()

	_, _, err := s.Connect("id", ctx, make(chan msg.OutMessage, 15))
	if err == nil {
		t.Fatal("invalid id should err")
	}

	id := s.Generate(ctx)
	_, _, err = s.Connect(id, ctx, make(chan msg.OutMessage, 15))
	if err != nil {
		t.Fatal("valid id should not err: ", err)
	}
}

func connect(t *testing.T, s *ClipboardServer, id ClipboardId, ctx context.Context) (chan msg.InMessage, chan msg.OutMessage, uuid.UUID, error, func()) {
	send := make(chan msg.OutMessage, 15)
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

	m := <-send1
	{
		out := &pb.Message{}
		err := proto.Unmarshal(m, out)
		if err != nil {
			t.Fatal(err)
		}

		if out.GetText() == nil || out.GetText().Data != "" {
			t.Fatalf("expected initial empty message for send1, but got: %v", out)
		}
	}

	m = <-send2
	{
		out := &pb.Message{}
		err := proto.Unmarshal(m, out)
		if err != nil {
			t.Fatal(err)
		}

		if out.GetText() == nil || out.GetText().Data != "" {
			t.Fatalf("expected initial empty message for send2 but got: %v", out)
		}
	}

	recv <- msg.InMessage{ sid2, &pb.Message{ Msg: &pb.Message_Text{ Text: &pb.Text{ Data: "hello, world" } } } }

	m = <-send1
	{
		out := &pb.Message{}
		err := proto.Unmarshal(m, out)
		if err != nil {
			t.Fatal(err)
		}

		if out.GetText() == nil || out.GetText().Data != "hello, world" {
			t.Fatalf("expected message for send1 but got: %v", out)
		}
	}

	m = <-send2
	{
		out := &pb.Message{}
		err := proto.Unmarshal(m, out)
		if err != nil {
			t.Fatal(err)
		}

		if out.GetAck() == nil {
			t.Fatalf("expected ack for send2 but got: %v", out)
		}
	}

	recv <- msg.InMessage{ sid2, &pb.Message{ Msg: &pb.Message_Text{ Text: &pb.Text{ Data: "new message" } } } }

	m = <-send1
	{
		out := &pb.Message{}
		err := proto.Unmarshal(m, out)
		if err != nil {
			t.Fatal(err)
		}

		if out.GetText() == nil || out.GetText().Data != "new message" {
			t.Fatalf("expected message for send1 but got: %v", out)
		}
	}

	m = <-send2
	{
		out := &pb.Message{}
		err := proto.Unmarshal(m, out)
		if err != nil {
			t.Fatal(err)
		}

		if out.GetAck() == nil {
			t.Fatalf("expected ack for send2 but got: %v", out)
		}
	}

	recv <- msg.InMessage{ sid2, &pb.Message{ Msg: &pb.Message_Text{ Text: &pb.Text{ Data: "another" } } } }

	m = <-send1
	{
		out := &pb.Message{}
		err := proto.Unmarshal(m, out)
		if err != nil {
			t.Fatal(err)
		}

		if out.GetText() == nil || out.GetText().Data != "another" {
			t.Fatalf("expected message for send1 but got: %v", out)
		}
	}

	m = <-send2
	{
		out := &pb.Message{}
		err := proto.Unmarshal(m, out)
		if err != nil {
			t.Fatal(err)
		}

		if out.GetAck() == nil {
			t.Fatalf("expected ack for send2 but got: %v", out)
		}
	}

	_, send3, sid3, err, cancel3 := connect(t, s, id, ctx)
	if err != nil {
		t.Fatal(err)
	}

	m = <-send3
	{
		out := &pb.Message{}
		err := proto.Unmarshal(m, out)
		if err != nil {
			t.Fatal(err)
		}

		if out.GetText() == nil || out.GetText().Data != "another" {
			t.Fatalf("expected message for send3 but got: %v", out)
		}
	}

	recv <- msg.InMessage{ sid3, &pb.Message{ Msg: &pb.Message_Text{ Text: &pb.Text{ Data: "HI" } } } }

	m = <-send1
	{
		out := &pb.Message{}
		err := proto.Unmarshal(m, out)
		if err != nil {
			t.Fatal(err)
		}

		if out.GetText() == nil || out.GetText().Data != "HI" {
			t.Fatalf("expected message for send3 but got: %v", out)
		}
	}

	m = <-send2
	{
		out := &pb.Message{}
		err := proto.Unmarshal(m, out)
		if err != nil {
			t.Fatal(err)
		}

		if out.GetText() == nil || out.GetText().Data != "HI" {
			t.Fatalf("expected message for send2 but got: %v", out)
		}
	}

	m = <-send3
	{
		out := &pb.Message{}
		err := proto.Unmarshal(m, out)
		if err != nil {
			t.Fatal(err)
		}

		if out.GetAck() == nil {
			t.Fatalf("expected ack for send3 but got: %v", out)
		}
	}

	recv <- msg.InMessage{ sid1, &pb.Message{ Msg: &pb.Message_Text{ Text: &pb.Text{ Data: "bye" } } } }

	m = <-send1
	{
		out := &pb.Message{}
		err := proto.Unmarshal(m, out)
		if err != nil {
			t.Fatal(err)
		}

		if out.GetAck() == nil {
			t.Fatalf("expected ack for send1 but got: %v", out)
		}
	}

	m = <-send2
	{
		out := &pb.Message{}
		err := proto.Unmarshal(m, out)
		if err != nil {
			t.Fatal(err)
		}

		if out.GetText() == nil || out.GetText().Data != "bye" {
			t.Fatalf("expected message for send2 but got: %v", out)
		}
	}

	m = <-send3
	{
		out := &pb.Message{}
		err := proto.Unmarshal(m, out)
		if err != nil {
			t.Fatal(err)
		}

		if out.GetText() == nil || out.GetText().Data != "bye" {
			t.Fatalf("expected message for send3 but got: %v", out)
		}
	}

	cancel1()

	recv <- msg.InMessage{ sid2, &pb.Message{ Msg: &pb.Message_Text{ Text: &pb.Text{ Data: "Oh" } } } }

	m = <-send2
	{
		out := &pb.Message{}
		err := proto.Unmarshal(m, out)
		if err != nil {
			t.Fatal(err)
		}

		if out.GetAck() == nil {
			t.Fatalf("expected ack for send2 but got: %v", out)
		}
	}

	m = <-send3
	{
		out := &pb.Message{}
		err := proto.Unmarshal(m, out)
		if err != nil {
			t.Fatal(err)
		}

		if out.GetText() == nil || out.GetText().Data != "Oh" {
			t.Fatalf("expected message for send3 but got: %v", out)
		}
	}

	cancel()

	time.Sleep(time.Second)

	<-ctx.Done()
	cancel1()
	cancel2()
	cancel3()
}
