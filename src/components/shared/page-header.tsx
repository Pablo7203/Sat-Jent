import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BackButton } from "@/components/shared/back-button";

type PageHeaderProps = {
  backHref?: string;
  description?: string;
  title: string;
};
export function PageHeader({ backHref, description, title }: PageHeaderProps) {
  return (
    <header>
      {backHref ? (
        <Link
          className="mb-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          href={backHref}
        >
          <ArrowLeft aria-hidden="true" size={17} />
          Back
        </Link>
      ) : (
        <BackButton />
      )}
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      {description ? (
        <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
      ) : null}
    </header>
  );
}
