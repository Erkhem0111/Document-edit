import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // proxy.ts бүх /api замыг хамардаг тул request body-г санах ойд буфер хийдэг.
    // 4MB-аас том файлыг browser шууд R2 руу илгээдэг (upload-client.ts), Vercel ч
    // 4.5MB-аас томыг хүлээж авдаггүй — тиймээс сервер рүү үүнээс том бие ирэх
    // шалтгаангүй. Хязгаарыг бага байлгаснаар хүсэлт бүр санах ой дүүргэхгүй.
    proxyClientMaxBodySize: "6mb",
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
