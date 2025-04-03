"use client";

import ControlButton from "@/components/ControlButton";
import BodyRefContext from "@/contexts/BodyRefContext";
import { useContext, useEffect, useTransition } from "react";
import { ClipLoader } from "react-spinners";
import { clipRedirect } from "./actions";
import IdentifierInput from "./components/IdentifierInput";
import styles from "./page.module.css";

export default function Page() {
    const bodyRef = useContext(BodyRefContext);

    const [isPending, startTransition] = useTransition();

    const generateNew = () => {
        startTransition(async () => {
            await clipRedirect(undefined);
        });
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
            <div className={styles.generate}>
                <ControlButton onClick={generateNew}>Generate New</ControlButton>
            </div>
            <IdentifierInput startTransition={startTransition} />

            {isPending &&
                <div className={styles.loader}>
                    <ClipLoader />
                </div>
            }
        </div>
    );
}
