"use client"

import ClipLoader from "react-spinners/ClipLoader"
import styles from "./Loading.module.css"

export default function Loading() {
    return (
        <div className={styles.container}>
            <ClipLoader />
        </div>
    )
}
