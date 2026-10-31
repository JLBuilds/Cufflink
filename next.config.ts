import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Phone photos are compressed client-side to ~1600px JPEG (≈300–600KB),
      // but a check can carry several (product shot + composition label).
      bodySizeLimit: "10mb",
    },
  },
  serverExternalPackages: ["sharp"],
  // File tracing misses sharp's native libvips library on Vercel (linux-x64),
  // which fails at runtime with "libvips-cpp.so … cannot open shared object".
  outputFileTracingIncludes: {
    "/**": ["./node_modules/@img/sharp-linux-x64/**/*", "./node_modules/@img/sharp-libvips-linux-x64/**/*"],
  },
};

export default nextConfig;
