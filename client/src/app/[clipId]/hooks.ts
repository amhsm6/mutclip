"use client"

import { useState, useEffect, useContext, useRef } from "react"
import SocketContext from "./contexts/SocketContext"
import MessageQueueContext, { MessageType } from "./contexts/MessageQueueContext"
import type { Contents } from "./types/clipboard"
import { type FileHeader, Message, type Chunk } from "@/pb/clip"

interface FileSendState {
    nextChunk: number
}

interface FileRecvState {
    header: FileHeader
    chunks: Chunk[]
    nextChunk: number
}

const cut = async (data: Blob) => {
    const bytes = new Uint8Array(await data.arrayBuffer())

    const chunkSize = 500 * 1024
    const numChunks = Math.ceil(data.size / chunkSize)

    const chunks = []
    for (let i = 0; i < numChunks; i++) {
        chunks.push({
            index: i,
            data: bytes.slice(i * chunkSize, i * chunkSize + chunkSize)
        })
    }

    return chunks
}

// TODO: refactor to global state object of types sending text, sending file, receiving file ...
// FIXME: if server delay is big, than if one client starts sending text, then other client starts sending another text,
// first client receives new text but does not cancel its send operation, thus other client receives different text. clients desyncronized

// FIXME: also if while client is receiving file, it sends message (starts sending before, timeout, message send in-flight)
// server awaits new chunks but client thinks it's sending text so ignores messages

interface SocketState {
    connected: boolean
    sending: boolean
    receiving: boolean
    error: Error | null
}

export function useSocketContents() {
    const { sendMessage, queue, socketOk } = useContext(SocketContext)

    const [contents, setContents] = useState<Contents & { incoming: boolean }>({ type: "text", data: "", incoming: true })

    const fileRecvStateRef = useRef<FileRecvState | null>(null)
    const [fileSendState, setFileSendState] = useState<FileSendState | null>(null)

    const { pushMessage } = useContext(MessageQueueContext)

    const [socketState, setSocketState] = useState<SocketState>({
        connected: false,
        sending: false,
        receiving: false, // TODO: initial receive
        error: null
    })

    useEffect(() => {
        setSocketState(s => ({ ...s, connected: socketOk }))

        if (!socketOk) {
            setFileSendState(null)
            fileRecvStateRef.current = null

            setSocketState(s => ({ ...s, sending: false, receiving: false }))
        }
    }, [socketOk]) // TODO: why do we need fileSendState?

    useEffect(() => {
        const m = queue.shift()
        if (!m) { return }

        if (m.text) {
            setContents({ type: "text", data: m.text.data, incoming: true })

            setSocketState(s => ({ ...s, receiving: false }))
        } else if (m.nextChunk) {
            setFileSendState(fss => fss ? { nextChunk: fss.nextChunk + 1 } : null)
        } else if (m.hdr) {
            fileRecvStateRef.current = {
                header: m.hdr,
                chunks: [],
                nextChunk: 0
            }

            setSocketState(s => ({ ...s, receiving: true }))
            pushMessage({ type: MessageType.INFO, text: `Receiving ${m.hdr.filename}` })

            sendMessage(Message.create({ nextChunk: {} }))
        } else if (m.chunk) {
            if (!fileRecvStateRef.current) {
                setSocketState(s => ({ ...s, receiving: false }))

                pushMessage({ type: MessageType.ERROR, text: "Unexpected message while receiving" })
                return
            }

            if (fileRecvStateRef.current.nextChunk != m.chunk.index) {
                fileRecvStateRef.current = null
                setSocketState(s => ({ ...s, receiving: false }))

                pushMessage({ type: MessageType.ERROR, text: "Transmission disordered" })
                return
            }

            fileRecvStateRef.current.chunks.push(m.chunk)
            fileRecvStateRef.current.nextChunk++

            if (fileRecvStateRef.current.nextChunk < fileRecvStateRef.current.header.numChunks) {
                sendMessage(Message.create({ nextChunk: {} }))
                return
            }

            const data = new Blob(fileRecvStateRef.current.chunks.map(chunk => chunk.data as BlobPart))

            setContents({
                type: "file",
                contentType: fileRecvStateRef.current.header.contentType,
                filename: fileRecvStateRef.current.header.filename,
                data,
                chunks: fileRecvStateRef.current.chunks,
                incoming: true
            })

            fileRecvStateRef.current = null
            setSocketState(s => ({ ...s, receiving: false }))
        } else if (m.ack) {
            setFileSendState(null)
            setSocketState(s => ({ ...s, sending: false }))
        } else if (m.err) {
            const err = m.err

            setFileSendState(null)
            fileRecvStateRef.current = null
            setSocketState(s => ({ ...s, sending: false, receiving: false }))

            if (err.fatal) {
                setSocketState(s => ({ ...s, error: new Error(err.desc) }))
            } else {
                pushMessage({ type: MessageType.ERROR, text: err.desc })
            }
        } else {
            setFileSendState(null)
            fileRecvStateRef.current = null
            setSocketState(s => ({ ...s, sending: false, receiving: false }))

            pushMessage({ type: MessageType.ERROR, text: "Unexpected message" })
        }
    }, [queue.length])

    useEffect(() => {
        const index = fileSendState?.nextChunk
        if (index === undefined || index === -1 || contents.type !== "file") { return }

        if (index >= contents.chunks.length) {
            setFileSendState(null)
            setSocketState(s => ({ ...s, sending: false }))

            pushMessage({ type: MessageType.ERROR, text: "File send might be corrupted" })
            return
        }

        sendMessage(Message.create({
            chunk: contents.chunks[index]
        }))
    }, [fileSendState, contents.data])

    useEffect(() => {
        if (contents.incoming) { return }

        const timeout = setTimeout(() => {
            setSocketState(s => ({ ...s, sending: true }))

            if (contents.type === "text") {
                sendMessage(Message.create({
                    text: { data: contents.data }
                }))
            } else {
                sendMessage(Message.create({
                    hdr: { filename: contents.filename, contentType: contents.contentType, numChunks: contents.chunks.length }
                }))

                setFileSendState({ nextChunk: -1 })
            }
        }, 500)

        return () => clearTimeout(timeout)
    }, [contents.data])

    const reset = () => {
        if (fileSendState || fileRecvStateRef.current) { return }

        sendMessage(Message.create({ text: { data: "" } }))

        setContents({ type: "text", data: "", incoming: true })

        setFileSendState(null)
        fileRecvStateRef.current = null

        setSocketState(s => ({ ...s, sending: false, receiving: false }))
    }

    const setText = (text: string) => {
        if (fileSendState || fileRecvStateRef.current) { return }

        setContents({ type: "text", data: text, incoming: false })
    }

    const setFile = (file: File) => {
        if (fileSendState || fileRecvStateRef.current) { return }

        if (file.size > 150 * 1024 * 1024) {
            pushMessage({ type: MessageType.ERROR, text: "Maximum file size is 150 MB" })
            return
        }

        pushMessage({ type: MessageType.INFO, text: `Uploading ${file.name}` })

        const reader = new FileReader()

        reader.onload = async e => {
            const res = e.target?.result
            if (!res || !(res instanceof ArrayBuffer)) { return }

            const type = !file.type || file.type === "text/plain" ? "application/octet-stream" : file.type
            const data = new Blob([res])
            const chunks = await cut(data)

            setContents({
                type: "file",
                contentType: type,
                filename: file.name || "file",
                data,
                chunks,
                incoming: false
            })
        }

        reader.readAsArrayBuffer(file)
    }

    return {
        contents,
        reset,
        setText,
        setFile,
        socketState
    }
}
