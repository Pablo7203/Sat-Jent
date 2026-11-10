import { Card } from "@/components/ui/card";
import { ResetPasswordForm } from "@/features/auth/recovery-forms";
export default function ResetPasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center px-5">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-bold">Set a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a strong password for your SAT-J Ent employee account.
        </p>
        <ResetPasswordForm />
      </Card>
    </main>
  );
}
