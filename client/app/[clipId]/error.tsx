"use client";

import React from "react";

type Props = { error: Error };

export default function Error({ error }: Props) {
    return (
        <div>
            <h1>{ error.message }</h1>
        </div>
    );
}
