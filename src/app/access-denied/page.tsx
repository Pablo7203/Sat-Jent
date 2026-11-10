import { ShieldX } from "lucide-react";
import { logout } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
export default function AccessDeniedPage() {
  return (
    <main className="grid min-h-screen place-items-center px-5">
      <div className="max-w-lg text-center">
        <ShieldX
          aria-hidden="true"
          className="mx-auto text-destructive"
          size={44}
        />
        <h1 className="mt-4 text-3xl font-bold">Access unavailable</h1>
        <p className="mt-3 text-muted-foreground">
          Your account is not currently authorized for the SAT-J Ent internal
          application. Contact an administrator if you believe this is
          unexpected.
        </p>
        <form action={logout}>
          <Button className="mt-6">Return to login</Button>
        </form>
      </div>
    </main>
  );
}
