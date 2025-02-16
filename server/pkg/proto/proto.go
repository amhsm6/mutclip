package proto

import (
	"encoding/json"
	"fmt"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

// TODO: maybe make a wrapper with bound sid to be returned from Connect()

type InMessage struct {
    Binary bool
	SID    uuid.UUID
    Data   []byte
}

type OutMessage struct {
    Binary bool
    Data   []byte
}

type MessageText struct {
    Type string `json:"type"`
    Data string `json:"data"`
}

type MessageFileHeader struct {
    Type        string `json:"type"`
    Filename    string `json:"filename"`
    ContentType string `json:"content_type"`
    NumChunks   int    `json:"num_chunks"`
}

type MessageError struct {
	Type string `json:"type"`
	Desc string `json:"desc"`
}

const (
	MSG_TEXT = "MSG_TEXT"
	MSG_HDR  = "MSG_HDR"
	MSG_ERR  = "MSG_ERR"
)

func parseJSON(msg InMessage, out any) error {
	if msg.Binary { return fmt.Errorf("got binary message") }
	return json.Unmarshal(msg.Data, out)
}

func ParseText(msg InMessage) (*MessageText, error) {
	out := &MessageText{}

	err := parseJSON(msg, out)
	if err != nil {
		return nil, err
	}

	if out.Type != MSG_TEXT { return nil, fmt.Errorf("message wrong type: %v", out) }

	return out, nil
}

func ParseHdr(msg InMessage) (*MessageFileHeader, error) {
	out := &MessageFileHeader{}

	err := parseJSON(msg, out)
	if err != nil {
		return nil, err
	}

	if out.Type != MSG_HDR { return nil, fmt.Errorf("message wrong type: %v", out) }

	return out, nil
}

func serializeJSON(msg any) OutMessage {
	buf, err := json.Marshal(msg)
	if err != nil {
		log.Error(err)
		panic("impossible")
	}

	return OutMessage{ Binary: false, Data: buf }
}

func Text(text string) OutMessage {
	msg := MessageText{ Type: MSG_TEXT, Data: text }
	return serializeJSON(msg)
}

func Err(err error) OutMessage {
	return serializeJSON(MessageError{ Type: MSG_ERR, Desc: err.Error() })
}

func Errf(format string, a ...any) OutMessage {
	return Err(fmt.Errorf(format, a...))
}
