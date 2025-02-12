package main

import (
	"context"
	"time"

	"github.com/charmbracelet/log"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"mutclip.server/pkg/clipboard"
)


func main() {
    gin.SetMode(gin.ReleaseMode)
    r := gin.Default()

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
        ctx.Header("Content-Type", "text/html")
        ctx.String(200, clipboard.GenerateId())
    })

    // TODO: design error protocol
    r.GET("/ws/:id", func(gctx *gin.Context) {
        id := gctx.Param("id")

        ctx, cancel := context.WithCancel(gctx.Request.Context())

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

        send := make(chan clipboard.ClipboardContent)

        recv, err := clipboard.Connect(id, send)
        if err != nil {
            log.Error(err)
            if clipboard.IsPublic(err) {
                c.WriteMessage(websocket.TextMessage, []byte(err.Error()))
            }

            return
        }

        go func() {
            for {
                //typ, buf, err := c.ReadMessage()
                //if err != nil {
                //    log.Error(err)
                //    cancel()
                //    return
                //}

                recv <- clipboard.ContentText{}
            }
        }()

        go func() {
            for {
                select {
                case <-send:
                    c.WriteMessage(
                        websocket.TextMessage,
                        []byte(clipboard.GenerateId()),
                    )

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
