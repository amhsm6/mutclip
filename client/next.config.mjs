/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    output: "standalone",
    experimental: {
        serverActions: {
            allowedOrigins: ["34.227.150.51"]
        }
    }
};

export default nextConfig;
