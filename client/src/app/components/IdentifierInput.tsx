"use client";

import React, { useState, useEffect, useContext } from "react";
import { connect } from "../actions";
import InputBox from "./InputBox";
import styles from "./IdentifierInput.module.css";

export default function IndetifierInput() {
    const [cursor, setCursor] = useState(0);
    const [input, setInput] = useState("");

    const [notFound, setNotFound] = useState(false);

    const [error, setError] = useState<Error | null>(null);
    if (error) { throw error; }

    useEffect(() => {
        cursor < 0 && setCursor(0);
        cursor > 9 && setCursor(9);
    }, [cursor]);

    useEffect(() => {
        setNotFound(false);

        if (input.length === 6) {
            connect(input)
                .then(setNotFound)
                .catch(err => setError(err));
        }
    }, [input]);

    return (
        <div className={ styles.container }>
            <div className={ styles.row }>
                { [0, 1].map(index => (
                    <InputBox
                        key={ index }
                        index={ index }
                        cursor={ cursor }
                        set={ c => { setInput(input + c); setCursor(cursor + 1); } }
                        clear={ () => { setInput(input.slice(0, input.length - 1)); setCursor(cursor - 1); } }
                        notFound={ notFound }
                    />
                )) }
                <h1>-</h1>
                { [2, 3].map(index => (
                    <InputBox
                        key={ index }
                        index={ index }
                        cursor={ cursor }
                        set={ c => { setInput(input + c); setCursor(cursor + 1); } }
                        clear={ () => { setInput(input.slice(0, input.length - 1)); setCursor(cursor - 1); } }
                        notFound={ notFound }
                    />
                )) }
                <h1>-</h1>
                { [4, 5].map(index => (
                    <InputBox
                        key={ index }
                        index={ index }
                        cursor={ cursor }
                        set={ c => { setInput(input + c); setCursor(cursor + 1); } }
                        clear={ () => { setInput(input.slice(0, input.length - 1)); setCursor(cursor - 1); } }
                        notFound={ notFound }
                        forceLast={ index === 5 && cursor === 6 }
                    />
                )) }
            </div>
        </div>
    );
}
