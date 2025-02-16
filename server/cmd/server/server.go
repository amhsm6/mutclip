package main

import (
	"context"
    
	"mutclip.server/pkg/clipboard"
	"mutclip.server/pkg/proto"

	"github.com/charmbracelet/log"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)


func main() {
    gin.SetMode(gin.ReleaseMode)
    r := gin.Default()

	s := clipboard.NewServer()

    upgrader := websocket.Upgrader{}

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
        id := s.Generate(ctx.Request.Context())

		go s.Start(id)

        ctx.Header("Content-Type", "text/html")
        ctx.String(200, id)
    })

    r.GET("/ws/:id", func(gctx *gin.Context) {
        id := gctx.Param("id")

        ctx, cancel := context.WithCancel(gctx.Request.Context())

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

        send := make(chan proto.OutMessage)

        recv, sid, err := s.Connect(id, ctx, send)
        if err != nil {
            cancel()

            log.Error(err)
            c.WriteMessage(websocket.TextMessage, proto.Err(err).Data)

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

                switch typ { // FIXME: maybe constructors
                case websocket.TextMessage:
                    recv <- proto.InMessage{ Binary: false, SID: sid, Data: buf }

                case websocket.BinaryMessage:
                    recv <- proto.InMessage{ Binary: true, SID: sid, Data: buf }

                case websocket.CloseMessage:
                    cancel()

                    log.Error("websocket closed")
                    return
                }
            }
        }()

        go func() {
            for {
                select {
                case msg := <-send:
					typ := websocket.TextMessage
					if msg.Binary { typ = websocket.BinaryMessage }

                    err := c.WriteMessage(typ, msg.Data)
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

    log.Info("Starting Server")

    err := r.Run("127.0.0.1:3015")
    if err != nil {
        log.Fatal(err)
    }
}
