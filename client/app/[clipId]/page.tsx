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

const encode = (contents: Contents): Blob => {
    return new Blob([
        contents.contentType,
        "<",
        contents.filename || "",
        ">",
        contents.data
    ]);
};

const decode = async (buf: Blob): Promise<Contents> => {
    const text = await buf.text();

    const [type, ...rest] = text.split('<');
    const [name] = rest.join().split('>');
    const databegin = type.length + 1 + name.length + 1;

    return {
        data: buf.slice(databegin),
        contentType: type || "text/plain",
        filename: name || null
    };
};

const toBinaryString = (buf: Uint8Array): string => buf.reduce((acc, x) => acc + String.fromCharCode(x), "");

type Props = {
    params: {
        clipId: number
    }
};

export default function Page({ params }: Props): React.ReactNode {
    const [conn, setConn] = useState<WebSocket | null>(null);

    const [contents, setContents] = useState<Contents & { incoming?: boolean }>({
        data: new Blob(),
        contentType: "text/plain",
        filename: null
    });
    const plainText = contents.contentType === "text/plain";

    const [renderedContents, setRenderedContents] = useState<string>("");

    const [loading, setLoading] = useState<boolean>(true);

    // const [messages, setMessages] = useState<Message[]>([]);

    const bodyRef = useContext(BodyRefContext);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const uploaderRef = useRef<HTMLInputElement>(null);
    const downloaderRef = useRef<HTMLAnchorElement>(null);

    useEffect(() => {
        const ws = new WebSocket(`/api/ws/${params.clipId}`);

        ws.onmessage = async (msg: MessageEvent<Blob | string>) => {
            const buf = msg.data;

            if (typeof buf === "string") {
                switch (buf) {
                    case 'A':
                        setLoading(true)
                        break;
                    
                    case 'S':
                        setLoading(false)
                        break;
                    
                    default:
                }
            } else {
                const decoded = await decode(buf);
                setContents({ ...decoded, incoming: true });
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
            conn.send(encode(contents));
        }, 500);

        return () => clearTimeout(timeout);
    }, [contents.data, contents.contentType, contents.filename, contents.incoming]);

    useEffect(() => {
        if (plainText) {
            contents.data.text()
                .then(setRenderedContents)
                .then(() => setLoading(false));
        } else {
            contents.data.arrayBuffer()
                .then(buf => new Uint8Array(buf))
                .then(toBinaryString)
                .then(btoa)
                .then(setRenderedContents)
                .then(() => setLoading(false));
        }
    }, [contents.data, contents.contentType, contents.filename]);

    const reset = () => {
        setContents({ data: new Blob(), contentType: "text/plain", filename: null });
        // setMessages([]);
    };

    const setText = (x: string) => {
        setContents({
            data: new Blob([x]),
            contentType: "text/plain",
            filename: null
        });
    };

    const setFile = (file: File) => {
        if (file.size > 10 * 1024 * 1024) { return; }

        setLoading(true);

        const reader = new FileReader();

        reader.onload = e => {
            if (!e.target) { return; }
            const res = e.target.result;
            if (!(res instanceof ArrayBuffer)) { return; }

            const type = !file.type || file.type === "text/plain" ? "application/octet-stream" : file.type;

            setContents({
                data: new Blob([res]),
                contentType: type,
                filename: file.name
            });
        };

        reader.readAsArrayBuffer(file);
    };
    
    const copy = async () => {
        try {
            if (plainText) {
                await contents.data.text()
                    .then(navigator.clipboard.writeText);
            } else {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        [contents.contentType]: contents.data
                    })
                ]);
            }

            // setMessages(msgs => [
            //     { type: MessageType.INFO, text: "Contents Copied" },
            //     ...msgs
            // ]);
        } catch (e) {
            console.log(e);
            // setMessages(msgs => [
            //     { type: MessageType.ERROR, text: "ERROR: Copy Failed" },
            //     ...msgs
            // ]);
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

        setFile(file);
    };

    const download = () => {
        const downloader = downloaderRef.current;
        if (!downloader || plainText) { return; }

        downloader.href = URL.createObjectURL(contents.data);
        downloader.download = contents.filename || "file";
        downloader.click();
    };

    return (
        <div className={ styles.content }>
            <div className={ styles.input }>
                <textarea
                    ref={ inputRef }
                    value={ renderedContents }
                    onChange={ e => setText(e.target.value) }
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
                    {/* <MessageBox messages={ messages } /> */}
                </div>
            </div>
            <div className={ styles.preview } >
                <Preview contents={ contents } />
            </div>
        </div>
    );
}
