"use client";

import React, { createContext, createRef, useRef } from "react";

type BodyRef = React.MutableRefObject<HTMLBodyElement | null>;

const BodyRefContext = createContext<BodyRef>(createRef());

export default BodyRefContext;

type Props = { children: React.ReactNode };

export function BodyRefProvider({ children }: Props): React.ReactNode {
    const ref = useRef(null);

    return (
        <body ref={ ref }>
            <BodyRefContext.Provider value={ ref }>{ children }</BodyRefContext.Provider>
        </body>
    );
}
