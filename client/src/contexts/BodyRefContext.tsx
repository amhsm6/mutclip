"use client";

import React, { createContext, createRef, useRef } from "react";

type BodyRef = React.RefObject<HTMLBodyElement | null>;

const BodyRefContext = createContext<BodyRef>(createRef());

export default BodyRefContext;

export function BodyRefProvider({ children }: React.PropsWithChildren) {
    const ref = useRef(null);

    return (
        <body ref={ref}>
            <BodyRefContext.Provider value={ref}>{children}</BodyRefContext.Provider>
        </body>
    );
}
