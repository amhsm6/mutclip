import React, { Suspense } from "react";
import NewClipRedirect from "@/components/NewClipRedirect";
import IndexLoader from "@/components/IndexLoader";

export default function Page(): React.ReactNode {
    return (
        <Suspense fallback={ <IndexLoader /> }>
            <NewClipRedirect />
        </Suspense>
    );
}
