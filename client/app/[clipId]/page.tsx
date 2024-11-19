"use client";

import React, { use, useState, useEffect, useContext, useRef } from "react";
import BodyRefContext from "@/contexts/BodyRefContext";
import ControlButton from "@/components/ControlButton";
import MessageBox from "@/components/MessageBox";
import Preview from "@/components/Preview";
import { Contents, Message, MessageType } from "@/types/clip";
import { FaRegTrashCan, FaDownload, FaUpload } from "react-icons/fa6";
import { io, Socket } from "socket.io-client"
import { FaRegCopy } from "react-icons/fa";
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
    params: Promise<{ clipId: string }>
};

export default function Page({ params }: Props): React.ReactNode {
    const clipId = use(params).clipId;

    const [conn, setConn] = useState<Socket | null>(null);

    const [contents, setContents] = useState<Contents & { incoming?: boolean }>({
        data: new Blob(),
        contentType: "text/plain",
        filename: null
    });
    const plainText = contents.contentType === "text/plain";

    const [renderedContents, setRenderedContents] = useState<string>("");

    const [starting, setStarting] = useState<boolean>(true);
    const [loading, setLoading] = useState<boolean>(false);

    const [message, setMessage] = useState<Message | null>(null);

    const bodyRef = useContext(BodyRefContext);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const uploaderRef = useRef<HTMLInputElement>(null);
    const downloaderRef = useRef<HTMLAnchorElement>(null);

    useEffect(() => {
        setMessage({ type: MessageType.INFO, text: "Connecting to Server..." });

        const opts = { "auth": { "clip_id": clipId } };
        const socket = process.env.NODE_ENV === "production" ? io(opts) : io(process.env.NEXT_PUBLIC_API_URL, opts);

        socket.on("connect", () => {
            setStarting(false);
            setMessage({ type: MessageType.SUCCESS, text: "Server Connected" });
        });

        socket.on("tx", () => {
            setLoading(true);
        });

        socket.on("syn", () => {
            setLoading(false);
        });

        socket.on("message", async (data: string) => {
            const decoded = await decode(new Blob([data]));
            setContents({ ...decoded, incoming: true });
        });
        
        socket.on("noclipboard", () => {
            setMessage({ type: MessageType.ERROR, text: "This clipboard does not exist" });
            socket.disconnect();
            setConn(null);
        });

        setConn(socket);

        return () => {
            socket.disconnect();
            setConn(null);
        };
    }, []);

    useEffect(() => {
        if (!conn || !conn.connected || contents.incoming) { return () => {}; }

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
        setMessage(null);
    };

    const setText = (x: string) => {
        setContents({
            data: new Blob([x]),
            contentType: "text/plain",
            filename: null
        });
    };

    const setFile = (file: File) => {
        if (file.size > 10 * 1024 * 1024) {
            setMessage({ type: MessageType.ERROR, text: "Maximum file size is 10 MB" });
            return;
        }

        setMessage({ type: MessageType.INFO, text: `Uploading ${file.name}` });
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
            await navigator.clipboard.write([
                new ClipboardItem({
                    [contents.contentType]: contents.data
                })
            ]);

            setMessage({ type: MessageType.INFO, text: "Contents Copied" });
        } catch (e) {
            setMessage({ type: MessageType.ERROR, text: "Copy Failed" });
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

        const name = contents.filename || "file";

        setMessage({ type: MessageType.INFO, text: `Downloading ${name}` });

        downloader.href = URL.createObjectURL(contents.data);
        downloader.download = name;
        downloader.click();
    };

    return (
        <div className={ styles.content }>
            <div className={ styles.main }>
                <div className={ styles.input }>
                    <textarea
                        ref={ inputRef }
                        value={ renderedContents }
                        onChange={ e => setText(e.target.value) }
                        disabled={ !plainText || starting }
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
                        { (loading || starting) && <ClipLoader /> }
                    </div>
                </div>
                <div className={ styles["message-box"] }>
                    <MessageBox message={ message } />
                </div>
            </div>
            <div className={ styles.preview } >
                <Preview contents={ contents } />
            </div>
        </div>
    );
}
