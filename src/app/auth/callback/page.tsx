import type { Metadata } from "next";
import { AuthCallbackHandler } from "@/features/auth/callback-handler";

export const metadata: Metadata = { title: "Completing sign in" };

export default function AuthCallbackPage() {
  return <AuthCallbackHandler />;
}
