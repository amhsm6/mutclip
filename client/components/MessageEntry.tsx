"use client";

import React, { useState, useEffect } from "react";
import { Message, MessageType } from "@/types/clip";
import styles from "./MessageEntry.module.css";

export type EntryProps = {
    message: Message,
    animation: number
};

export default function MessageEntry({ message, animation }: EntryProps): React.ReactNode {
    let typeclass = "";

    switch (message.type) {
        case MessageType.INFO:
            typeclass = styles.info;
            break;

        case MessageType.ERROR:
            typeclass = styles.error;
            break;

        default:
    }

    const [dy, setDy] = useState<number>(0);
    const [die, setDie] = useState<boolean>(false);

    useEffect(() => {
        if (animation > 0) {
            setDy(y => y + 15);
        } else if (animation === -1) {
            setDie(true);
        }
    }, [animation]);

    return (
        <div className={ `${styles.message} ${typeclass}` } style={{ transform: `translate(${die ? -500 : 0}px, ${dy}px)` }}>
            <span>{ message.text }</span>
        </div>
    );
}
