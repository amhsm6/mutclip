"use client"

import { useState, useEffect, useContext, useRef } from "react"
import SocketContext from "./contexts/SocketContext"
import MessageQueueContext, { MessageType } from "./contexts/MessageQueueContext"
import type { Contents } from "./types/clipboard"
import { type FileHeader, Message, type Chunk } from "@/pb/clip"

interface Disconnected {
    type: "Disconnected"
}

interface Errored {
    type: "Errored"
    error: Error
}

interface AwaitingInitialReceive {
    type: "AwaitingInitialReceive"
}

interface Idle {
    type: "Idle"
}

interface SendingText {
    type: "SendingText"
}

interface SendingFile {
    type: "SendingFile"
    nextChunk: number | null
}

interface ReceivingFile {
    type: "ReceivingFile"
    header: FileHeader
    nextChunk: number
}

type SocketState = Disconnected | Errored | AwaitingInitialReceive | Idle | SendingText | SendingFile | ReceivingFile

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

export function useSocketContents() {
    const { sendMessage, queue, socketOk } = useContext(SocketContext)
    const { pushMessage } = useContext(MessageQueueContext)

    const [contents, setContents] = useState<Contents & { incoming: boolean }>({ type: "text", data: "", incoming: true })

    const [socketState, setSocketState] = useState<SocketState>({ type: "Disconnected" })
    const fileRecvRef = useRef<Chunk[] | null>(null)

    const firstConnection = useRef(true)
    useEffect(() => {
        if (socketOk) {
            if (firstConnection.current) {
                firstConnection.current = false

                setSocketState({ type: "AwaitingInitialReceive" })
                fileRecvRef.current = null
            } else {
                setSocketState({ type: "Idle" })
                fileRecvRef.current = null
            }
        } else {
            setSocketState({ type: "Disconnected" })
            fileRecvRef.current = null
        }
    }, [socketOk])

    useEffect(() => {
        const m = queue.shift()
        if (!m) { return }

        if (m.text) {
            if (socketState.type !== "Idle" && socketState.type !== "AwaitingInitialReceive" && socketState.type !== "Disconnected") { return } // TODO: maybe log error

            setContents({ type: "text", data: m.text.data, incoming: true })

            setSocketState({ type: "Idle" })
            fileRecvRef.current = null
        } else if (m.nextChunk) {
            if (socketState.type !== "SendingFile") { return }

            if (socketState.nextChunk === null) {
                setSocketState({ type: "SendingFile", nextChunk: 0 })
            } else {
                const nextChunk = socketState.nextChunk + 1
                setSocketState({ type: "SendingFile", nextChunk })
            }
            fileRecvRef.current = null
        } else if (m.hdr) {
            if (socketState.type !== "Idle" && socketState.type !== "AwaitingInitialReceive" && socketState.type !== "Disconnected") { return }

            setSocketState({
                type: "ReceivingFile",
                header: m.hdr,
                nextChunk: 0
            })
            fileRecvRef.current = []

            pushMessage({ type: MessageType.INFO, text: `Receiving ${m.hdr.filename}` })

            sendMessage(Message.create({ nextChunk: {} }))
        } else if (m.chunk) {
            if (socketState.type !== "ReceivingFile") { return }

            if (socketState.nextChunk != m.chunk.index) {
                setSocketState({ type: "Idle" })
                fileRecvRef.current = null
                pushMessage({ type: MessageType.ERROR, text: "Transmission disordered" })
                return
            }

            fileRecvRef.current!.push(m.chunk)
            socketState.nextChunk++

            if (socketState.nextChunk < socketState.header.numChunks) {
                setSocketState({ ...socketState })
                sendMessage(Message.create({ nextChunk: {} }))
                return
            }

            const data = new Blob(fileRecvRef.current!.map(chunk => chunk.data as BlobPart))
            setContents({
                type: "file",
                contentType: socketState.header.contentType,
                filename: socketState.header.filename,
                data,
                chunks: fileRecvRef.current!,
                incoming: true
            })

            setSocketState({ type: "Idle" })
            fileRecvRef.current = null
        } else if (m.ack) {
            if (socketState.type !== "SendingText" && socketState.type !== "SendingFile") { return }

            setSocketState({ type: "Idle" })
            fileRecvRef.current = null
        } else if (m.err) {
            const err = m.err
            if (err.fatal) {
                setSocketState({ type: "Errored", error: new Error(err.desc) })
                fileRecvRef.current = null
            } else {
                setSocketState({ type: "Idle" })
                fileRecvRef.current = null
                pushMessage({ type: MessageType.ERROR, text: err.desc })
            }
        } else {
            setSocketState({ type: "Idle" })
            fileRecvRef.current = null
            pushMessage({ type: MessageType.ERROR, text: "Unexpected message" })
        }
    }, [queue])

    useEffect(() => {
        if (contents.type !== "file" || socketState.type !== "SendingFile") { return }
        if (socketState.nextChunk === null) { return }

        const index = socketState.nextChunk

        if (index >= contents.chunks.length) {
            setSocketState({ type: "Idle" })
            fileRecvRef.current = null
            pushMessage({ type: MessageType.ERROR, text: "File send might be corrupted" })
            return
        }

        sendMessage(Message.create({
            chunk: contents.chunks[index]
        }))
    }, [socketState])

    useEffect(() => {
        if (socketState.type !== "Idle" || contents.incoming) { return }

        const timeout = setTimeout(() => {
            if (socketState.type !== "Idle") { return }

            if (contents.type === "text") {
                setSocketState({ type: "SendingText" })
                fileRecvRef.current = null

                sendMessage(Message.create({
                    text: { data: contents.data }
                }))
            } else {
                setSocketState({ type: "SendingFile", nextChunk: null })
                fileRecvRef.current = null

                sendMessage(Message.create({
                    hdr: { filename: contents.filename, contentType: contents.contentType, numChunks: contents.chunks.length }
                }))
            }
        }, 500)

        return () => clearTimeout(timeout)
    }, [contents])

    const reset = () => {
        if (socketState.type !== "Idle") { return }

        sendMessage(Message.create({ text: { data: "" } })) // TODO: need special reset message type that would break from file transmission

        setContents({ type: "text", data: "", incoming: true })

        setSocketState({ type: "Idle" })
        fileRecvRef.current = null
    }

    const setText = (text: string) => {
        if (socketState.type !== "Idle") { return }

        setContents({ type: "text", data: text, incoming: false })
    }

    const setFile = (file: File) => {
        if (socketState.type !== "Idle") { return }

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
