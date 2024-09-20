"use client";

import React, { useState, useEffect, useRef } from "react";
import MessageEntry, { EntryProps } from "@/components/MessageEntry";
import type { Message } from "@/types/clip";
import styles from "./MessageBox.module.css";

type Props = { message: Message | null };

type Entry = {
    props: EntryProps,
    id: number
};

export default function MessageBox({ message }: Props): React.ReactNode {
    const [entries, setEntries] = useState<Entry[]>([]);
    const newEntryId = useRef<number>(0);

    useEffect(() => {
        if (!message) {
            setEntries([]);
            newEntryId.current = 0;
            return;
        }

        setEntries(es => [
            { props: { message, animation: 0 }, id: newEntryId.current++ },
            ...es.map(({ props, ...e }) => ({ ...e, props: { ...props, animation: props.animation + 1 } }))
        ]);
    }, [message]);

    useEffect(() => {
        if (!entries.length) { return; }

        const id = entries[0].id;
        setTimeout(() => {
            setEntries(es => es.map(e => e.id === id ? { ...e, props: { ...e.props, animation: -1 } } : e));

            setTimeout(() => setEntries(es => es.filter(e => e.id !== id)), 500);
        }, 1500);
    }, [entries.length]);

    return (
        <div className={ styles.box }>
            { entries.map((e, i) => <MessageEntry { ...e.props } key={ e.id } />) }
        </div>
    );
}
