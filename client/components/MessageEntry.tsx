"use client";

import React from "react";
import { Message, MessageType } from "@/types/clip";
import styles from "./MessageEntry.module.css";

type Props = { message: Message };

export default function MessageEntry({ message }: Props): React.ReactNode {
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

    return (
        <div className={ `${styles.message} ${typeclass}` } >
            <span>{ message.text }</span>
        </div>
    );
}
