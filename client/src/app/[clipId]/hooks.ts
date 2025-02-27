"use client";

import { useState, useEffect, useContext, useRef } from "react";
import MessageQueueContext from "@/contexts/MessageQueueContext";
import { Contents, MessageType } from "@/types/clipboard";
import { FileHeader, Message, Chunk } from "@/pb/clip";

type FileBuffer = {
    header:    FileHeader,
    chunks:    Chunk[],
    nextChunk: number
};

//const cut = (data: Blob): Chunk[] => {
    //const chunkSize = 500 * 1024;
    //const numChunks = Math.ceil(data.size / chunkSize);

    //const chunks = [];
    //for (let i = 0; i < numChunks; i++) {
        //chunks.push({
            //index: i,
            //data: data.slice(i * chunkSize, i * chunkSize + chunkSize)
        //});
    //}

    //return chunks;
//};

type SocketState = {
    connected: boolean,
    sending:   boolean,
    receiving: boolean,
    error:     Error | null
};

type Props = {
    clipId: string
};

export function useSocketContents({ clipId }: Props) {
    const socketRef = useRef<WebSocket | null>(null);

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
                fileBufferRef.current = null;

                setSocketState(s => ({ ...s, receiving: false }));
            } else if (m.hdr) {
                fileBufferRef.current = {
                    header: m.hdr,
                    chunks: [],
                    nextChunk: 0
                };

                setSocketState(s => ({ ...s, receiving: true }));
                pushMessage({ type: MessageType.INFO, text: `Receiving ${m.hdr.filename}` });
            } else if (m.chunk) {
        //    if (!fileBufferRef.current) {
        //        setSocketState(s => ({ ...s, receiving: false }));
        //        callback(false);
        //        return;
        //    }

        //    if (fileBufferRef.current.nextChunk != chunk.index) {
        //        fileBufferRef.current = null;
        //        callback(false);
        //        setSocketState(s => ({ ...s, error: new Error("Internal Server Error") }));
        //        return;
        //    }

        //    fileBufferRef.current.chunks.push(chunk);
        //    fileBufferRef.current.nextChunk++;

        //    if (fileBufferRef.current.nextChunk < fileBufferRef.current.header.numChunks) {
        //        callback(true);
        //        return;
        //    }

        //    const data = new Blob(fileBufferRef.current.chunks.map(chunk => chunk.data));

        //    setContents({
        //        type: "file",
        //        contentType: fileBufferRef.current.header.type,
        //        filename: fileBufferRef.current.header.name,
        //        data,
        //        chunks: fileBufferRef.current.chunks,
        //        incoming: true
        //    });

        //    fileBufferRef.current = null;

        //    setSocketState(s => ({ ...s, receiving: false }));
        //    callback(false);
            } else if (m.ack) {
                setSocketState(s => ({ ...s, sending: false }));
            } else if (m.err) {
                pushMessage({ type: MessageType.ERROR, text: m.err.desc });
                //    setSocketState(s => ({ ...s, error: new Error("Internal Server Error") })); TODO?
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
        if (!socket || socket.readyState != WebSocket.OPEN || contents.incoming) { return; }

        const timeout = setTimeout(() => {
            setSocketState(s => ({ ...s, sending: true }));

            if (contents.type === "text") {
                const m = Message.create({
                    text: { data: contents.data }
                });
            
                socket.send(Message.encode(m).finish());
            } else {
                //socket.emit("file", { type: contents.contentType, name: contents.filename, numChunks: contents.chunks.length });

                //const send = (index: number) => {
                //    if (index >= contents.chunks.length) { return; }

                //    socket.emit("chunk", contents.chunks[index], (cont: boolean) => {
                //        if (cont) { send(index + 1); }
                //    });
                //};

                //send(0);
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
            const chunks: Chunk[] = []//cut(data);

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
