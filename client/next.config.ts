import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "standalone",
    env: {
        SERVER: process.env.SERVER
    },
    experimental: {
        serverActions: {
            allowedOrigins: process.env.ORIGINS?.split(" ")
        }
    },
    async rewrites() {
        if (process.env.NODE_ENV === "development") {
            return [
                {
                    source: "/ws/:path*",
                    destination: `http://${process.env.SERVER}:5000/ws/:path*`
                }
            ];
        }

        return [];
    }
};

export default nextConfig;
