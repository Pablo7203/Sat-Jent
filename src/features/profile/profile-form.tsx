"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateOwnProfile,
  type ProfileState,
} from "@/features/profile/actions";

const initialState: ProfileState = { success: false };

export function ProfileForm({
  fullName,
  phone,
}: {
  fullName: string;
  phone: string | null;
}) {
  const [state, action, pending] = useActionState(
    updateOwnProfile,
    initialState,
  );
  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      <Label>
        Full name
        <Input
          className="mt-1"
          defaultValue={fullName}
          name="fullName"
          required
        />
      </Label>
      <Label>
        Phone number
        <Input
          className="mt-1"
          defaultValue={phone ?? ""}
          name="phone"
          placeholder="e.g. 024 000 0000"
          type="tel"
        />
      </Label>
      <div className="sm:col-span-2">
        {state.message ? (
          <p
            className={`mb-3 text-sm ${state.success ? "text-success" : "text-destructive"}`}
            role="status"
          >
            {state.message}
          </p>
        ) : null}
        <Button disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
