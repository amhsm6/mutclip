import { Suspense } from "react"
import { checkClip } from "../actions"
import { SocketProvider } from "./contexts/SocketContext"
import { MessageQueueProvider } from "./contexts/MessageQueueContext"
import Clipboard from "./components/Clipboard"
import Loading from "./components/Loading"
import { notFound } from "next/navigation"

interface Props {
    params: Promise<{ clipId: string }>
}

export default async function Page({ params }: Props) {
    const clipId = (await params).clipId

    const ok = await checkClip(clipId)
    if (!ok) { notFound() }

    return (
        <Suspense fallback={<Loading />}>
            <MessageQueueProvider>
                <SocketProvider clipId={clipId}>
                    <Clipboard clipId={clipId} />
                </SocketProvider>
            </MessageQueueProvider>
        </Suspense>
    )
}
