"use client";

import React from "react";
import MessageEntry from "@/components/MessageEntry";
import type { Message } from "@/types/clip";
import styles from "./MessageBox.module.css";

type Props = { messages: Message[] };

export default function MessageBox({ messages }: Props): React.ReactNode {
    return (
        <div className={ styles.box }>
            { messages.map(x => <MessageEntry message={ x } />) }
        </div>
    );
}
