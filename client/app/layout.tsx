import React from "react";
import { BodyRefProvider } from "@/contexts/BodyRefContext";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "mutclip",
    description: "Mutual Clipboard"
};

type Props = { children: React.ReactNode };

export default function RootLayout({ children }: Props): React.ReactNode {
    return (
        <html lang="en">
            <BodyRefProvider>{ children }</BodyRefProvider>
        </html>
    );
}
