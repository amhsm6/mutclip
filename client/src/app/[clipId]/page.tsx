import { checkClip } from "../actions";
import { SocketProvider } from "./contexts/SocketContext";
import { MessageQueueProvider } from "./contexts/MessageQueueContext";
import Clipboard from "./components/Clipboard";

type Props = {
    params: Promise<{ clipId: string }>
};

export default async function Page({ params }: Props) {
    const clipId = (await params).clipId;
    const ok = await checkClip(clipId);

    if (!ok) { throw new Error("Invalid Clipboard ID"); }

    return (
        <MessageQueueProvider>
            <SocketProvider clipId={clipId}>
                <Clipboard clipId={clipId} />
            </SocketProvider>
        </MessageQueueProvider>
    );
}
