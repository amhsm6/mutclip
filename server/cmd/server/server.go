package main

import (
	"fmt"
	"io"
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
	log.SetReportCaller(true)
	gin.DefaultWriter = io.Discard

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

	r.GET("/newclip", func(c *gin.Context) {
		id := s.Generate(c)

		go s.Start(id)

		c.String(200, id)
	})

	r.GET("/check/:id", func(c *gin.Context) {
		id := c.Param("id")
		if _, ok := s.Load(id); ok {
			c.Status(200)
		} else {
			c.Status(404)
		}
	})

	r.GET("/ws/:id", func(c *gin.Context) {
		id := c.Param("id")

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Error(err)
			c.AbortWithStatus(500)
			return
		}

		client, err := s.Connect(id, c.Request.Context())
		if err != nil {
			log.Error(err)
			conn.WriteMessage(websocket.BinaryMessage, net.Out(net.Fatal(err)))
			return
		}

		timer := time.NewTimer(ConnDeadline)
		go func() {
			defer client.Cancel()

			select {

			case <-timer.C:
				log.Error("websocket deadline expired")

			case <-client.Ctx.Done():

			}
		}()

		go func() {
			defer client.Cancel()

			for {
				typ, buf, err := conn.ReadMessage()
				if err != nil {
					if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway, websocket.CloseNoStatusReceived) {
						return
					}

					// FIXME: if context gets closed this says error tcp connection closed

					log.Error(err)
					return
				}

				timer.Reset(ConnDeadline)

				switch typ {

				case websocket.BinaryMessage:
					m, err := net.In(client.Cid, buf)
					if err != nil {
						log.Errorf("unable to parse protobuf message: %v", err)
						client.Out <- net.Err(fmt.Errorf("unexpected message"))
						continue
					}

					client.In <- *m

				case websocket.CloseMessage:
					return

				default:
					log.Errorf("unexpected message of type %v: %v", typ, buf)
					client.Out <- net.Err(fmt.Errorf("unexpected message"))

				}
			}
		}()

		go func() {
			defer client.Cancel()

			for {
				select {

				case m := <-client.Out:
					err := conn.WriteMessage(websocket.BinaryMessage, net.Out(m))
					if err != nil {
						log.Error(err)
						return
					}

				case <-client.Ctx.Done():
					return

				}
			}
		}()

		<-client.Ctx.Done()

		err = conn.Close()
		if err != nil {
			log.Error(err)
		}
	})

	log.Infof("Server started on port 5000")
	err := r.Run(":5000")
	if err != nil {
		log.Error(err)
	}
}
