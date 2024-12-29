/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    output: "standalone",
    experimental: {
        serverActions: {
            allowedOrigins: ["44.202.27.25"]
        }
    }
};

export default nextConfig;
