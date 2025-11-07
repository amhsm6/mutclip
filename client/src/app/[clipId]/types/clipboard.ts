import type { Chunk } from "@/pb/clip"

interface TextContents {
    type: "text"
    data: string
}

interface FileContents {
    type: "file"
    contentType: string
    filename: string
    data: Blob
    chunks: Chunk[]
}

export type Contents = TextContents | FileContents
