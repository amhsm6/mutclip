"use client";

import React, { useState } from "react";
import { newclip } from "./actions";
import ControlButton from "@/components/ControlButton";
import IdentifierInput from "./components/IdentifierInput";
import { useRouter } from "next/navigation";
import { ClipLoader } from "react-spinners";
import styles from "./page.module.css";

export default function Page() {
    const router = useRouter();

    const [load, setLoad] = useState<boolean>(false);

    const [error, setError] = useState<Error | null>(null);
    if (error) { throw error; }

    const generateNew = async () => {
        try {
            setLoad(true);
            const id = await newclip();
            router.push(`/${id}`);
        } catch (e) {
            setError(e as Error);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.generate} >
                <ControlButton onClick={generateNew}>Generate New</ControlButton>
            </div>
            <IdentifierInput setLoad={setLoad} />

            {load &&
                <div className={styles.loader}>
                    <ClipLoader />
                </div>
            }
        </div>
    );
}
