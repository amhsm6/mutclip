export type Contents = {
    data: Blob,
    contentType: string,
    filename: string | null
};

export type Message = {
    type: MessageType,
    text: string
};

export enum MessageType {
    INFO,
    ERROR
};
