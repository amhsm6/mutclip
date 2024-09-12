"use client";

import React, { useState, useEffect, useContext, useRef } from "react";
import BodyRefContext from "@/contexts/BodyRefContext";
import ControlButton from "@/components/ControlButton";
// import MessageBox from "@/components/MessageBox";
import Preview from "@/components/Preview";
import { Contents, Message, MessageType } from "@/types/clip";
import { FaRegTrashCan, FaDownload, FaUpload } from "react-icons/fa6";
import { FaRegCopy, FaPaste } from "react-icons/fa";
import ClipLoader from "react-spinners/ClipLoader";
import styles from "./page.module.css";

const fromBinaryString = (bstr: string) => Uint8Array.from(bstr, x => x.charCodeAt(0));

type Props = {
    params: {
        clipId: number
    }
};

export default function Page({ params }: Props): React.ReactNode {
    const [conn, setConn] = useState<WebSocket | null>(null);

    const [contents, setContents] = useState<Contents>({
        data: "",
        contentType: "text/plain"
    });
    const plainText = contents.contentType === "text/plain";

    const [loading, setLoading] = useState<boolean>(true);

    // const [messages, setMessages] = useState<Message[]>([]);

    const bodyRef = useContext(BodyRefContext);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const downloaderRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        const ws = new WebSocket(`${process.env.NEXT_PUBLIC_API_URL_WS}/ws/${params.clipId}`);

        ws.onmessage = msg => {
            if (msg) {
                const [contentType, ...rest] = msg.data.split(':');
                const data = rest.join(':');

                update(data, contentType || "text/plain");
            }
        };

        setConn(ws);

        return () => {
            ws.close();
            setConn(null);
        };
    }, []);

    useEffect(() => {
        if (conn && conn.readyState === WebSocket.OPEN) {
            setLoading(true);
            conn.send(`${contents.contentType}:${contents.data}`);
        }
    }, [contents.data, contents.contentType]);

    const update = (data: string, type: string) => {
        setContents({
            data: data,
            contentType: type
        });
        setLoading(false);
    };

    const reset = () => {
        update("", "text/plain");
        //setMessages([]);
    };
    
    const copy = async () => {
        try {
            if (plainText) {
                await navigator.clipboard.writeText(contents.data);
            } else {
                const bytes = fromBinaryString(atob(contents.data));

                await navigator.clipboard.write([
                    new ClipboardItem({
                        [contents.contentType]: new Blob([bytes])
                    })
                ]);
            }

            /*setMessages(msgs => [
                { type: MessageType.INFO, text: "Contents Copied" },
                ...msgs
            ]);*/
        } catch {
            console.log("Copy failed");
            /*setMessages(msgs => [
                { type: MessageType.ERROR, text: "ERROR: Copy Failed" },
                ...msgs
            ]);*/
        }
    };

    const paste = (e: ClipboardEvent) => {
        if (!e.clipboardData) { return; }

        const items = e.clipboardData.items;
        if (items.length !== 1) { return; }
        const item = items[0];

        setLoading(true);

        switch (item.kind) {
            case "string":
                item.getAsString(data => {
                    update(data, "text/plain");
                });

                break;

            case "file":
                const file = item.getAsFile();
                if (!file) { break; }

                const reader = new FileReader();

                reader.onload = e => {
                    if (!e.target) { return; }

                    const bstr = e.target.result;
                    if (typeof bstr === "string") {
                        update(btoa(bstr), item.type);
                    }
                };

                reader.readAsBinaryString(file);

                break;

            default:
        }
    };

    useEffect(() => {
        const body = bodyRef.current;
        const input = inputRef.current;

        if (!body || !input) { return () => {}; }

        body.oncopy = copy;
        body.onpaste = paste;

        body.onkeydown = e => {
            if (e.key === "Escape") { reset(); }

            if (e.key === "Enter") {
                input.focus();
                e.preventDefault();
            }
        };

        return () => {
            body.oncopy = null;
            body.onpaste = null;
            body.onkeydown = null;
        };
    }, [conn, contents.data, contents.contentType]);

    const download = () => {
        const downloader = downloaderRef.current;
        if (!downloader || plainText) { return; }

        downloader.src = `data:application/octet-stream;base64,${contents.data}`;
    };

    return (
        <div className={ styles.content }>
            <div className={ styles.input }>
                <textarea
                    ref={ inputRef }
                    value={ contents.data }
                    onChange={ e => update(e.target.value, contents.contentType) }
                    disabled={ !plainText }
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
                        <ControlButton className={ styles.download } onClick={ download }>
                            <FaDownload />
                        </ControlButton>
                        <ControlButton className={ styles.upload }>
                            <FaUpload />
                        </ControlButton>
                    </div>

                    { loading && <ClipLoader className={ styles.loading } /> }
                </div>
                <iframe ref={ downloaderRef } style={{ display: "none" }}></iframe>
                {/*<MessageBox messages={ messages } />*/}
            </div>
            <div className={ styles.preview } >
                <Preview contents={ contents } />
            </div>
        </div>
    );
}
