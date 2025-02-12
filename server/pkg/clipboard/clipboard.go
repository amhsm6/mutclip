package clipboard

import (
	"fmt"
	"math/rand/v2"
	"strconv"
	"sync"
)

var activeClips sync.Map

type ClipboardId = string

type Clipboard struct {
	content ClipboardContent
	recv    chan ClipboardContent
	sends   map[chan ClipboardContent]struct{}
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

const alphabet = "abcdefghijklmnopqrstuvwxyz"

func GenerateId() ClipboardId {
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
			recv:    make(chan ClipboardContent),
		},
	)
}

func Connect(id ClipboardId, send chan ClipboardContent) (chan ClipboardContent, error) {
	x, ok := activeClips.Load(id)
	if !ok {
		var null chan ClipboardContent
		return null, PublicErr(fmt.Errorf("invalid id"))
	}

	clip, ok := x.(Clipboard)
	if !ok { panic("impossible") }

	clip.sends[send] = struct{}{}
	return clip.recv, nil
}
