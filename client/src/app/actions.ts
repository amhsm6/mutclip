"use server";

export async function newclip() {
    const resp = await fetch(`http://${process.env.SERVER}:5000/newclip`, { cache: "no-store" });
    if (!resp.ok) {
        throw new Error(await resp.text());
    }

    return await resp.text();
}

export async function checkClip(id: string) {
    const resp = await fetch(`http://${process.env.SERVER}:5000/check/${id}`, { cache: "no-store" });

    if (resp.ok) {
        return true;
    }

    if (resp.status === 404) {
        return false;
    }

    throw new Error(await resp.text());
}
