export type Contents = {
    data: string,
    contentType: string
};

export type Message = {
    type: MessageType,
    text: string
};

export enum MessageType {
    INFO,
    ERROR
};
