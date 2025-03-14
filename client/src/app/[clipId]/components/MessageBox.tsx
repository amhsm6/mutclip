"use client";

import React, { useContext } from "react";
import MessageQueueContext from "@/app/[clipId]/contexts/MessageQueueContext";
import MessageEntry from "./MessageEntry";
import styles from "./MessageBox.module.css";

export default function MessageBox() {
    const { entries } = useContext(MessageQueueContext);

    return (
        <div className={styles.box}>
            {entries.map((e, i) => <MessageEntry {...e.props} key={e.id} />)}
        </div>
    );
}
