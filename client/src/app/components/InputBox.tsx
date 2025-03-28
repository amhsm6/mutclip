"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./InputBox.module.css";

type Props = {
    index: number,
    cursor: number,
    set: (c: string) => void,
    clear: () => void,
    notFound: boolean,
    forceLast?: boolean
};

//FIXME: firefox .focus() does not work

export default function InputBox({ index, cursor, set, clear, notFound, forceLast }: Props) {
    const [value, setValue] = useState("");

    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => {
        cursor === index && ref.current?.focus();
    }, [cursor]);

    useEffect(() => {
        value && set(value);
    }, [value]);

    return (
        <input
            ref={ref}
            value={value}
            className={`${styles.input} ${notFound ? styles["not-found"] : styles.ok}`}
            maxLength={1}
            onChange={e => setValue(e.target.value.toLowerCase())}
            onKeyDown={e => e.key === "Backspace" && clear()}
            onBlur={() => (cursor === index || forceLast) && ref.current?.focus()}
        />
    );
}
