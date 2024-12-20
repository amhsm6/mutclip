"use client";

import React, { createContext, useState, useEffect, useRef } from "react";
import type { EntryProps } from "@/components/MessageEntry";
import type { Message } from "@/types/clipboard";

type MessageQueue = {
    entries: Entry[],
    pushMessage: PushMessage
};

type Entry = {
    props: EntryProps,
    id: number
};

type PushMessage = (m: Message) => void;

const MessageQueueContext = createContext<MessageQueue>({ entries: [], pushMessage: () => {} });

export default MessageQueueContext;

type Props = { children: React.ReactNode };

export function MessageQueueProvider({ children }: Props): React.ReactNode {
    const [entries, setEntries] = useState<Entry[]>([]);
    const newEntryId = useRef<number>(0);

    const pushMessage: PushMessage = message => {
        setEntries(es => [
            { props: { message, animation: 0 }, id: newEntryId.current++ },
            ...es.map(({ props, ...e }) => ({ ...e, props: { ...props, animation: props.animation + 1 } }))
        ]);
    };

    useEffect(() => {
        if (!entries.length) { return; }

        const id = entries[0].id;
        setTimeout(() => {
            setEntries(es => es.map(e => e.id === id ? { ...e, props: { ...e.props, animation: -1 } } : e));
            setTimeout(() => setEntries(es => es.filter(e => e.id !== id)), 500);
        }, 1500);
    }, [entries.length]);

    return <MessageQueueContext.Provider value={{ entries, pushMessage }}>{ children }</MessageQueueContext.Provider>;
}
