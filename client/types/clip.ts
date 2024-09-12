export type Contents = {
    data: string,
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
