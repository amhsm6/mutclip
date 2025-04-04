"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./InputBox.module.css";

type Props = {
    index: number,
    count: number
    cursor: number,
    next: (c: string) => void,
    prev: () => void,
    notFound: boolean
};

//FIXME: firefox .focus() does not work
//TODO: check to allow entering only alphanumeric

export default function InputBox({ index, count, cursor, next, prev, notFound }: Props) {
    const isLast = index === count - 1;
    const lastActive = cursor === count;
    const isActive = index === cursor || (isLast && lastActive);

    const [value, setValue] = useState("");

    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => {
        isActive && ref.current?.focus();
    }, [cursor]);

    useEffect(() => {
        value && next(value);
    }, [value]);

    return (
        <input
            ref={ref}
            value={value}
            className={`${styles.input} ${notFound ? styles["not-found"] : styles.ok}`}
            maxLength={1}
            onChange={e => setValue(e.target.value.toLowerCase())}
            onKeyDown={e => e.key === "Backspace" && prev()}
            onBlur={() => isActive && ref.current?.focus()}
        />
    );
}
