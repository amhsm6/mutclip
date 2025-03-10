import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    reactStrictMode: false,
    env: {
        SERVER: process.env.SERVER
    },
    experimental: {
        serverActions: {
            allowedOrigins: process.env.ORIGINS?.split(" ")
        }
    }
};

export default nextConfig;
