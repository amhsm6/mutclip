"use client";

import React, { useRef } from "react";
import ControlButton from "@/components/ControlButton";
import { FaUpload } from "react-icons/fa6";
import styles from "./Uploader.module.css";

type Props = {
    setFile: (file: File) => void,
    disabled: boolean
};

export default function Uploader({ setFile, disabled }: Props) {
    const uploaderRef = useRef<HTMLInputElement>(null);

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

    return (
        <>
            <ControlButton className={ disabled ? styles.disabled : styles.upload } onClick={ initiateUpload } disabled={ disabled }>
                <FaUpload />
            </ControlButton>
            <input
                ref={ uploaderRef }
                type="file"
                onChange={ upload }
                style={{ display: "none" }}
            />
        </>
    );
}
