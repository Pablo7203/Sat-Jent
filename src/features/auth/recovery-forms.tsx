"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestPasswordReset,
  updatePassword,
  type AuthState,
} from "@/features/auth/actions";

const initialState: AuthState = { success: false };
export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(
    requestPasswordReset,
    initialState,
  );
  return (
    <form action={action} className="mt-6 space-y-5">
      <div>
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      {state.message ? (
        <p role="status" className="rounded-lg bg-secondary p-3 text-sm">
          {state.message}
        </p>
      ) : null}
      <Button className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send recovery instructions"}
      </Button>
    </form>
  );
}
export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initialState);
  return (
    <form action={action} className="mt-6 space-y-5">
      <div>
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Use at least 12 characters.
        </p>
      </div>
      {state.message ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-destructive"
        >
          {state.message}
        </p>
      ) : null}
      <Button className="w-full" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
