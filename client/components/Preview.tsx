"use client";

import React from "react";
import type { Contents } from "@/types/clip";
import styles from "./Preview.module.css";

const previewTypes: string[] = ["image/gif", "image/png", "image/jpeg"];

type Props = { contents: Contents };

export default function Preview({ contents }: Props): React.ReactNode {
    if (contents.type === "text" || !previewTypes.includes(contents.contentType)) {
        return null;
    }

    const src = URL.createObjectURL(contents.data);
    return <img className={ styles.img } src={ src } />;
}
