import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/env/site-url";
import { isPublicWebsiteEnabled } from "@/lib/public-site-switch";
export default function robots(): MetadataRoute.Robots {
  if (!isPublicWebsiteEnabled()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  if (process.env.NEXT_PUBLIC_APP_ENV !== "production") {
    return { rules: { userAgent: "*", disallow: ["/", "/app/"] } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/app/",
        "/login",
        "/forgot-password",
        "/reset-password",
        "/access-denied",
      ],
    },
    sitemap: publicSiteUrl("/sitemap.xml"),
  };
}
