"use client";

import React from "react";
import MessageEntry from "@/components/MessageEntry";
import type { Message } from "@/types/clip";
import { animated, useSpring } from "@react-spring/web";
import styles from "./MessageBox.module.css";

const Entry = animated(MessageEntry);

type Props = { messages: Message[] };

export default function MessageBox({ messages }: Props): React.ReactNode {
    const [spring, api] = useSpring(() => ({
        from: { x: -100 },
        to: { x: 0 }
    }));

    api.start({
        from: { x: -100 },
        to: { x: 0 }
    });

    return (
        <div className={ styles.box }>
            { messages.map((x, i) => <Entry message={ x } key={ i } style={{ ...spring }} />) }
        </div>
    );
}
