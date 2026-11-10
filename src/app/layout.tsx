import type { Metadata } from "next";
import "./globals.css";
import { DM_Serif_Display, Geist, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { resolveSiteUrl } from "@/lib/env/site-url";
import { BasketProvider } from "@/components/public/cart-provider";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  variable: "--font-dm-serif",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: resolveSiteUrl(),
  title: { default: "SAT-J Ent", template: "%s | SAT-J Ent" },
  description:
    "Doors, tiles, sanitary ware and building materials from SAT-J Ent.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full antialiased",
        "font-sans",
        geist.variable,
        geistMono.variable,
        dmSerif.variable,
      )}
    >
      <body className="flex min-h-full flex-col">
        <BasketProvider>{children}</BasketProvider>
      </body>
    </html>
  );
}
