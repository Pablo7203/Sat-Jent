import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { updateWebsiteSettings } from "@/features/website/actions";
export default async function WebsiteSettingsPage() {
  await requirePermission("website.manage");
  const { data: s } = await (
    await createClient()
  )
    .from("public_site_settings")
    .select("*")
    .eq("id", true)
    .single();
  if (!s) return null;
  const field = "mt-1 min-h-11 w-full rounded-lg border px-3";
  return (
    <div className="space-y-6">
      <PageHeader
        title="Public website"
        description="Manage conservative public copy and real SAT-J Ent contact channels. Never enter placeholder contact details."
      />
      <Card>
        <form
          action={updateWebsiteSettings}
          className="grid gap-5 sm:grid-cols-2"
        >
          <label className="text-sm font-bold">
            Hero eyebrow
            <input
              className={field}
              name="heroEyebrow"
              defaultValue={s.hero_eyebrow}
            />
          </label>
          <label className="text-sm font-bold">
            Hero title
            <input
              className={field}
              name="heroTitle"
              defaultValue={s.hero_title}
              required
            />
          </label>
          <label className="text-sm font-bold sm:col-span-2">
            Hero description
            <textarea
              className="mt-1 w-full rounded-lg border p-3"
              rows={4}
              name="heroDescription"
              defaultValue={s.hero_description}
              required
            />
          </label>
          <label className="text-sm font-bold">
            Public phone
            <input
              className={field}
              name="phone"
              defaultValue={s.phone ?? ""}
            />
          </label>
          <label className="text-sm font-bold">
            Public email
            <input
              className={field}
              type="email"
              name="email"
              defaultValue={s.email ?? ""}
            />
          </label>
          <label className="text-sm font-bold">
            WhatsApp number
            <input
              className={field}
              name="whatsapp"
              defaultValue={s.whatsapp_number ?? ""}
              placeholder="Country code and number"
            />
          </label>
          <button className="min-h-11 rounded-lg bg-primary px-5 font-bold text-white sm:col-span-2">
            Save public settings
          </button>
        </form>
      </Card>
    </div>
  );
}
