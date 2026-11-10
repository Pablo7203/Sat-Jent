import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { requireActiveProfile } from "@/lib/auth/authorization";
import { canReadReport, reportCatalog } from "@/lib/report-catalog";
import { defaultReportingRange } from "@/lib/reporting";
import { redirect } from "next/navigation";
export default async function ReportsPage() {
  const context = await requireActiveProfile();
  if (
    !context.permissions.some(
      (p) => p === "reports.branch.read" || p === "reports.company.read",
    )
  )
    redirect("/access-denied?reason=permission");
  const range = defaultReportingRange();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Server-calculated operational reports with branch-safe CSV exports."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(reportCatalog)
          .filter(([kind]) =>
            canReadReport(
              kind as keyof typeof reportCatalog,
              context.permissions,
            ),
          )
          .map(([kind, item]) => (
            <Link
              className="rounded-2xl border bg-surface p-6 shadow-sm hover:border-primary"
              key={kind}
              href={`/app/reports/${kind}?from=${range.from}&to=${range.to}`}
            >
              <h2 className="font-bold">{item.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {item.description}
              </p>
            </Link>
          ))}
      </div>
    </div>
  );
}
