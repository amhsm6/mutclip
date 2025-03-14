"use client";

import React, { createContext, useState, useEffect, useRef, useContext } from "react";
import { Message } from "@/pb/clip";
import MessageQueueContext, { MessageType } from "./MessageQueueContext";

type Socket = {
    sendMessage: SendMessage,
    queue: Message[],
    socketOk: boolean
};

type SendMessage = (m: Message) => void;

const SocketContext = createContext<Socket>({ sendMessage: () => { }, queue: [], socketOk: false });

export default SocketContext;

type WS = {
    ws: WebSocket | null,
    ok: boolean,
    reconnecting: boolean
};

type Props = {
    clipId: string
};

export function SocketProvider({ clipId, children }: React.PropsWithChildren<Props>) {
    const socketRef = useRef<WS>({ ws: null, ok: false, reconnecting: false });
    const [reconnect, setReconnect] = useState<boolean>(false);

    const [outQueue, setOutQueue] = useState<Message[]>([]);
    const [inQueue, setInQueue] = useState<Message[]>([]);

    const sendMessage: SendMessage = m => setOutQueue([...outQueue, m]);

    const [socketOk, setSocketOk] = useState<boolean>(false);

    const { pushMessage } = useContext(MessageQueueContext);

    useEffect(() => {
        if (!reconnect) { return; }
        setReconnect(false);

        const ws = new WebSocket(`/ws/${clipId}`);
        ws.binaryType = "arraybuffer";

        socketRef.current.ws = ws;

        ws.onopen = () => {
            socketRef.current.ok = true;
            setSocketOk(true);
            pushMessage({ type: MessageType.SUCCESS, text: "Server Connected" });
        };

        ws.onmessage = msg => {
            if (!(msg.data instanceof ArrayBuffer)) {
                pushMessage({ type: MessageType.ERROR, text: "Websocket Error" });
                return;
            }

            const m = Message.decode(new Uint8Array(msg.data));

            setInQueue(q => [...q, m]);
        };

        ws.onerror = () => {
            if (socketRef.current.reconnecting) { return; }

            socketRef.current.ok = false;
            socketRef.current.ws = null;
            socketRef.current.reconnecting = true;
            setSocketOk(false);

            ws.close();

            pushMessage({ type: MessageType.ERROR, text: "Websocket Error" });
            pushMessage({ type: MessageType.INFO, text: "Reconnecting in 1s" });

            setTimeout(() => {
                pushMessage({ type: MessageType.INFO, text: "Reconnecting..." });
                setReconnect(true);
            }, 1000);
        };

        ws.onclose = () => {
            if (socketRef.current.reconnecting) { return; }

            socketRef.current.ok = false;
            socketRef.current.ws = null;
            socketRef.current.reconnecting = true;
            setSocketOk(false);

            ws.close();

            pushMessage({ type: MessageType.ERROR, text: "Websocket Closed Unexpectedly" });
            pushMessage({ type: MessageType.INFO, text: "Reconnecting in 1s" });

            setTimeout(() => {
                pushMessage({ type: MessageType.INFO, text: "Reconnecting..." });
                setReconnect(true);
            }, 1000);
        };
    }, [reconnect]);

    useEffect(() => {
        pushMessage({ type: MessageType.INFO, text: "Connecting to Server..." });
        setReconnect(true);

        return () => {
            const ws = socketRef.current.ws;

            socketRef.current.ok = false;
            socketRef.current.ws = null;
            setSocketOk(false);

            ws?.close();
        };
    }, []);

    useEffect(() => {
        const socket = socketRef.current;
        if (!socket.ok || !socket.ws) { return; }

        const m = outQueue.shift();
        if (!m) { return; }

        socket.ws.send(Message.encode(m).finish());
    }, [outQueue.length])

    return (
        <SocketContext.Provider value={{ queue: inQueue, sendMessage, socketOk }}>
            {children}
        </SocketContext.Provider>
    );
}
