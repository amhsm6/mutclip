"use server";

import { redirect } from "next/navigation";

export async function newclip() {
    const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/newclip`, { cache: "no-store" });
    if (!resp.ok) {
        throw new Error(await resp.text());
    }

    const clipId = await resp.text();
    redirect(`/${clipId}`);
}

export async function connect(input: string) {
    const id = input.slice(0, 2) + "-" + input.slice(2, 4) + "-" + input.slice(4, 6);
    const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/check/${id}`, { cache: "no-store" });

    if (resp.ok) {
        redirect(`/${id}`);
    }

    if (resp.status === 404) {
        return true;
    }

    throw new Error(await resp.text());
}
