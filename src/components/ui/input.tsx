import type { InputHTMLAttributes } from "react";
export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`min-h-11 w-full rounded-lg border bg-surface px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground hover:border-muted disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}
