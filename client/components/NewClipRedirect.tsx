import { redirect } from "next/navigation";

export default async function NewClipRedirect(): Promise<never> {
    const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/newclip`, { cache: "no-store" });
    const chatId: number = await resp.json();
    redirect(`/${chatId}`);
}
