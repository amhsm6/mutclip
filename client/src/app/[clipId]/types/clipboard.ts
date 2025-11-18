interface TextContents {
    type: "text"
    data: string
}

interface FileContents {
    type: "file"
    contentType: string
    filename: string
    data: Blob
}

export type Contents = TextContents | FileContents
