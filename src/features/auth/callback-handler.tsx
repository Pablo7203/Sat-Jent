"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export function safeAuthNext(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/app";
}

export function AuthCallbackHandler() {
  const router = useRouter();
  const started = useRef(false);
  const [message, setMessage] = useState("Completing your secure sign-in…");

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function completeAuthentication() {
      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const code = query.get("code");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const next = safeAuthNext(query.get("next"));

      window.history.replaceState(null, "", window.location.pathname);

      const supabase = createClient();
      const result =
        accessToken && refreshToken
          ? await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
          : code
            ? await supabase.auth.exchangeCodeForSession(code)
            : { error: new Error("The authentication link is incomplete.") };

      if (result.error) {
        setMessage(
          "This invitation or recovery link is invalid or has expired.",
        );
        router.replace("/login?error=callback");
        return;
      }

      router.replace(next);
      router.refresh();
    }

    void completeAuthentication();
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center px-5">
      <Card className="w-full max-w-md text-center">
        <h1 className="text-2xl font-bold">Completing sign in</h1>
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          {message}
        </p>
      </Card>
    </main>
  );
}
