"use client";

import React, { useState, useEffect } from "react";
import { Message, MessageType } from "../contexts/MessageQueueContext";
import styles from "./MessageEntry.module.css";

export type EntryProps = {
    message: Message,
    animation: number
};

const remToPx = (rem: number) => rem * parseFloat(getComputedStyle(document.documentElement).fontSize);

export default function MessageEntry({ message, animation }: EntryProps) {
    const DIRECTION = document.body.clientWidth > remToPx(45) && document.body.clientWidth <= remToPx(60) ? 1 : -1;

    let typeclass = "";

    switch (message.type) {
        case MessageType.SUCCESS:
            typeclass = styles.success;
            break;

        case MessageType.INFO:
            typeclass = styles.info;
            break;

        case MessageType.ERROR:
            typeclass = styles.error;
            break;

        default:
    }

    const [renderDelay, setRenderDelay] = useState(true);

    useEffect(() => {
        setTimeout(() => setRenderDelay(false), 50);
    }, []);

    const [dy, setDy] = useState(0);
    const [die, setDie] = useState(false);

    useEffect(() => {
        if (animation > 0) {
            setDy(y => y + 60);
        } else if (animation === -1) {
            setDie(true);
        }
    }, [animation]);

    if (renderDelay) {
        return null;
    }

    return (
        <div className={`${styles.message} ${typeclass}`} style={{ transform: `translate(${die ? 500 * DIRECTION : 0}px, ${dy}px)` }}>
            <span>{message.text}</span>
        </div>
    );
}
