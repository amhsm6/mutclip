"use client"

import { useEffect, useRef } from "react"
import styles from "./InputBox.module.css"

interface Props {
    index: number
    count: number
    cursor: number
    input: string
    next: (c: string) => void
    prev: () => void
    notFound: boolean
}

export default function InputBox({ index, count, cursor, input, next, prev, notFound }: Props) {
    const isLast = index === count - 1
    const lastActive = cursor === count
    const isActive = index === cursor || (isLast && lastActive)

    const ref = useRef<HTMLInputElement>(null)

    useEffect(() => {
        isActive && ref.current?.focus()
    }, [cursor])

    const charInput = (c: string) => {
        /^[a-z0-9]$/.test(c) && next(c)
    }

    return (
        <input
            ref={ref}
            value={input[index] || ""}
            className={`${styles.input} ${notFound ? styles["not-found"] : styles.ok}`}
            maxLength={1}
            onChange={e => charInput(e.target.value.toLowerCase())}
            onKeyDown={e => e.key === "Backspace" && prev()}
            onFocus={e => !isActive && e.target.blur()}
            onBlur={() => isActive && ref.current?.focus()}
        />
    )
}
