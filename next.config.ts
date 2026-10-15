import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // proxy.ts бүх /api замыг хамардаг тул request body-г санах ойд буфер хийдэг.
    // Анхдагч 10MB хязгаар нь 50MB хүртэлх файл оруулалтыг тасалдаг байсан.
    proxyClientMaxBodySize: "55mb",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
