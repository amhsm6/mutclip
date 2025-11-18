"use client"

import React, { createContext, useState, useEffect, useRef } from "react"

import type { EntryProps } from "../components/MessageEntry"

export interface Message {
    type: MessageType
    text: string
}

export enum MessageType {
    SUCCESS,
    INFO,
    ERROR
}

interface MessageQueue {
    entries: Entry[]
    pushMessage: (m: Message) => void
}

interface Entry {
    props: EntryProps
    id: number
}

const MessageQueueContext = createContext<MessageQueue>({ entries: [], pushMessage: () => { } })

export default MessageQueueContext

export function MessageQueueProvider({ children }: React.PropsWithChildren) {
    const [entries, setEntries] = useState<Entry[]>([])
    const newEntryId = useRef(0)
    const spawnDelay = useRef(0)

    useEffect(() => {
        const interval = setInterval(() => {
            if (spawnDelay.current) {
                spawnDelay.current -= 10
            }
        }, 10)

        return () => clearInterval(interval)
    }, [])

    const pushMessage = (message: Message) => {
        const delay = spawnDelay.current
        spawnDelay.current += 400

        setTimeout(() => {
            const id = newEntryId.current++

            setEntries(es => [
                { props: { message, animation: 0 }, id },
                ...es.map(({ props, ...e }) => ({ ...e, props: { ...props, animation: props.animation + 1 } }))
            ])

            setTimeout(() => {
                setEntries(es => es.map(e => e.id === id ? { ...e, props: { ...e.props, animation: -1 } } : e))
                setTimeout(() => setEntries(es => es.filter(e => e.id !== id)), 600)
            }, 1500)
        }, delay)
    }

    return (
        <MessageQueueContext.Provider value={{ entries, pushMessage }}>
            {children}
        </MessageQueueContext.Provider>
    )
}
