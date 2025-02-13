package clipboard

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"math/rand/v2"
	"strconv"
	"sync"

	"github.com/charmbracelet/log"
)

var activeClips sync.Map

type ClipboardId = string

type Clipboard struct {
    content ClipboardContent
    recv    chan ClipboardMessage
    sends   map[chan ClipboardMessage]struct{}
}

type ClipboardContent interface{}

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

type ClipboardMessage struct {
    Binary bool
    Data   []byte
}

type MessageText struct {
    Data string `json:"data"`
}

type MessageFileHeader struct {
    Filename  string `json:"filename"`
    Type      string `json:"type"`
    NumChunks int    `json:"num_chunks"`
}

const alphabet = "abcdefghijklmnopqrstuvwxyz"

func Generate() ClipboardId {
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
    initialize(id)
    return id
}

func initialize(id ClipboardId) {
    activeClips.Store(
        id,
        Clipboard{
            content: ContentText{},
            recv:    make(chan ClipboardMessage),
        },
    )
}

func getClip(id ClipboardId) *Clipboard {
    x, ok := activeClips.Load(id)
    if !ok { panic("bad id") }

    clip, ok := x.(Clipboard)
    if !ok { panic("impossible") }

    return &clip
}

func Connect(id ClipboardId, send chan ClipboardMessage) (recv chan ClipboardMessage, err error) {
    defer func() {
        r := recover()
        if r != nil {
            e, ok := r.(string)
            if ok { err = errors.New(e) }
        }
    }()

    clip := getClip(id)

    clip.sends[send] = struct{}{}
    recv = clip.recv

    return
}

func Broadcast(id ClipboardId, msg ClipboardMessage) {
    for s := range maps.Keys(getClip(id).sends) {
        s <- msg
    }
}

func Run(id ClipboardId, ctx context.Context) {
    for {
        select {
        case msg := <-getClip(id).recv:
            log.Info(msg)

            
        case <-ctx.Done():
            return
        }
    }
}
