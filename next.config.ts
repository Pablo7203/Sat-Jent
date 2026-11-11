import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Keep uploads below Vercel's request cap with multipart overhead included.
    serverActions: { bodySizeLimit: "4.25mb" },
  },
  poweredByHeader: false,
  images: {
    // Local Supabase image URLs use loopback; staging uses the Supabase hostname.
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
    remotePatterns: [
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "56321",
        pathname: "/storage/v1/object/sign/product-images/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/sign/product-images/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
