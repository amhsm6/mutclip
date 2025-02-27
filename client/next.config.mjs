import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    output: "standalone",
    experimental: {
        serverActions: {
            allowedOrigins: ["localhost", process.env.ORIGIN]
        }
    }
};

export default nextConfig;
