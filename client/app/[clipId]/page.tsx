"use client";

import React, { useState, useEffect, useContext, useRef } from "react";
import BodyRefContext from "@/contexts/BodyRefContext";
import ControlButton from "@/components/ControlButton";
import MessageBox from "@/components/MessageBox";
import Preview from "@/components/Preview";
import { Contents, Message, MessageType } from "@/types/clip";
import { FaRegTrashCan, FaDownload, FaUpload } from "react-icons/fa6";
import { FaRegCopy, FaPaste } from "react-icons/fa";
import ClipLoader from "react-spinners/ClipLoader";
import styles from "./page.module.css";

const serialize = (contents: Contents): string => {
    if (contents.filename) {
        return `${contents.contentType},${contents.filename}:${contents.data}`;
    } else {
        return `${contents.contentType}:${contents.data}`;
    }
};

const deserialize = (message: string): Contents => {
    const [header, ...rest] = message.split(':');

    const [contentType, filename] = header.split(',');
    const data = rest.join(':');

    return {
        data: data,
        contentType: contentType || "text/plain",
        filename: filename || null
    };
};

const toBinaryString = (buf: Uint8Array): string => buf.reduce((acc, x) => acc + String.fromCharCode(x), "");

const fromBinaryString = (bstr: string) => Uint8Array.from(bstr, x => x.charCodeAt(0));

type Props = {
    params: {
        clipId: number
    }
};

export default function Page({ params }: Props): React.ReactNode {
    const [conn, setConn] = useState<WebSocket | null>(null);

    const [contents, setContents] = useState<Contents & { incoming?: boolean }>({
        data: "",
        contentType: "text/plain",
        filename: null
    });
    const plainText = contents.contentType === "text/plain";

    const [loading, setLoading] = useState<boolean>(true);

    const [messages, setMessages] = useState<Message[]>([]);

    const bodyRef = useContext(BodyRefContext);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const uploaderRef = useRef<HTMLInputElement>(null);
    const downloaderRef = useRef<HTMLAnchorElement>(null);

    useEffect(() => {
        const ws = new WebSocket(`${process.env.NEXT_PUBLIC_API_URL_WS}/ws/${params.clipId}`);

        ws.onmessage = msg => {
            if (!msg || !msg.data || msg.data.length === 0) { return; }

            const control = msg.data[0];
            switch (control) {
                case 'A':
                    setLoading(true);
                    break;
                
                case 'M':
                    setContents({ ...deserialize(msg.data.slice(1)), incoming: true });
                    setLoading(false);
                    break;

                case 'Y':
                    setLoading(false);
                    break;
                
                default:
            }
        };

        setConn(ws);

        return () => {
            ws.close();
            setConn(null);
        };
    }, []);

    useEffect(() => {
        if (!conn || conn.readyState !== WebSocket.OPEN || contents.incoming) { return () => {}; }

        const timeout = setTimeout(() => {
            setLoading(true);
            conn.send(serialize(contents));
        }, 500);

        return () => clearTimeout(timeout);
    }, [contents.data, contents.contentType, contents.filename, contents.incoming]);

    const reset = () => {
        setContents({ data: "", contentType: "text/plain", filename: null });
        setMessages([]);
    };

    const putFile = (file: File) => {
        if (file.size > 10 * 1024 * 1024) { return; }

        setLoading(true);

        const reader = new FileReader();

        reader.onload = e => {
            if (!e.target) { return; }
            const res = e.target.result;
            if (!(res instanceof ArrayBuffer)) { return; }

            const buf = new Uint8Array(res);

            const data = btoa(toBinaryString(buf));
            const type = !file.type || file.type === "text/plain" ? "application/octet-stream" : file.type;

            setContents({ data: data, contentType: type, filename: file.name });
            setLoading(false);
        };

        reader.readAsArrayBuffer(file);
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

            setMessages(msgs => [
                { type: MessageType.INFO, text: "Contents Copied" },
                ...msgs
            ]);
        } catch (e) {
            console.log(e);
            setMessages(msgs => [
                { type: MessageType.ERROR, text: "ERROR: Copy Failed" },
                ...msgs
            ]);
        }
    };

    const paste = (e: ClipboardEvent) => {
        if (!e.clipboardData) { return; }

        const items = e.clipboardData.items;
        if (items.length !== 1) { return; }
        const item = items[0];

        switch (item.kind) {
            case "string":
                setLoading(true);

                item.getAsString(data => {
                    setContents({ data: data, contentType: "text/plain", filename: null });
                    setLoading(false);
                });

                break;

            case "file":
                const file = item.getAsFile();
                if (!file) { break; }

                putFile(file);

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
    }, [conn, contents.data, contents.contentType, contents.filename]);

    const initiateUpload = () => {
        const uploader = uploaderRef.current;
        if (!uploader) { return; }

        uploader.click();
    };

    const upload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length !== 1) { return; }
        const file = files[0];

        putFile(file);
    };

    const download = () => {
        const downloader = downloaderRef.current;
        if (!downloader || plainText) { return; }

        downloader.href = `data:application/octet-stream;base64,${contents.data}`;
        downloader.download = contents.filename || "file";
        downloader.click();
    };

    return (
        <div className={ styles.content }>
            <div className={ styles.input }>
                <textarea
                    ref={ inputRef }
                    value={ contents.data }
                    onChange={ e => setContents({ ...contents, data: e.target.value, incoming: false }) }
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
                        <ControlButton className={ styles.upload } onClick={ initiateUpload }>
                            <FaUpload />
                            <input
                                ref={ uploaderRef }
                                type="file"
                                onChange={ upload }
                                style={{ display: "none" }}
                            />
                        </ControlButton>
                        <ControlButton className={ styles.download } onClick={ download }>
                            <FaDownload />
                            <a ref={ downloaderRef } style={{ display: "none" }}></a>
                        </ControlButton>
                    </div>
                    { loading && <ClipLoader /> }
                </div>
                <div className={ styles["message-box"] }>
                    <MessageBox messages={ messages } />
                </div>
            </div>
            <div className={ styles.preview } >
                <Preview contents={ contents } />
            </div>
        </div>
    );
}
