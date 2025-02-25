import { Chunk } from "@/pb/clip";

export type Contents = { type: "text", data: string }
                     | { type: "file", contentType: string, filename: string, data: Blob, chunks: Chunk[] };

export type Message = {
    type: MessageType,
    text: string
};

export enum MessageType {
    SUCCESS,
    INFO,
    ERROR
};
