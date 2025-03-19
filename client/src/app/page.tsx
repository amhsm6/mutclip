"use client";

import React, { useContext, useEffect, useState } from "react";
import { newclip } from "./actions";
import ControlButton from "@/components/ControlButton";
import IdentifierInput from "./components/IdentifierInput";
import { useRouter } from "next/navigation";
import { ClipLoader } from "react-spinners";
import styles from "./page.module.css";
import BodyRefContext from "@/contexts/BodyRefContext";

export default function Page() {
    const router = useRouter();

    const bodyRef = useContext(BodyRefContext);

    const [load, setLoad] = useState<boolean>(false);

    const [error, setError] = useState<Error | null>(null);
    if (error) { throw error; }

    const generateNew = async () => {
        try {
            setLoad(true);
            const id = await newclip();
            router.push(`/${id}`);
        } catch (e) {
            setError(new Error("Internal server Error"));
        }
    };

    useEffect(() => {
        const body = bodyRef.current;
        if (!body) { return; }

        body.onkeydown = e => {
            if (e.key === "Enter") { generateNew(); }
        };

        return () => {
            body.onkeydown = null;
        };
    }, []);

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
