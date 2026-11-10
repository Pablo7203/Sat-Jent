"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function BackButton({
  fallbackHref = "/app/dashboard",
}: {
  fallbackHref?: string;
}) {
  const router = useRouter();
  return (
    <button
      className="mb-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
      type="button"
    >
      <ArrowLeft aria-hidden="true" size={17} />
      Back
    </button>
  );
}
