import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

async function main() {
  const email = z.email().parse(process.argv[2]);
  const url = z.url().parse(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceKey = z
    .string()
    .min(1)
    .parse(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: users, error: usersError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (usersError) throw new Error("Could not list Auth users.");
  const target = users.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase(),
  );
  if (!target)
    throw new Error(
      "No Auth user matches the supplied email. Create that user in Supabase Auth first.",
    );
  const { data: role, error: roleError } = await admin
    .from("roles")
    .select("id")
    .eq("code", "SUPER_ADMIN")
    .single();
  if (roleError || !role)
    throw new Error(
      "SUPER_ADMIN role is missing. Apply Phase 1 migrations first.",
    );
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("role_id", role.id)
    .eq("is_active", true);
  if (existing?.some((profile) => profile.id !== target.id))
    throw new Error(
      "An active Super Admin already exists. Use the authenticated administration UI instead.",
    );
  const { error: updateError } = await admin
    .from("profiles")
    .update({ role_id: role.id, is_active: true })
    .eq("id", target.id);
  if (updateError)
    throw new Error("Could not activate the requested Super Admin profile.");
  process.stdout.write(`Super Admin bootstrap complete for ${email}.\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Super Admin bootstrap failed."}\n`,
  );
  process.exitCode = 1;
});
