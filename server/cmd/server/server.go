package main

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"mutclip/pkg/clipboard"
	"mutclip/pkg/net"

	"github.com/charmbracelet/log"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

const ConnDeadline = time.Minute

func main() {
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	s := clipboard.NewServer()

	origins := make(map[string]struct{})
	for _, o := range strings.Split(os.Getenv("ORIGINS"), " ") {
		origins[o] = struct{}{}
	}

	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			origin, err := url.Parse(r.Header.Get("Origin"))
			if err != nil {
				log.Error(err)
				return false
			}

			_, ok := origins[origin.Hostname()]
			if !ok {
				log.Errorf("origin %v denied", origin.Hostname())
			}
			return ok
		},
	}

	r.GET("/newclip", func(ctx *gin.Context) {
		id := s.Generate(ctx)

		go s.Start(id)

		ctx.String(200, id)
	})

	r.GET("/check/:id", func(ctx *gin.Context) {
		id := ctx.Param("id")
		if _, ok := s.Load(id); ok {
			ctx.Status(200)
		} else {
			ctx.Status(404)
		}
	})

	r.GET("/ws/:id", func(gctx *gin.Context) {
		id := gctx.Param("id")

		ctx, cancel := context.WithCancel(gctx.Request.Context())
		defer cancel()

		c, err := upgrader.Upgrade(gctx.Writer, gctx.Request, nil)
		if err != nil {
			log.Error(err)
			return
		}
		defer func() {
			err = c.Close()
			if err != nil {
				log.Error(err)
				return
			}
		}()

		send := make(chan net.OutMessage, 15)

		recv, cid, clipCtx, err := s.Connect(id, ctx, send)
		if err != nil {
			log.Error(err)
			c.WriteMessage(websocket.BinaryMessage, net.Out(net.Err(err)))
			return
		}

		timer := time.NewTimer(ConnDeadline)
		go func() {
			select {
			case <-timer.C:
				log.Error("websocket deadline expired")

			case <-ctx.Done():
			}

			cancel()
		}()

		go func() {
			<-clipCtx.Done()
			cancel()
		}()

		go func() {
			defer cancel()

			for {
				typ, buf, err := c.ReadMessage()
				if err != nil {
					log.Error(err)
					return
				}

				timer.Reset(ConnDeadline)

				switch typ {
				case websocket.BinaryMessage:
					m, err := net.In(cid, buf)
					if err != nil {
						log.Errorf("unable to parse protobuf message: %v", err)
						send <- net.Err(fmt.Errorf("unexpected message"))
						continue
					}

					recv <- *m

				case websocket.CloseMessage:
					log.Warn("websocket closed")
					return

				default:
					log.Errorf("unexpected message of type %v: %v", typ, buf)
					send <- net.Err(fmt.Errorf("unexpected message"))
				}
			}
		}()

		go func() {
			defer cancel()

			for {
				select {
				case m := <-send:
					err := c.WriteMessage(websocket.BinaryMessage, net.Out(m))
					if err != nil {
						log.Error(err)
						return
					}

				case <-ctx.Done():
					return
				}
			}
		}()

		<-ctx.Done()
	})

	log.Infof("Server started on port 5000")
	err := r.Run(":5000")
	if err != nil {
		log.Error(err)
	}
}
