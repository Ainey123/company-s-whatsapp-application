/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Prevents double-mounting WebRTC streams in dev
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
