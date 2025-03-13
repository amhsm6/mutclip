"use client";

import { useState, useEffect, useContext, useRef } from "react";
import MessageQueueContext from "@/contexts/MessageQueueContext";
import { Contents, MessageType } from "@/types/clipboard";
import { FileHeader, Message, Chunk } from "@/pb/clip";

type FileSendState = {
    nextChunk: number
};

type FileRecvState = {
    header: FileHeader,
    chunks: Chunk[],
    nextChunk: number
};

const cut = async (data: Blob) => {
    const bytes = new Uint8Array(await data.arrayBuffer());

    const chunkSize = 500 * 1024;
    const numChunks = Math.ceil(data.size / chunkSize);

    const chunks = [];
    for (let i = 0; i < numChunks; i++) {
        chunks.push({
            index: i,
            data: bytes.slice(i * chunkSize, i * chunkSize + chunkSize)
        });
    }

    return chunks;
};

// TODO: refactor to global state object of types sending text, sending file, receiving file ...

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
    const socketRef = useRef<WebSocket | null>(null);

    const [contents, setContents] = useState<Contents & { incoming?: boolean }>({ type: "text", data: "" });

    const fileRecvStateRef = useRef<FileRecvState | null>(null);
    const [fileSendState, setFileSendState] = useState<FileSendState | null>(null);

    const { pushMessage } = useContext(MessageQueueContext);

    const [socketState, setSocketState] = useState<SocketState>({
        connected: false,
        sending: false,
        receiving: false,
        error: null
    });

    useEffect(() => {
        pushMessage({ type: MessageType.INFO, text: "Connecting to Server..." });

        const ws = new WebSocket(`/ws/${clipId}`);
        ws.binaryType = "arraybuffer";

        ws.onopen = () => {
            setSocketState(s => ({ ...s, connected: true }));
            pushMessage({ type: MessageType.SUCCESS, text: "Server Connected" });
        };

        ws.onmessage = msg => {
            if (!(msg.data instanceof ArrayBuffer)) {
                pushMessage({ type: MessageType.ERROR, text: "Unexpected message" });
                return;
            }

            const m = Message.decode(new Uint8Array(msg.data));

            if (m.text) {
                setContents({ type: "text", data: m.text.data, incoming: true });

                setSocketState(s => ({ ...s, receiving: false }));
            } else if (m.nextChunk) {
                // TODO: finish file
                setFileSendState(fss => fss ? { nextChunk: fss.nextChunk + 1 } : null);
            } else if (m.hdr) {
                fileRecvStateRef.current = {
                    header: m.hdr,
                    chunks: [],
                    nextChunk: 0
                };

                setSocketState(s => ({ ...s, receiving: true }));
                pushMessage({ type: MessageType.INFO, text: `Receiving ${m.hdr.filename}` });
            } else if (m.chunk) {
                console.log(m.chunk);

                if (!fileRecvStateRef.current) {
                    setSocketState(s => ({ ...s, receiving: false }));
                    return;
                }

                if (fileRecvStateRef.current.nextChunk != m.chunk.index) {
                    fileRecvStateRef.current = null;
                    setSocketState(s => ({ ...s, error: new Error("File transmission corrupted") }));

                    return;
                }

                fileRecvStateRef.current.chunks.push(m.chunk);
                fileRecvStateRef.current.nextChunk++;
                console.log("here");

                if (fileRecvStateRef.current.nextChunk < fileRecvStateRef.current.header.numChunks) {
                    const m = Message.create({ nextChunk: {} });
                    ws.send(Message.encode(m).finish());

                    return;
                }
                console.log("done");

                const data = new Blob(fileRecvStateRef.current.chunks.map(chunk => chunk.data));

                setContents({
                    type: "file",
                    contentType: fileRecvStateRef.current.header.contentType,
                    filename: fileRecvStateRef.current.header.filename,
                    data,
                    chunks: fileRecvStateRef.current.chunks,
                    incoming: true
                });

                fileRecvStateRef.current = null;
                setSocketState(s => ({ ...s, receiving: false }));
            } else if (m.ack) {
                setSocketState(s => ({ ...s, sending: false }));
            } else if (m.err) {
                pushMessage({ type: MessageType.ERROR, text: m.err.desc });
            } else {
                pushMessage({ type: MessageType.ERROR, text: "Unexpected message" });
            }
        };

        socketRef.current = ws;

        return () => {
            ws.close();
            socketRef.current = null;
            setSocketState(s => ({ ...s, connected: false }));
        };
    }, []);

    useEffect(() => {
        const socket = socketRef.current;
        const index = fileSendState?.nextChunk;

        if (!socket || socket.readyState != WebSocket.OPEN || index === undefined || contents.type !== "file") { return; }

        if (index >= contents.chunks.length) {
            pushMessage({ type: MessageType.ERROR, text: "File send might be corrupted" });
            return;
        }

        const m = Message.create({
            chunk: contents.chunks[index]
        });
        socket.send(Message.encode(m).finish());
    }, [fileSendState, contents.data])

    useEffect(() => {
        const socket = socketRef.current;
        if (!socket || socket.readyState != WebSocket.OPEN || contents.incoming) { return; }

        const timeout = setTimeout(() => {
            setSocketState(s => ({ ...s, sending: true }));

            if (contents.type === "text") {
                const m = Message.create({
                    text: { data: contents.data }
                });
                socket.send(Message.encode(m).finish());
            } else {
                const m = Message.create({
                    hdr: { filename: contents.filename, contentType: contents.contentType, numChunks: contents.chunks.length }
                });
                socket.send(Message.encode(m).finish());

                setFileSendState({ nextChunk: 0 });
            }
        }, 500);

        return () => clearTimeout(timeout);
    }, [contents.data]);

    const reset = () => {
        const socket = socketRef.current;
        if (!socket) { return; }

        setSocketState(s => ({ ...s, sending: false, receiving: false }));

        const m = Message.create({ text: { data: "" } });
        socket.send(Message.encode(m).finish());

        setContents({ type: "text", data: "", incoming: true });
        setFileSendState(null);
        fileRecvStateRef.current = null;
    };

    const setText = (text: string) => {
        if (fileSendState || fileRecvStateRef.current) { return; }

        setContents({ type: "text", data: text });
    };

    const setFile = (file: File) => {
        if (fileSendState || fileRecvStateRef.current) { return; }

        if (file.size > 150 * 1024 * 1024) {
            pushMessage({ type: MessageType.ERROR, text: "Maximum file size is 150 MB" });
            return;
        }

        pushMessage({ type: MessageType.INFO, text: `Uploading ${file.name}` });

        const reader = new FileReader();

        reader.onload = async e => {
            const res = e.target?.result;
            if (!res || !(res instanceof ArrayBuffer)) { return; }

            const type = !file.type || file.type === "text/plain" ? "application/octet-stream" : file.type;
            const data = new Blob([res]);
            const chunks = await cut(data);

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
