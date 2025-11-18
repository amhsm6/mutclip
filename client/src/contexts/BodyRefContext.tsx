"use client"

import React, { createContext, createRef, useRef } from "react"

const BodyRefContext = createContext(createRef<HTMLBodyElement>())

export default BodyRefContext

export function BodyRefProvider({ children }: React.PropsWithChildren) {
    const ref = useRef(null)

    return (
        <body ref={ref}>
            <BodyRefContext.Provider value={ref}>{children}</BodyRefContext.Provider>
        </body>
    )
}
