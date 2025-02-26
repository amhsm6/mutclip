package main

import (
	"context"
	"net/http"

	"mutclip/pkg/clipboard"
	"mutclip/pkg/msg"

	"github.com/charmbracelet/log"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)


func main() {
    gin.SetMode(gin.ReleaseMode)
    r := gin.Default()

	s := clipboard.NewServer()

    upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { //FIXME
			return true
		},
	}

    r.GET("/", func(ctx *gin.Context) {
        ctx.Header("Content-Type", "text/html")
        ctx.String(200, `
            <!DOCTYPE html>
            <html>
            <body>
            <script>
                const ws = new WebSocket("/ws/123");

                ws.onmessage = console.log
                ws.onclose = console.log
            </script>
            </body>
            </html>
        `)
    })

    r.GET("/newclip", func(ctx *gin.Context) {
        id := s.Generate(ctx)

		go s.Start(id)

        ctx.Header("Content-Type", "text/html")
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

        ctx, cancel := context.WithCancel(gctx.Request.Context());

        c, err := upgrader.Upgrade(gctx.Writer, gctx.Request, nil)
        if err != nil {
            cancel()

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

        send := make(chan msg.OutMessage, 15)

        recv, sid, err := s.Connect(id, ctx, send)
        if err != nil {
            cancel()

            log.Error(err)
            c.WriteMessage(websocket.BinaryMessage, msg.Out(msg.Err(err)))
            return
        }

        go func() {
            for {
                typ, buf, err := c.ReadMessage()
                if err != nil {
                   cancel()

                   log.Error(err)
                   return
                }

                switch typ {
                case websocket.BinaryMessage:
                    m, err := msg.In(sid, buf)
					if err != nil {
						log.Errorf("unable to parse protobuf message: %v", err) //TODO: reply?
						continue
					}

					recv <- *m

                case websocket.CloseMessage:
                    cancel()

                    log.Warn("websocket closed")
                    return

				default:
					log.Errorf("unexpected message of type %v: %v", typ, buf)
                }
            }
        }()

        go func() {
            for {
                select {
                case m := <-send:
                    err := c.WriteMessage(websocket.BinaryMessage, msg.Out(m))
                    if err != nil {
                        cancel()

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

    log.Info("Starting Server on 127.0.0.1:3015")

    err := r.Run("127.0.0.1:3015")
    if err != nil {
        log.Fatal(err)
    }
}
