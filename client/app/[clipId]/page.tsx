"use client";

import React, { use, useState, useEffect, useContext, useRef } from "react";
import BodyRefContext from "@/contexts/BodyRefContext";
import MessageQueueContext from "@/contexts/MessageQueueContext";
import ControlButton from "@/components/ControlButton";
import MessageBox from "@/components/MessageBox";
import Preview from "@/components/Preview";
import { Contents, MessageType } from "@/types/clip";
import { FaRegTrashCan, FaDownload, FaUpload } from "react-icons/fa6";
import { io, Socket } from "socket.io-client";
import ClipboardJS from "clipboard";
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

    const connRef = useRef<Socket | null>(null);
    const clipboardRef = useRef<ClipboardJS | null>(null);

    const [contents, setContents] = useState<Contents & { incoming?: boolean }>({
        data: new Blob(),
        contentType: "text/plain",
        filename: null
    });
    const plainText = contents.contentType === "text/plain";

    const [renderedContents, setRenderedContents] = useState<string>("");

    const [starting, setStarting] = useState<boolean>(true);
    const [loading, setLoading] = useState<boolean>(false);

    const { pushMessage } = useContext(MessageQueueContext);

    const bodyRef = useContext(BodyRefContext);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const uploaderRef = useRef<HTMLInputElement>(null);
    const downloaderRef = useRef<HTMLAnchorElement>(null);

    useEffect(() => {
        pushMessage({ type: MessageType.INFO, text: "Connecting to Server..." });

        const opts = { "auth": { "clip_id": clipId } };
        const socket = process.env.NODE_ENV === "production" ? io(opts) : io(process.env.NEXT_PUBLIC_API_URL, opts);

        socket.on("connect", () => {
            setStarting(false);
            pushMessage({ type: MessageType.SUCCESS, text: "Server Connected" });
        });

        socket.on("tx", () => {
            setLoading(true);
        });

        socket.on("sync", () => {
            setLoading(false);
        });

        socket.on("message", async (data: string) => {
            const decoded = await decode(new Blob([data]));
            setContents({ ...decoded, incoming: true });
        });
        
        socket.on("noclipboard", () => {
            pushMessage({ type: MessageType.ERROR, text: "This clipboard does not exist" });
            socket.disconnect();
            connRef.current = null;
            // TODO: Do something if the clipboard does not exist
            // FIXME: 'Server connected' message shows up after
        });

        socket.on("error", () => {
            pushMessage({ type: MessageType.ERROR, text: "Internal Server Error" });
            socket.disconnect();
            connRef.current = null;
        });

        connRef.current = socket;

        return () => {
            socket.disconnect();
            connRef.current = null;
        };
    }, []);

    useEffect(() => {
        const conn = connRef.current;

        if (!conn || !conn.connected || contents.incoming) { return; }

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
            setRenderedContents(`${contents.filename || "file"}: ${contents.contentType}`);
            setLoading(false);
        }
    }, [contents.data, contents.contentType, contents.filename]);

    const reset = () => {
        setContents({ data: new Blob(), contentType: "text/plain", filename: null });

        // TODO: implement clearing queue
    };

    const setText = (x: string) => {
        setContents({
            data: new Blob([x]),
            contentType: "text/plain",
            filename: null
        });
    };

    const setFile = (file: File) => {
        console.log("set file", file);
        if (file.size > 50 * 1024 * 1024) {
            pushMessage({ type: MessageType.ERROR, text: "Maximum file size is 50 MB" });
            return;
        }

        pushMessage({ type: MessageType.INFO, text: `Uploading ${file.name}` });
        setLoading(true);

        const reader = new FileReader();

        reader.onload = e => {
            const res = e.target?.result;
            if (!res || !(res instanceof ArrayBuffer)) { return; }

            const type = !file.type || file.type === "text/plain" ? "application/octet-stream" : file.type;

            setContents({
                data: new Blob([res]),
                contentType: type,
                filename: file.name
            });
        };

        reader.readAsArrayBuffer(file);
    };

    const copy = () => {
        if (!inputRef.current) { return; }
        ClipboardJS.copy(inputRef.current);
        // FIXME: clipboard a bit wanky
    };

    const paste = (e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items || items.length !== 1) { return; }
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
    }, [contents.data, contents.contentType, contents.filename]);

    const initiateUpload = () => uploaderRef.current?.click();

    const upload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length !== 1) { return; }
        const file = files[0];

        setFile(file);

        if (uploaderRef.current) {
            uploaderRef.current.value = "";
        } 
    };

    const download = () => {
        const downloader = downloaderRef.current;
        if (!downloader || plainText) { return; }

        const name = contents.filename || "file";

        pushMessage({ type: MessageType.INFO, text: `Downloading ${name}` });

        downloader.href = URL.createObjectURL(contents.data);
        downloader.download = name;
        downloader.click();
    };

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
                        disabled={ !plainText || starting || !connRef.current }
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
                            </ControlButton>
                            <ControlButton className={ styles.download } onClick={ download }>
                                <FaDownload />
                            </ControlButton>
                        </div>
                        { (loading || starting) && <ClipLoader /> }
                    </div>

                    <input
                        ref={ uploaderRef }
                        type="file"
                        onChange={ upload }
                        style={{ display: "none" }}
                    />
                    <a ref={ downloaderRef } style={{ display: "none" }}></a>
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
