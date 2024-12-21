"use client";

import React, { useState } from "react";
import { newclip } from "./actions";
import ControlButton from "@/components/ControlButton";
import IdentifierInput from "./components/IdentifierInput";
import styles from "./page.module.css";

// TODO: make page responsive

export default function Page() {
    const [error, setError] = useState<Error | null>(null);
    if (error) { throw error; }

    const generateNew = () => {
        newclip()
            .catch(err => setError(err));
    };

    return (
        <div className={ styles.container }>
            <div className={ styles.generate } >
                <ControlButton onClick={ generateNew }>Generate New</ControlButton>
            </div>
            <IdentifierInput />
        </div>
    );
}
