import React from "react";
import { BodyRefProvider } from "@/contexts/BodyRefContext";
import { MessageQueueProvider } from "@/contexts/MessageQueueContext";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "mutclip",
    description: "Mutual Clipboard"
};

export default function RootLayout({ children }: React.PropsWithChildren) {
    return (
        <html lang="en">
            <BodyRefProvider>
                <MessageQueueProvider>
                    { children }
                </MessageQueueProvider>
            </BodyRefProvider>
        </html>
    );
}
