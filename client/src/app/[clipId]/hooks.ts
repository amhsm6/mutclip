"use client";

import { useState, useEffect, useContext, useRef } from "react";
import MessageQueueContext from "@/contexts/MessageQueueContext";
import { Contents, Chunk, MessageType } from "@/types/clipboard";
import { io, Socket } from "socket.io-client";

type FileBuffer = {
    header: Header,
    chunks: Chunk[],
    nextChunk: number
};

type Header = {
    type: string,
    name: string,
    numChunks: number
};

const cut = (data: Blob): Chunk[] => {
    const chunkSize = 500 * 1024;
    const numChunks = Math.ceil(data.size / chunkSize);

    const chunks = [];
    for (let i = 0; i < numChunks; i++) {
        chunks.push({
            index: i,
            data: data.slice(i * chunkSize, i * chunkSize + chunkSize)
        });
    }

    return chunks;
};

type SocketState = {
    connected: boolean,
    sending: boolean,
    receiving: boolean,
    error: Error | null
};

type Props = {
    clipId: string
};

export function useSocketContents({ clipId }: Props) {
    const socketRef = useRef<Socket | null>(null);

    const [contents, setContents] = useState<Contents & { incoming?: boolean }>({ type: "text", data: "" })
    const fileBufferRef = useRef<FileBuffer | null>(null);

    const { pushMessage } = useContext(MessageQueueContext);

    const [socketState, setSocketState] = useState<SocketState>({
        connected: false,
        sending: false,
        receiving: false,
        error: null
    });

    useEffect(() => {
        pushMessage({ type: MessageType.INFO, text: "Connecting to Server..." });

        const opts = { "auth": { "clip_id": clipId } };
        const socket = process.env.NODE_ENV === "production" ? io(opts) : io(process.env.NEXT_PUBLIC_API_URL, opts);

        socket.on("connect", () => {
            setSocketState(s => ({ ...s, connected: true }));
            pushMessage({ type: MessageType.SUCCESS, text: "Server Connected" });
        });

        socket.on("text", (data: string) => {
            setContents({ type: "text", data, incoming: true });
            fileBufferRef.current = null;

            setSocketState(s => ({ ...s, receiving: false }));
        });

        socket.on("file", (header: Header) => {
            fileBufferRef.current = {
                header,
                chunks: [],
                nextChunk: 0
            };

            setSocketState(s => ({ ...s, receiving: true }));
            pushMessage({ type: MessageType.INFO, text: `Receiving ${header.name}` });
        });

        socket.on("chunk", (chunk: Chunk, callback: (cont: boolean) => void) => {
            if (!fileBufferRef.current) {
                setSocketState(s => ({ ...s, receiving: false }));
                callback(false);
                return;
            }

            if (fileBufferRef.current.nextChunk != chunk.index) {
                fileBufferRef.current = null;
                callback(false);
                setSocketState(s => ({ ...s, error: new Error("Internal Server Error") }));
                return;
            }

            fileBufferRef.current.chunks.push(chunk);
            fileBufferRef.current.nextChunk++;

            if (fileBufferRef.current.nextChunk < fileBufferRef.current.header.numChunks) {
                callback(true);
                return;
            }

            const data = new Blob(fileBufferRef.current.chunks.map(chunk => chunk.data));

            setContents({
                type: "file",
                contentType: fileBufferRef.current.header.type,
                filename: fileBufferRef.current.header.name,
                data,
                chunks: fileBufferRef.current.chunks,
                incoming: true
            });

            fileBufferRef.current = null;

            setSocketState(s => ({ ...s, receiving: false }));
            callback(false);
        });

        socket.on("sync", () => {
            setSocketState(s => ({ ...s, sending: false }));
        });
        
        socket.on("noclipboard", () => {
            socket.disconnect();
            socketRef.current = null;
            setSocketState(s => ({ ...s, connected: false, error: new Error("This clipboard does not exist") }));
        });

        socket.on("error", () => {
            setSocketState(s => ({ ...s, error: new Error("Internal Server Error") }));
        });

        socketRef.current = socket;

        return () => {
            socket.disconnect();
            socketRef.current = null;
            setSocketState(s => ({ ...s, connected: false }));
        };
    }, []);

    useEffect(() => {
        const socket = socketRef.current;
        if (!socket || !socket.connected || contents.incoming) { return; }

        const timeout = setTimeout(() => {
            setSocketState(s => ({ ...s, sending: true }));

            if (contents.type === "text") {
                socket.emit("text", contents.data);
            } else {
                socket.emit("file", { type: contents.contentType, name: contents.filename, numChunks: contents.chunks.length });

                const send = (index: number) => {
                    if (index >= contents.chunks.length) { return; }

                    socket.emit("chunk", contents.chunks[index], (cont: boolean) => {
                        if (cont) { send(index + 1); }
                    });
                };

                send(0);
            }
        }, 500);

        return () => clearTimeout(timeout);
    }, [contents.data]);

    const reset = () => {
        const socket = socketRef.current;
        if (!socket) { return; }

        setSocketState(s => ({ ...s, sending: false, receiving: false }));

        socket.emit("text", "");
        setContents({ type: "text", data: "", incoming: true });
        fileBufferRef.current = null;
    };

    const setText = (text: string) => {
        setContents({ type: "text", data: text });
    };

    const setFile = (file: File) => {
        if (file.size > 150 * 1024 * 1024) {
            pushMessage({ type: MessageType.ERROR, text: "Maximum file size is 150 MB" });
            return;
        }

        pushMessage({ type: MessageType.INFO, text: `Uploading ${file.name}` });

        const reader = new FileReader();

        reader.onload = e => {
            const res = e.target?.result;
            if (!res || !(res instanceof ArrayBuffer)) { return; }

            const type = !file.type || file.type === "text/plain" ? "application/octet-stream" : file.type;
            const data = new Blob([res]);
            const chunks = cut(data);

            setContents({
                type: "file",
                contentType: type,
                filename: file.name || "file",
                data,
                chunks
            });
        };

        reader.readAsArrayBuffer(file);
    };

    return {
        contents,
        reset,
        setText,
        setFile,
        socketState
    };
}
