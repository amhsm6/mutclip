"use client";

import React, { useEffect, useRef } from "react";
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
    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => {
        cursor === index && ref.current?.focus();
    }, [cursor]);

    return (
        <input
            ref={ ref }
            className={ `${styles.input} ${notFound ? styles["not-found"] : styles.ok}` }
            maxLength={ 1 }
            onChange={ e => e.target.value && set(e.target.value) }
            onKeyDown={ e => e.key === "Backspace" && clear() }
            onBlur={ () => (cursor === index || forceLast) && ref.current?.focus() }
        />
    );
}
