"use client";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center px-5">
      <div className="max-w-md text-center">
        <p className="font-semibold text-destructive">Something went wrong</p>
        <h1 className="mt-2 text-3xl font-bold">
          We could not load this page.
        </h1>
        <p className="mt-3 text-muted-foreground">
          Please try again. If the problem continues, contact the system
          administrator.
        </p>
        <Button className="mt-6" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
