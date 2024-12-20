"use client";

import React, { use, useState, useEffect, useContext, useRef } from "react";
import BodyRefContext from "@/contexts/BodyRefContext";
import MessageQueueContext from "@/contexts/MessageQueueContext";
import { MessageType } from "@/types/clipboard";
import MessageBox from "@/components/MessageBox";
import Downloader from "./components/Downloader";
import Uploader from "./components/Uploader";
import Preview from "./components/Preview";
import ControlButton from "./components/ControlButton";
import { FaRegTrashCan, } from "react-icons/fa6";
import ClipboardJS from "clipboard";
import { FaRegCopy } from "react-icons/fa";
import ClipLoader from "react-spinners/ClipLoader";
import styles from "./page.module.css";
import { useSocketContents } from "./hooks";

type Props = {
    params: Promise<{ clipId: string }>
};

export default function Page({ params }: Props): React.ReactNode {
    const clipId = use(params).clipId;

    const { contents, reset, setText, setFile, socketState } = useSocketContents({ clipId })
    const [renderedContents, setRenderedContents] = useState<string>("");

    const { pushMessage } = useContext(MessageQueueContext);

    const bodyRef = useContext(BodyRefContext);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    if (socketState.error) { throw socketState.error };

    useEffect(() => {
        if (contents.type === "text") {
            setRenderedContents(contents.data);
        } else {
            setRenderedContents(`${contents.filename}: ${contents.contentType}`);
        }
    }, [contents.data, contents.incoming]);

    const copy = () => {
        if (!inputRef.current) { return; }
        ClipboardJS.copy(inputRef.current);

        pushMessage({ type: MessageType.INFO, text: "Copied" });
    };

    const paste = (e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items || items.length !== 1) { return; }
        const item = items[0];

        switch (item.kind) {
            case "string":
                item.getAsString(setText);

                break;

            case "file":
                const file = item.getAsFile();
                if (!file) { break; }

                setFile(file);

                break;

            default:
        }
    };

    useEffect(() => {
        const body = bodyRef.current;
        const input = inputRef.current;

        if (!body || !input) { return; }

        body.onpaste = paste;
        body.onkeydown = e => {
            if (e.key === "Escape") { reset(); }

            if (e.key === "Enter") {
                input.focus();
                e.preventDefault();
            }
        };

        return () => {
            body.onpaste = null;
            body.onkeydown = null;
        };
    }, []);

    return (
        <div className={ styles.content }>
            <div className={ styles.main }>
                <div className={ styles.input }>
                    <div className={ styles.header }>
                        <strong>{ clipId }</strong>
                    </div>

                    <textarea
                        ref={ inputRef }
                        value={ renderedContents }
                        onChange={ e => setText(e.target.value) }
                        disabled={ contents.type === "file" || !socketState.connected || socketState.receiving }
                        autoFocus
                        rows={ 10 }
                    />
                    <div className={ styles["bottom-row"] }>
                        <div className={ styles.controls }>
                            <ControlButton className={ styles.reset } onClick={ reset }>
                                <FaRegTrashCan />
                            </ControlButton>
                            <ControlButton className={ styles.copy } onClick={ copy }>
                                <FaRegCopy />
                            </ControlButton>
                            <Uploader setFile={ setFile } disabled={ socketState.receiving } />
                            <Downloader contents={ contents } />
                        </div>
                        { (!socketState.connected || socketState.sending || socketState.receiving) && <ClipLoader /> }
                    </div>
                </div>
                <div className={ styles["message-box"] }>
                    <MessageBox />
                </div>
            </div>

            <div className={ styles.preview } >
                <Preview contents={ contents } />
            </div>
        </div>
    );
}
