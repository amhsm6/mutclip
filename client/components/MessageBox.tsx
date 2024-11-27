"use client";

import React, { useContext } from "react";
import MessageQueueContext from "@/contexts/MessageQueueContext";
import MessageEntry from "@/components/MessageEntry";
import styles from "./MessageBox.module.css";

export default function MessageBox(): React.ReactNode {
    const { entries } = useContext(MessageQueueContext);

    return (
        <div className={ styles.box }>
            { entries.map((e, i) => <MessageEntry { ...e.props } key={ e.id } />) }
        </div>
    );
}
