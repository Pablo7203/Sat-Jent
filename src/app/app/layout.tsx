import type { ReactNode } from "react";
import { AppNavigation } from "@/components/layout/app-navigation";
import { requireActiveProfile } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export default async function InternalAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const context = await requireActiveProfile();
  return (
    <div
      className="internal-app flex min-h-screen flex-col bg-background text-foreground md:flex-row"
      data-theme="light"
    >
      <AppNavigation context={context} />
      <main className="min-w-0 flex-1 bg-background">
        <header className="border-b border-border bg-card px-4 py-3 sm:px-5 lg:px-7 xl:px-8">
          <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-x-5 gap-y-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Branch context
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {context.role.scope === "COMPANY"
                  ? `Company-wide · ${context.accessibleBranches.filter((branch) => branch.isActive).length} active branches`
                  : `Restricted to ${
                      context.accessibleBranches
                        .filter((branch) => branch.isActive)
                        .map((branch) => branch.name)
                        .join(", ") || "assigned branches"
                    }`}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Signed in as {context.profile.fullName || context.user.email}
            </p>
          </div>
        </header>
        <div className="w-full min-w-0 p-4 sm:p-5 lg:p-7 xl:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
