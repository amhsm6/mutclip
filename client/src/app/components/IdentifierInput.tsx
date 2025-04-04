"use client";

import React, { useState, useEffect } from "react";
import { clipRedirect } from "../actions";
import InputBox from "./InputBox";
import styles from "./IdentifierInput.module.css";

const COUNT = 6;

type Props = {
    startTransition: React.TransitionStartFunction
};

export default function IndetifierInput({ startTransition }: Props) {
    const [input, setInput] = useState("");
    const cursor = input.length;

    const next = (c: string) => {
        cursor < COUNT && setInput(input + c);
    };

    const prev = () => {
        cursor > 0 && setInput(input.slice(0, cursor - 1));
    };

    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        setNotFound(false);

        if (cursor !== COUNT) { return; }

        const id = input.slice(0, 2) + "-" + input.slice(2, 4) + "-" + input.slice(4, 6);
        startTransition(async () => {
            let no;
            try {
                no = await clipRedirect(id);
            } catch {
                throw new Error("Internal Server Error");
            }

            if (no) {
                setNotFound(true);
            } else {
                throw new Error("Unknown Error");
            }
        });
    }, [input]);

    return (
        <div className={styles.container}>
            <div className={styles.row}>
                {[0, 1].map(index => (
                    <InputBox
                        key={index}
                        index={index}
                        count={6}
                        cursor={cursor}
                        next={next}
                        prev={prev}
                        notFound={notFound}
                    />
                ))}
                <h1>-</h1>
                {[2, 3].map(index => (
                    <InputBox
                        key={index}
                        index={index}
                        count={6}
                        cursor={cursor}
                        next={next}
                        prev={prev}
                        notFound={notFound}
                    />
                ))}
                <h1>-</h1>
                {[4, 5].map(index => (
                    <InputBox
                        key={index}
                        index={index}
                        count={6}
                        cursor={cursor}
                        next={next}
                        prev={prev}
                        notFound={notFound}
                    />
                ))}
            </div>
        </div>
    );
}
