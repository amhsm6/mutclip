import { Chunk } from "@/pb/clip";

export type Contents = { type: "text", data: string }
    | { type: "file", contentType: string, filename: string, data: Blob, chunks: Chunk[] };
