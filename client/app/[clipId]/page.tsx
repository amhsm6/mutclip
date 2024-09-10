"use client";

import React, { useState, useEffect, useContext, useRef } from "react";
import BodyRefContext from "@/contexts/BodyRefContext";
import Preview from "@/components/Preview";
import type { Contents } from "@/types/clip";
import { FaRegTrashCan } from "react-icons/fa6";
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

    const bodyRef = useContext(BodyRefContext);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const ws = new WebSocket(`${process.env.NEXT_PUBLIC_API_URL_WS}/ws/${params.clipId}`);

        ws.onmessage = msg => {
            if (msg) {
                const [contentType, ...rest] = msg.data.split(':');
                const data = rest.join(':');

                setContents({
                    data: data,
                    contentType: contentType || "text/plain"
                });
                setLoading(false);
            }
        };

        setConn(ws);

        return () => {
            ws.close();
            setConn(null);
        };
    }, []);

    const update = (data: string, type: string) => {
        if (conn) {
            conn.send(type + ":" + data);
        }
    };

    const reset = () => update("", "text/plain");
    
    const copy = async () => {
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
    };

    const paste = (e: ClipboardEvent) => {
        if (!e.clipboardData) { return; }

        const items = e.clipboardData.items;
        if (items.length !== 1) { return; }
        const item = items[0];

        switch (item.kind) {
            case "string":
                item.getAsString(data => {
                    setLoading(true);
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
                        setLoading(true);
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
                    <div>
                        <button className={ styles.reset } onClick={ reset }><FaRegTrashCan /></button>
                        <button className={ styles.copy } onClick={ copy }><FaRegCopy /></button>
                    </div>

                    { loading && <ClipLoader className={ styles.loading } /> }
                </div>
            </div>

            <div className={ styles.preview }>
                <Preview contents={ contents } />
            </div>
        </div>
    );
}
