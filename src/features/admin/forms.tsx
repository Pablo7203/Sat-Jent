"use client";
import { useActionState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createBranch,
  deleteEmployee,
  inviteEmployee,
  resendEmployeeInvitation,
  type ActionState,
} from "@/features/admin/actions";

const initial: ActionState = { success: false };
export function BranchForm() {
  const [state, action, pending] = useActionState(createBranch, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field name="code" label="Branch code" required />
      <Field name="name" label="Name" required />
      <Field name="address" label="Address" required />
      <Field name="phone" label="Phone" required />
      <Field name="email" label="Email" type="email" />
      <Field name="openingHours" label="Opening hours" />
      <div className="sm:col-span-2">
        {state.message ? (
          <p role="status" className="mb-3 text-sm">
            {state.message}
          </p>
        ) : null}
        <Button disabled={pending}>
          {pending ? "Creating…" : "Create branch"}
        </Button>
      </div>
    </form>
  );
}
export function InviteEmployeeForm({
  roles,
  branches,
}: {
  roles: { id: string; name: string; scope: string }[];
  branches: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(inviteEmployee, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field name="email" label="Email" type="email" required />
      <Field name="fullName" label="Full name" required />
      <Field name="phone" label="Phone" />
      <div>
        <Label htmlFor="roleId">System role</Label>
        <select
          id="roleId"
          name="roleId"
          required
          className="min-h-11 w-full rounded-lg border bg-surface px-3"
        >
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name} ({role.scope})
            </option>
          ))}
        </select>
      </div>
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-semibold">Branch assignments</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {branches.map((branch) => (
            <label
              key={branch.id}
              className="flex items-center gap-2 rounded-lg border p-3"
            >
              <input type="checkbox" name="branchIds" value={branch.id} />
              {branch.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="sm:col-span-2">
        {state.message ? (
          <p role="status" className="mb-3 text-sm">
            {state.message}
          </p>
        ) : null}
        <Button disabled={pending}>
          {pending ? "Inviting…" : "Invite employee"}
        </Button>
      </div>
    </form>
  );
}
function Field({
  label,
  name,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} />
    </div>
  );
}

export function ConfirmForm({
  action,
  children,
  message,
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  message: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </form>
  );
}

export function DeleteEmployeeForm({
  userId,
  employeeName,
}: {
  userId: string;
  employeeName: string;
}) {
  const [state, action, pending] = useActionState(deleteEmployee, initial);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Permanently delete ${employeeName}? Accounts with transaction history cannot be deleted and should be deactivated instead.`,
          )
        )
          event.preventDefault();
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      {state.message ? (
        <p role="status" className="mt-3 text-sm">
          {state.message}
        </p>
      ) : null}
      <Button className="mt-3" variant="danger" disabled={pending}>
        {pending ? "Deleting…" : "Delete employee"}
      </Button>
    </form>
  );
}

export function ResendInvitationForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(
    resendEmployeeInvitation,
    initial,
  );
  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="userId" value={userId} />
      {state.message ? (
        <p role="status" className="mb-3 text-sm">
          {state.message}
        </p>
      ) : null}
      <Button variant="secondary" disabled={pending}>
        {pending ? "Sending…" : "Resend invitation"}
      </Button>
    </form>
  );
}
