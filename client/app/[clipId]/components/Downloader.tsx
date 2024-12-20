import React, { useContext, useRef } from "react";
import MessageQueueContext from "@/contexts/MessageQueueContext";
import { Contents, MessageType } from "@/types/clipboard";
import ControlButton from "./ControlButton";
import { FaDownload } from "react-icons/fa6";
import styles from "./Downloader.module.css";

type Props = {
    contents: Contents
};

export default function Downloader({ contents }: Props) {
    const { pushMessage } = useContext(MessageQueueContext);

    const downloaderRef = useRef<HTMLAnchorElement>(null);

    const download = () => {
        const downloader = downloaderRef.current;
        if (!downloader || contents.type === "text") { return; }

        const name = contents.filename;

        pushMessage({ type: MessageType.INFO, text: `Downloading ${name}` });

        downloader.href = URL.createObjectURL(contents.data);
        downloader.download = name;
        downloader.click();
    };

    return (
        <>
            <ControlButton className={ styles.download } onClick={ download }>
                <FaDownload />
            </ControlButton>
            <a ref={ downloaderRef } style={{ display: "none" }}></a>
        </>
    );
}
