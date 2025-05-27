package clipboard

import (
	"context"
	"fmt"
	"math/rand/v2"
	"strconv"
	"sync"
	"time"

	"mutclip/pkg/net"
	pb "mutclip/pkg/pb/clip"

	"github.com/charmbracelet/log"
)

const ClipDeadline = time.Minute * 2

type ClipboardServer struct {
	sync.Map
}

type ClipboardId = string

type Clipboard struct {
	router  *net.Router
	content Content
	clients map[net.CID]struct{}
	ctx     context.Context
	cancel  context.CancelFunc
}

type Content any

type ContentText struct {
	data string
}

type ContentFile struct {
	ready          bool
	chunks         [][]byte
	nextChunkIndex int
	numChunks      int
	contentType    string
	filename       string
}

func NewServer() *ClipboardServer {
	return &ClipboardServer{}
}

const alphabet = "abcdefghijklmnopqrstuvwxyz"

func (s *ClipboardServer) Generate(ctx context.Context) ClipboardId {
	id := ""
	for {
		var parts []any
		for range 6 {
			x := rand.N(len(alphabet) + 10)
			if x < len(alphabet) {
				parts = append(parts, string(alphabet[x]))
			} else {
				parts = append(parts, strconv.Itoa(x-len(alphabet)))
			}
		}
		id = fmt.Sprintf("%v%v-%v%v-%v%v", parts...)

		_, exists := s.Load(id)
		if !exists {
			break
		}
	}

	clipCtx, cancel := context.WithCancel(ctx)

	log.Infof("* GEN %v", id)

	s.Store(
		id,
		Clipboard{
			router:  net.NewRouter(clipCtx),
			clients: make(map[net.CID]struct{}),
			content: ContentText{},
			ctx:     clipCtx,
			cancel:  cancel,
		},
	)

	go func() {
		<-clipCtx.Done()

		time.Sleep(time.Second)
		s.Delete(id)
	}()

	return id
}

func (s *ClipboardServer) getClip(id ClipboardId) *Clipboard {
	x, ok := s.Load(id)
	if !ok {
		return nil
	}

	clip, ok := x.(Clipboard)
	if !ok {
		return nil
	}

	return &clip
}

func (s *ClipboardServer) updateClip(id ClipboardId, f func(*Clipboard)) {
	clip := s.getClip(id)
	f(clip)
	s.Store(id, *clip)
}

func (s *ClipboardServer) Connect(id ClipboardId, ctx context.Context, send chan<- net.OutMessage) (chan<- net.InMessage, net.CID, context.Context, error) {
	clip := s.getClip(id)
	if clip == nil {
		return nil, net.CID{}, nil, fmt.Errorf("invalid id: %v", id)
	}

	cid := clip.router.Connect(send, ctx)

	s.updateClip(id, func(c *Clipboard) { c.clients[cid] = struct{}{} })

	log.Infof("[%v] + %v", id, cid)

	go func() {
		select {
		case <-ctx.Done():
		case <-clip.ctx.Done():
		}

		s.updateClip(id, func(c *Clipboard) { delete(c.clients, cid) })
		log.Infof("[%v] - %v", id, cid)
	}()

	go func() {
		time.Sleep(time.Millisecond)

		err := s.syncCid(id, cid)
		if err != nil {
			log.Error(err)
		}
	}()

	return clip.router.Source, cid, clip.ctx, nil
}

func (s *ClipboardServer) syncCid(id ClipboardId, cid net.CID) error {
	clip := s.getClip(id)
	r := clip.router

	switch content := clip.content.(type) {
	case ContentText:
		text := "<empty>"
		if content.data != "" {
			text = content.data
		}
		log.Infof("[%v] SYNC -> %v : TXT %v", id, cid, text)

		return r.Send(cid, &pb.Message{Msg: &pb.Message_Text{Text: &pb.Text{Data: content.data}}})

	case ContentFile:
		log.Infof("[%v] SYNC -> %v : FILE %v/%v", id, cid, content.filename, content.numChunks)

		if !content.ready {
			log.Warnf("[%v] SYNC -> %v : FILE not ready", id, cid)
			return nil
		}

		tun, err := r.Tunnel(cid)
		if err != nil {
			return err
		}
		defer tun.Cancel()

		tun.Out <- &pb.Message{Msg: &pb.Message_Hdr{Hdr: &pb.FileHeader{
			Filename:    content.filename,
			ContentType: content.contentType,
			NumChunks:   int32(content.numChunks),
		}}}

		idx := 0
		for {
			select {
			case m := <-tun.In:
				if m.GetNextChunk() == nil {
					log.Errorf("unexpected message while sending file: %v", m)
					tun.Out <- net.Err(fmt.Errorf("unexpected message"))
					continue
				}

				log.Infof("[%v] SYNC -> %v : %v/%v", id, cid, idx+1, content.numChunks)

				tun.Out <- &pb.Message{Msg: &pb.Message_Chunk{Chunk: &pb.Chunk{Index: int32(idx), Data: content.chunks[idx]}}}
				idx++

				if idx < content.numChunks {
					continue
				}

				log.Infof("[%v] SYNC -> %v : OK", id, cid)
				return nil

			case <-tun.Done():
				return fmt.Errorf("client disconnected while sending file")
			}
		}

	default:
		panic("impossible")
	}
}

func (s *ClipboardServer) syncClip(id ClipboardId, srcCid net.CID) {
	clip := s.getClip(id)
	r := clip.router

	switch content := clip.content.(type) {
	case ContentText:
		text := "<empty>"
		if content.data != "" {
			text = content.data
		}
		log.Infof("[%v] SYNC -> @ : TXT %v", id, text)

		r.Broadcast(
			&pb.Message{Msg: &pb.Message_Text{Text: &pb.Text{Data: content.data}}},
			map[net.CID]struct{}{srcCid: {}},
		)

	case ContentFile:
		wg := sync.WaitGroup{}
		for cid := range clip.clients {
			if cid == srcCid {
				continue
			}

			wg.Add(1)

			go func() {
				defer wg.Done()

				err := s.syncCid(id, cid)
				if err != nil {
					log.Error(err)
				}
			}()
		}

		wg.Wait()

	default:
		panic("impossible")
	}

	err := r.Send(srcCid, &pb.Message{Msg: &pb.Message_Ack{Ack: &pb.Ack{}}})
	if err != nil {
		log.Error(err)
	}

	log.Infof("[%v] ACK => %v", id, srcCid)
}

func (s *ClipboardServer) processText(id ClipboardId, cid net.CID, m *pb.Text) {
	clip := s.getClip(id)
	r := clip.router

	data := m.GetData()

	text := data
	if text == "" {
		text = "<empty>"
	}

	log.Infof("[%v] $ <= %v : TXT %v", id, cid, text)

	if file, ok := clip.content.(ContentFile); ok {
		if !file.ready {
			log.Error("denied while receiving file")

			err := r.Send(cid, &pb.Message{Msg: &pb.Message_Ack{Ack: &pb.Ack{}}})
			if err != nil {
				log.Error(err)
			}

			return
		}
	}

	s.updateClip(id, func(clip *Clipboard) { clip.content = ContentText{data} })
	s.syncClip(id, cid)
}

func (s *ClipboardServer) processFile(id ClipboardId, timer *time.Timer, cid net.CID, m *pb.FileHeader) {
	clip := s.getClip(id)
	r := clip.router

	log.Infof("[%v] $ <= %v : FILE %v/%v", id, cid, m.GetFilename(), m.GetNumChunks())

	if file, ok := clip.content.(ContentFile); ok {
		if !file.ready {
			log.Error("denied while receiving file")

			err := r.Send(cid, &pb.Message{Msg: &pb.Message_Ack{Ack: &pb.Ack{}}})
			if err != nil {
				log.Error(err)
			}

			return
		}
	}

	s.updateClip(id, func(c *Clipboard) {
		c.content = ContentFile{
			filename:    m.GetFilename(),
			contentType: m.GetContentType(),
			numChunks:   int(m.GetNumChunks()),
		}
	})

	tun, err := r.Tunnel(cid)
	if err != nil {
		log.Error(err)
		return
	}
	defer tun.Cancel()

	tun.Out <- &pb.Message{Msg: &pb.Message_NextChunk{NextChunk: &pb.NextChunk{}}}

	for {
		select {
		case m := <-tun.In:
			timer.Reset(ClipDeadline)

			chunk := m.GetChunk()
			if chunk == nil {
				log.Errorf("unexpected message while receiving file")
				tun.Out <- net.Err(fmt.Errorf("unexpected message"))
				return
			}

			file, ok := s.getClip(id).content.(ContentFile)
			if !ok {
				log.Errorf("unexpected state of contents: %v", s.getClip(id).content)
				tun.Out <- net.Err(fmt.Errorf("internal server error"))
				return
			}

			if int(chunk.GetIndex()) != file.nextChunkIndex {
				log.Errorf("received chunk with index %v, but expected %v", chunk.GetIndex(), file.nextChunkIndex)
				tun.Out <- net.Err(fmt.Errorf("transmission disordered"))
				return
			}

			log.Infof("[%v] <- %v : %v/%v", id, cid, chunk.GetIndex()+1, file.numChunks)

			file.nextChunkIndex++
			file.chunks = append(file.chunks, chunk.GetData())

			if file.nextChunkIndex < file.numChunks {
				s.updateClip(id, func(c *Clipboard) { c.content = file })

				tun.Out <- &pb.Message{Msg: &pb.Message_NextChunk{NextChunk: &pb.NextChunk{}}}

				continue
			}

			file.ready = true
			s.updateClip(id, func(c *Clipboard) { c.content = file })

			log.Infof("[%v] <- %v : OK", id, cid)
			s.syncClip(id, cid)

			return

		case <-tun.Done():
			s.updateClip(id, func(c *Clipboard) { c.content = clip.content })

			log.Error("client disconnected while receiving file")
			return
		}
	}
}

func (s *ClipboardServer) Start(id ClipboardId) {
	clip := s.getClip(id)
	r := clip.router

	go r.Start()

	log.Infof("* START %v", id)

	timer := time.NewTimer(ClipDeadline)
	go func() {
		defer clip.cancel()

		select {
		case <-timer.C:
		case <-clip.ctx.Done():
		}
	}()

	for {
		select {
		case m := <-r.Drain:
			timer.Reset(ClipDeadline)

			if text := m.GetText(); text != nil {
				go s.processText(id, m.Cid, text)
				continue
			}

			if hdr := m.GetHdr(); hdr != nil {
				go s.processFile(id, timer, m.Cid, hdr)
				continue
			}

			log.Errorf("unexpected message")
			r.Send(m.Cid, net.Err(fmt.Errorf("unpexpected message")))

		case <-clip.ctx.Done():
			log.Infof("* END %v", id)
			return
		}
	}
}
