"use server";

import { redirect } from "next/navigation";

// FIXME: should throw error here and catch on the client if it is possible
export async function newclip() {
    const resp = await fetch(process.env.NODE_ENV === "production" ? `${process.env.NEXT_PUBLIC_URL}/api/newclip` : `${process.env.NEXT_PUBLIC_API_URL}/newclip`, { cache: "no-store" });
    if (!resp.ok) {
        throw new Error(await resp.text());
    }

    const clipId = await resp.text();
    redirect(`/${clipId}`);
}

export async function connect(input: string) {
    const id = input.slice(0, 3) + "-" + input.slice(3, 6) + "-" + input.slice(6, 9);

    const resp = await fetch(process.env.NODE_ENV === "production" ? `${process.env.NEXT_PUBLIC_URL}/api/check/${id}` : `${process.env.NEXT_PUBLIC_API_URL}/check/${id}`, { cache: "no-store" });

    if (resp.ok) {
        redirect(`/${id}`);
    }

    if (resp.status === 404) {
        return true;
    }

    throw new Error(await resp.text());
}
