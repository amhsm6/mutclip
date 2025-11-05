"use client";

import React from "react";

type Props = { error: Error & { digest?: string } };

export default function Error({ error }: Props) {
    let message = error.message;
    if (error.digest) {
        message = "Internal Server Error";
    }

    return (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 15 }}>
            <h1>{message}</h1>
        </div>
    );
}
