/**
 * Validates private runtime settings and provides a guarded accessor for the Supabase service-role key.
 */

import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().min(3).optional(),
});
export function getServerEnv() {
  return serverEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  });
}

export function getResendEnv() {
  const { RESEND_API_KEY, RESEND_FROM_EMAIL } = getServerEnv();
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) return null;
  return { apiKey: RESEND_API_KEY, from: RESEND_FROM_EMAIL };
}

export function getRequiredServiceRoleKey(): string {
  const key = getServerEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for this trusted administrative operation.",
    );
  return key;
}
