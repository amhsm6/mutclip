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

type Chunk = {
    index: number,
    data: Blob
};

const cut = (data: Blob): Chunk[] => {
    const chunkSize = 15 * 1024;
    const numChunks = Math.ceil(data.size / chunkSize);

    const chunks = [];
    for (let i = 0; i < numChunks; i++) {
        chunks.push({
            index: i,
            data: data.slice(i, i + chunkSize)
        });
    }

    return chunks;
};

type Props = {
    params: Promise<{ clipId: string }>
};

export default function Page({ params }: Props): React.ReactNode {
    const clipId = use(params).clipId;

    const socketRef = useRef<Socket | null>(null);

    const [contents, setContents] = useState<Contents & { incoming?: boolean }>({ type: "text", data: "" })
    const [renderedContents, setRenderedContents] = useState<string>("");

    const [starting, setStarting] = useState<boolean>(true);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);

    const { pushMessage } = useContext(MessageQueueContext);

    const bodyRef = useContext(BodyRefContext);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const uploaderRef = useRef<HTMLInputElement>(null);
    const downloaderRef = useRef<HTMLAnchorElement>(null);

    if (error) { throw error; }

    useEffect(() => {
        pushMessage({ type: MessageType.INFO, text: "Connecting to Server..." });

        const opts = { "auth": { "clip_id": clipId } };
        const socket = process.env.NODE_ENV === "production" ? io(opts) : io(process.env.NEXT_PUBLIC_API_URL, opts);

        socket.on("connect", () => {
            setStarting(false);
            pushMessage({ type: MessageType.SUCCESS, text: "Server Connected" });
        });

        socket.on("text", (data: string) => {
            setContents({ type: "text", data, incoming: true });
            setLoading(true);
        });

        socket.on("file", () => {
            alert("not implemented");
            setLoading(true);
        });

        socket.on("sync", () => {
            setLoading(false);
        });
        
        socket.on("noclipboard", () => {
            socket.disconnect();
            socketRef.current = null;

            setError(new Error("This clipboard does not exist"));
        });

        socket.on("error", () => {
            socket.disconnect();
            socketRef.current = null;

            setError(new Error("Internal Server Error"));
        });

        socketRef.current = socket;

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, []);

    useEffect(() => {
        const socket = socketRef.current;
        if (!socket || !socket.connected || contents.incoming) { return; }

        const timeout = setTimeout(() => {
            setLoading(true);

            if (contents.type === "text") {
                socket.emit("text", contents.data);
            } else {
                const chunks = cut(contents.data);

                socket.emit("file", { type: contents.contentType, name: contents.filename, numChunks: chunks.length });

                const send = (index: number) => {
                    console.log(`Sending ${index}`);
                    socket.emit("chunk", chunks[index], (ok: boolean | undefined) => {
                        if (ok) { send(index + 1); }
                    });
                }

                send(0);
            }
        }, 500);

        return () => clearTimeout(timeout);
    }, [contents.data]);

    // FIXME: unnecessary renders only to setLoading(false)
    useEffect(() => {
        if (contents.type === "text") {
            setRenderedContents(contents.data);
        } else {
            setRenderedContents(`${contents.filename}: ${contents.contentType}`);
        }

        setLoading(false);
    }, [contents.data, contents.incoming]);

    const reset = () => {
        setContents({ type: "text", data: "" });

        // TODO: implement clearing queue
    };

    const setText = (x: string) => {
        setContents({ type: "text", data: x });
    };

    const setFile = (file: File) => {
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
                type: "file",
                contentType: type,
                filename: file.name || "file", data: new Blob([res])
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
    }, []);

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
        if (!downloader || contents.type === "text") { return; }

        const name = contents.filename;

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
                        disabled={ contents.type === "file" || starting || !socketRef.current }
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
                {/*<Preview contents={ contents } />*/}
            </div>
        </div>
    );
}
