import { PackageOpen } from "lucide-react";
type EmptyStateProps = { description: string; title: string };
export function EmptyState({ description, title }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed bg-surface p-8 text-center">
      <PackageOpen
        aria-hidden="true"
        className="mx-auto text-muted-foreground"
        size={32}
      />
      <h2 className="mt-4 font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
