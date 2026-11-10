import type { HTMLAttributes } from "react";
export function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[14px] border border-border bg-surface p-5 shadow-[0_1px_2px_rgb(0_0_0_/_0.15)] sm:p-6 ${className}`}
      {...props}
    />
  );
}
