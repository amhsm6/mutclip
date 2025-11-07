"use client"

import React, { createContext, useState, useEffect, useRef, useContext } from "react"
import { Message } from "@/pb/clip"
import MessageQueueContext, { MessageType } from "./MessageQueueContext"

interface Socket {
    sendMessage: (m: Message) => void
    queue: Message[]
    socketOk: boolean
}

const SocketContext = createContext<Socket>({ sendMessage: () => { }, queue: [], socketOk: false })

export default SocketContext

interface WS {
    ws: WebSocket | null
    ok: boolean
}

interface Props {
    clipId: string
}

export function SocketProvider({ clipId, children }: React.PropsWithChildren<Props>) {
    const socketRef = useRef<WS>({ ws: null, ok: false })
    const [reconnect, setReconnect] = useState(false)

    const [outQueue, setOutQueue] = useState<Message[]>([])
    const [inQueue, setInQueue] = useState<Message[]>([])

    const sendMessage = (m: Message) => setOutQueue([...outQueue, m])

    const [socketOk, setSocketOk] = useState(false)

    const { pushMessage } = useContext(MessageQueueContext)

    useEffect(() => {
        if (!reconnect) { return }
        setReconnect(false)

        const ws = new WebSocket(`/ws/${clipId}`)
        ws.binaryType = "arraybuffer"

        socketRef.current.ws = ws

        const connDeadline = setTimeout(() => {
            pushMessage({ type: MessageType.ERROR, text: "Failed to reconnect" })
            pushMessage({ type: MessageType.INFO, text: "Trying again in 2s" })

            setTimeout(() => {
                pushMessage({ type: MessageType.INFO, text: "Reconnecting..." })
                setReconnect(true)
            }, 2000)
        }, 3000)

        ws.onopen = () => {
            clearTimeout(connDeadline)

            socketRef.current.ok = true
            setSocketOk(true)
            pushMessage({ type: MessageType.SUCCESS, text: "Server Connected" })
        }

        ws.onmessage = msg => {
            if (!(msg.data instanceof ArrayBuffer)) {
                pushMessage({ type: MessageType.ERROR, text: "Websocket Error" })
                return
            }

            const m = Message.decode(new Uint8Array(msg.data))
            setInQueue(q => [...q, m])
        }

        ws.onerror = () => {
            if (!socketRef.current.ok) { return }

            socketRef.current.ok = false
            setSocketOk(false)

            ws.close()

            pushMessage({ type: MessageType.ERROR, text: "Websocket Error" })
            pushMessage({ type: MessageType.INFO, text: "Reconnecting in 2s" })

            setTimeout(() => {
                pushMessage({ type: MessageType.INFO, text: "Reconnecting..." })
                setReconnect(true)
            }, 2000)
        }

        ws.onclose = () => {
            if (!socketRef.current.ok) { return }

            socketRef.current.ok = false
            setSocketOk(false)

            pushMessage({ type: MessageType.ERROR, text: "Websocket Closed Unexpectedly" })
            pushMessage({ type: MessageType.INFO, text: "Reconnecting in 2s" })

            setTimeout(() => {
                pushMessage({ type: MessageType.INFO, text: "Reconnecting..." })
                setReconnect(true)
            }, 2000)
        }
    }, [reconnect])

    useEffect(() => {
        pushMessage({ type: MessageType.INFO, text: "Connecting to Server..." })
        setReconnect(true)

        // TODO: dedup
        window.onbeforeunload = () => {
            setSocketOk(false)
            socketRef.current.ok = false
            socketRef.current.ws?.close()
        }

        return () => {
            window.onbeforeunload = null

            setSocketOk(false)
            socketRef.current.ok = false
            socketRef.current.ws?.close()
        }
    }, [])

    useEffect(() => {
        const socket = socketRef.current
        if (!socket.ok || !socket.ws) { return }

        const m = outQueue.shift()
        if (!m) { return }

        socket.ws.send(Message.encode(m).finish())
    }, [outQueue.length])

    return (
        <SocketContext.Provider value={{ queue: inQueue, sendMessage, socketOk }}>
            {children}
        </SocketContext.Provider>
    )
}
