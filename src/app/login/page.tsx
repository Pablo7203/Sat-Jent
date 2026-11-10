import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import Link from "next/link";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Login" };
export default function LoginPage() {
  return (
    <main className="min-h-[100dvh] bg-[#f1ece2] p-4 text-[#1d1e19] sm:p-6 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-[1440px] overflow-hidden rounded-2xl bg-[#f8f5ef] shadow-[0_24px_80px_rgba(29,30,25,0.12)] sm:min-h-[calc(100dvh-3rem)] lg:grid-cols-[1.08fr_.92fr]">
        <aside className="relative hidden min-h-full overflow-hidden bg-[#28372c] p-10 text-[#f8f5ef] lg:flex lg:flex-col">
          <div className="absolute inset-0 bg-[url('/images/satj-editorial-hero.png')] bg-cover bg-center opacity-35" />
          <div className="absolute inset-0 bg-[#1d2a20]/68" />
          <Link
            className="relative flex w-fit items-center gap-2 text-sm font-semibold tracking-[0.08em]"
            href="/"
          >
            <Building2 aria-hidden="true" className="size-5" /> SAT-J ENT
          </Link>
          <div className="relative mt-auto max-w-lg pb-8">
            <p className="text-sm font-medium text-[#e7ded0]">
              Staff workspace
            </p>
            <h1 className="mt-4 text-5xl font-semibold leading-[1.02] tracking-[-0.05em]">
              Manage every branch with clarity.
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-[#f8f5ef]/78">
              Secure access to products, inventory, purchases, sales and
              business reporting.
            </p>
          </div>
        </aside>
        <section className="staff-login [--border:#d8d0c4] [--focus:#385846] [--muted-foreground:#6d695f] [--primary:#28372c] [--primary-foreground:#f8f5ef] [--primary-hover:#1d2a20] [--surface:#fffdf9] flex min-h-full flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-20">
          <Link
            className="mb-14 flex w-fit items-center gap-2 text-sm font-bold tracking-[0.06em] text-[#28372c] lg:hidden"
            href="/"
          >
            <Building2 aria-hidden="true" className="size-5" /> SAT-J ENT
          </Link>
          <div className="w-full max-w-md">
            <p className="text-sm font-semibold text-[#40513d]">Welcome back</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-0.045em]">
              Staff login
            </h2>
            <p className="mt-4 text-sm leading-6 text-[#6d695f]">
              Sign in with the account created for you by your SAT-J
              administrator.
            </p>
            <LoginForm />
            <Link
              href="/forgot-password"
              className="mt-6 block text-center text-sm font-semibold text-[#28372c] underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <p className="mt-12 text-xs leading-5 text-[#6d695f]">
            Need access? Ask your branch manager or a Super Admin to send you an
            invitation.
          </p>
        </section>
      </div>
    </main>
  );
}
