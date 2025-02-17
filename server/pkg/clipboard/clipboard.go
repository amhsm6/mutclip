package clipboard

import (
	"context"
	"fmt"
	"math/rand/v2"
	"strconv"
	"sync"

	"mutclip.server/pkg/proto"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

type ClipboardServer struct {
	sync.Map
}

type ClipboardId = string

type Clipboard struct {
	ctx     context.Context
    content Content
    recv    chan proto.InMessage
    sends   map[uuid.UUID]chan proto.OutMessage
}

type Content interface{}

type ContentText struct {
    data string
}

type ContentFile struct {
    ready 		bool
    chunks      [][]byte
    nextChunkId int
    numChunks   int
    contentType string
    filename    string
}

func NewServer() *ClipboardServer {
	return &ClipboardServer{}
}

const alphabet = "abcdefghijklmnopqrstuvwxyz"

// TODO: check for uniqueness
func (s *ClipboardServer) Generate(ctx context.Context) ClipboardId {
    var parts []any
    for i := 0; i < 6; i++ {
        x := rand.N(len(alphabet) + 10)
        if x < len(alphabet) {
            parts = append(parts, string(alphabet[x])) 
        } else {
            parts = append(parts, strconv.Itoa(x - len(alphabet)))
        }
    }
    id := fmt.Sprintf("%v%v-%v%v-%v%v", parts...)

	log.Infof("generated %v", id)

    s.Store(
        id,
        Clipboard{
			ctx:     ctx,
            content: ContentText{},
            recv:    make(chan proto.InMessage, 15),
			sends:   make(map[uuid.UUID]chan proto.OutMessage),
        },
    )

	return id
}

func (s *ClipboardServer) getClip(id ClipboardId) *Clipboard {
    x, ok := s.Load(id)
    if !ok { return nil }

    clip, ok := x.(Clipboard)
    if !ok { return nil }

    return &clip
}

func (s *ClipboardServer) updateClip(id ClipboardId, f func(*Clipboard)) {
    clip := s.getClip(id)
    f(clip)
    s.Store(id, *clip)
}

func (s *ClipboardServer) Connect(id ClipboardId, ctx context.Context, send chan proto.OutMessage) (chan proto.InMessage, uuid.UUID, error) {
    clip := s.getClip(id)
	if clip == nil {
		return nil, uuid.UUID{}, fmt.Errorf("invalid id: %v", id)
	}

	sid := uuid.New()

    clip.sends[sid] = send

    err := s.send(id, sid)
    if err != nil {
        panic(err)
    }

	go func() {
		select {
		case <-ctx.Done():
		case <-clip.ctx.Done():
		}

		delete(clip.sends, sid)
        log.Infof("%v disconnected from %v", sid, id)
	}()

	log.Infof("%v connected to %v", sid, id)

    return clip.recv, sid, nil
}

func (s *ClipboardServer) reply(id ClipboardId, sid uuid.UUID, msg proto.OutMessage) error {
	c, ok := s.getClip(id).sends[sid]
	if !ok {
        return fmt.Errorf("invalid sid: %v", sid)
	}

	c <- msg
    return nil
}

func (s *ClipboardServer) send(id ClipboardId, sid uuid.UUID) error {
    switch content := s.getClip(id).content.(type) {
    case ContentText:
        return s.reply(id, sid, proto.Text(content.data))
    
    case ContentFile:
        panic("unimplemented")
    
    default:
        panic("impossible")
    }
}

func (s *ClipboardServer) processText(id ClipboardId, sid uuid.UUID, msg *proto.MessageText) {
    s.updateClip(id, func(clip *Clipboard) { clip.content = ContentText{ data: msg.Data } })

    for sid2 := range s.getClip(id).sends {
        if sid2 == sid { continue }

        err := s.send(id, sid2)
        if err != nil {
            panic(err)
        }
    }

    s.reply(id, sid, proto.Ack())
}

func (s *ClipboardServer) processFile(id ClipboardId, msg *proto.MessageFileHeader) {

}

// TODO: make cleanup
func (s *ClipboardServer) Start(id ClipboardId) {
	log.Infof("started %v", id)

    for {
        select {
        case msg := <-s.getClip(id).recv:
			if msg.Binary {
				log.Errorf("first message should be text: %v", msg.Data)
				s.reply(id, msg.SID, proto.Errf("unexpected message"))
				continue
			}

			text, err := proto.ParseText(msg)
			if err == nil {
				log.Infof("got text message: %v", text)
				s.processText(id, msg.SID, text)
				continue
			}

			hdr, err := proto.ParseHdr(msg)
			if err == nil {
				log.Infof("got file header: %v", hdr)
				s.processFile(id, hdr)
				continue
			}

			log.Errorf("got message of unknown type: %v", msg)
			s.reply(id, msg.SID, proto.Errf("unexpected message"))

		case <-s.getClip(id).ctx.Done():
			log.Infof("finished %v", id)
			return
		}
    }
}
