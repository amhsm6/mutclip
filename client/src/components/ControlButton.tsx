"use client"

import React from "react"

import styles from "./ControlButton.module.css"

export default function ControlButton({ children, className, disabled, ...props }: React.ComponentProps<"button">) {
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
