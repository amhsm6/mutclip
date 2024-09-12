"use client";

import React from "react";
import styles from "./ControlButton.module.css";

type Props = React.ComponentProps<"button">;

export default function ControlButton({ children, className, ...props }: Props): React.ReactNode {
    return <button className={ `${styles.button} ${className}` } { ...props }>{ children }</button>;
}
