/**
 * Validates private runtime settings and provides guarded accessors for trusted server credentials.
 */

import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().min(3).optional(),
  PAYSTACK_SECRET_KEY: z.string().min(1).optional(),
  PAYSTACK_WEBHOOK_SECRET: z.string().min(1).optional(),
});

export function getServerEnv() {
  return serverEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
    PAYSTACK_WEBHOOK_SECRET: process.env.PAYSTACK_WEBHOOK_SECRET,
  });
}

export function getResendEnv() {
  const { RESEND_API_KEY, RESEND_FROM_EMAIL } = getServerEnv();
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) return null;
  return { apiKey: RESEND_API_KEY, from: RESEND_FROM_EMAIL };
}

export function getRequiredServiceRoleKey(): string {
  const key = getServerEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for this trusted administrative operation.",
    );
  }
  return key;
}

export function getRequiredPaystackSecretKey(): string {
  const key = getServerEnv().PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error("PAYSTACK_SECRET_KEY is required for Paystack payments.");
  }
  return key;
}

export function getRequiredPaystackWebhookSecret(): string {
  const secret = getServerEnv().PAYSTACK_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "PAYSTACK_WEBHOOK_SECRET is required to verify Paystack webhooks.",
    );
  }
  return secret;
}
