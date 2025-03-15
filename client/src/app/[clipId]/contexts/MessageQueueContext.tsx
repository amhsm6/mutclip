"use client";

import React, { createContext, useState, useEffect, useRef } from "react";
import type { EntryProps } from "../components/MessageEntry";

export type Message = {
    type: MessageType,
    text: string
};

export enum MessageType {
    SUCCESS,
    INFO,
    ERROR
};

type MessageQueue = {
    entries: Entry[],
    pushMessage: PushMessage
};

type Entry = {
    props: EntryProps,
    id: number
};

type PushMessage = (m: Message) => void;

const MessageQueueContext = createContext<MessageQueue>({ entries: [], pushMessage: () => { } });

export default MessageQueueContext;

export function MessageQueueProvider({ children }: React.PropsWithChildren) {
    const [entries, setEntries] = useState<Entry[]>([]);
    const newEntryId = useRef(0);
    const spawnDelay = useRef(0);

    useEffect(() => {
        const interval = setInterval(() => {
            if (spawnDelay.current) {
                spawnDelay.current -= 10;
            }
        }, 10);

        return () => clearInterval(interval);
    }, []);

    const pushMessage: PushMessage = message => {
        const delay = spawnDelay.current;
        spawnDelay.current += 400;

        setTimeout(() => {
            setEntries(es => [
                { props: { message, animation: 0 }, id: newEntryId.current++ },
                ...es.map(({ props, ...e }) => ({ ...e, props: { ...props, animation: props.animation + 1 } }))
            ]);
        }, delay);
    };

    useEffect(() => {
        if (!entries.length) { return; }

        const id = entries[0].id;
        setTimeout(() => {
            setEntries(es => es.map(e => e.id === id ? { ...e, props: { ...e.props, animation: -1 } } : e));
            setTimeout(() => setEntries(es => es.filter(e => e.id !== id)), 500);
        }, 1500);
    }, [entries.length]);

    return <MessageQueueContext.Provider value={{ entries, pushMessage }}>{children}</MessageQueueContext.Provider>;
}
