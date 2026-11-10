import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ForgotPasswordForm } from "@/features/auth/recovery-forms";
export default function ForgotPasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center px-5">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-bold">Recover your password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your employee email address.
        </p>
        <ForgotPasswordForm />
        <Link
          href="/login"
          className="mt-5 block text-center text-sm font-semibold text-primary"
        >
          Back to login
        </Link>
      </Card>
    </main>
  );
}
