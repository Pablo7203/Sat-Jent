"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, type AuthState } from "@/features/auth/actions";
import { loginSchema, type LoginValues } from "@/features/auth/schema";

const initialState: AuthState = { success: false };
export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const {
    register,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  return (
    <form action={formAction} className="mt-6 space-y-5" noValidate>
      <div>
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-describedby={errors.email ? "email-error" : undefined}
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
        {errors.email ? (
          <p id="email-error" className="mt-1 text-sm text-destructive">
            {errors.email.message}
          </p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-describedby={errors.password ? "password-error" : undefined}
          aria-invalid={Boolean(errors.password)}
          {...register("password")}
        />
        {errors.password ? (
          <p id="password-error" className="mt-1 text-sm text-destructive">
            {errors.password.message}
          </p>
        ) : null}
      </div>
      {state.message ? (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${state.success ? "bg-secondary text-success" : "bg-red-50 text-destructive"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
      <Button className="w-full" disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
