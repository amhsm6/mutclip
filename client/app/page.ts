import { redirect } from "next/navigation";

export default async function Page(): Promise<never> {
    const resp = await fetch(process.env.NODE_ENV === "production" ? `${process.env.NEXT_PUBLIC_URL}/api/newclip` : `${process.env.NEXT_PUBLIC_API_URL}/newclip`, { cache: "no-store" });
    const chatId: number = await resp.json();
    redirect(`/${chatId}`);
}
