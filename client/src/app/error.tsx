"use client";

import React from "react";

type Props = { error: Error };

export default function Error({ error }: Props) {
    return (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 15 }}>
            <h1>{error.message}</h1>
        </div>
    );
}
