"use client"

import React from "react"
import styles from "./ControlButton.module.css"

type Props = React.ComponentProps<"button">

export default function ControlButton({ children, className, disabled, ...props }: Props) {
    return (
        <button
            className={`${disabled ? styles.disabled : styles.button} ${className}`}
            disabled={disabled}
            {...props}
        >
            {children}
        </button>
    )
}
