"use client"

import type { Contents } from "../types/clipboard"
import styles from "./Preview.module.css"

const previewTypes: string[] = ["image/gif", "image/png", "image/jpeg"]

interface Props {
    contents: Contents
}

export default function Preview({ contents }: Props) {
    if (contents.type === "text" || !previewTypes.includes(contents.contentType)) {
        return null
    }

    const src = URL.createObjectURL(contents.data)
    return <img className={styles.img} src={src} />
}
