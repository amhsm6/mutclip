"use client";

import React from "react";
import ClipLoader from "react-spinners/ClipLoader";
import styles from "./loading.module.css";

export default function Loading(): React.ReactNode {
    return (
        <html lang="en">
            <body>
                <div className={ styles.container }>
                    <ClipLoader />
                </div>
            </body>
        </html>
    )
}
