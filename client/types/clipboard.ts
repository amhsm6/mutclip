export type Contents = { type: "text", data: string }
                     | { type: "file", contentType: string, filename: string, data: Blob, chunks: Chunk[] };

export type Chunk = {
    index: number,
    data: Blob
};

export type Message = {
    type: MessageType,
    text: string
};

export enum MessageType {
    SUCCESS,
    INFO,
    ERROR
};
