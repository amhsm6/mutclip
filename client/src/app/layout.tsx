import React from "react"
import type { Metadata } from "next"

import { BodyRefProvider } from "@/contexts/BodyRefContext"
import "./globals.css"

export const metadata: Metadata = {
    title: "Mutual Clipboard",
    description: "Mutual Clipboard"
}

export default function RootLayout({ children }: React.PropsWithChildren) {
    return (
        <html lang="en">
            <BodyRefProvider>
                {children}
            </BodyRefProvider>
        </html>
    )
}
