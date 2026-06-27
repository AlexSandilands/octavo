import type { NextConfig } from "next";

const r2 = process.env.R2_PUBLIC_URL;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: r2
      ? [{ protocol: "https", hostname: new URL(r2).hostname }]
      : [],
  },
};

export default nextConfig;
