"use client"

import { useContext, useRef } from "react"
import { FaDownload } from "react-icons/fa6"

import MessageQueueContext, { MessageType } from "../contexts/MessageQueueContext"
import type { Contents } from "../types/clipboard"
import ControlButton from "@/components/ControlButton"
import styles from "./Downloader.module.css"

interface Props {
    contents: Contents
}

export default function Downloader({ contents }: Props) {
    const { pushMessage } = useContext(MessageQueueContext)

    const downloaderRef = useRef<HTMLAnchorElement>(null)

    const download = () => {
        const downloader = downloaderRef.current
        if (!downloader) { return }

        if (contents.type === "text") {
            pushMessage({ type: MessageType.ERROR, text: "No file to download" })
            return
        }

        pushMessage({ type: MessageType.INFO, text: `Downloading ${contents.filename}` })

        downloader.href = URL.createObjectURL(contents.data)
        downloader.download = contents.filename
        downloader.click()
    }

    return (
        <>
            <ControlButton className={styles.download} onClick={download}>
                <FaDownload />
            </ControlButton>
            <a ref={downloaderRef} style={{ display: "none" }}></a>
        </>
    )
}
