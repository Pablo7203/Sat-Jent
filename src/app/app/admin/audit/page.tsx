import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export default async function AuditPage() {
  await requirePermission("audit.read");
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("audit_logs")
    .select("id, actor_user_id, action, entity_type, entity_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Access audit history"
        description="Recent access-control and branch administration changes. Audit records cannot be changed or deleted by application users."
      />
      <div className="space-y-3">
        {events?.length ? (
          events.map((event) => (
            <Card
              key={event.id}
              className="flex flex-wrap items-start justify-between gap-4"
            >
              <div>
                <h2 className="font-semibold">{event.action}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {event.entity_type}
                  {event.entity_id ? ` · ${event.entity_id}` : ""}
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <time dateTime={event.created_at}>
                  {new Intl.DateTimeFormat("en-GH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Africa/Accra",
                  }).format(new Date(event.created_at))}
                </time>
                <p className="mt-1">Actor: {event.actor_user_id ?? "System"}</p>
              </div>
            </Card>
          ))
        ) : (
          <Card>
            <p>No audit events found.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
