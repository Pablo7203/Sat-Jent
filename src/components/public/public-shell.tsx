"use client";

import Link from "next/link";
import { Menu, ShoppingBag, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BasketLink } from "@/components/public/basket-controls";

const links = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/about", label: "About" },
  { href: "/branches", label: "Branches" },
  { href: "/contact", label: "Contact" },
];

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[#20221f]/10 bg-[#fbfaf7]/95 text-[#20221f] backdrop-blur">
      <div className="mx-auto flex min-h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-10">
        <Link
          className="flex items-center gap-2 text-sm font-bold tracking-[0.1em]"
          href="/"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#aa4924] text-xs text-white">
            S
          </span>{" "}
          SAT-J
        </Link>
        <nav
          aria-label="Public navigation"
          className="hidden items-center gap-6 lg:flex"
        >
          {links.map((link) => (
            <Link
              className={`border-b py-1 text-sm transition-colors ${pathname === link.href ? "border-[#28372c] text-[#28372c]" : "border-transparent text-[#6d695f] hover:border-[#1d1e19]/35 hover:text-[#1d1e19]"}`}
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <BasketLink />
          <Link
            className="hidden items-center gap-2 rounded-full bg-[#20221f] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#aa4924] sm:inline-flex"
            href="/products"
          >
            <ShoppingBag aria-hidden="true" size={16} /> Browse products
          </Link>
          <button
            aria-controls="mobile-public-nav"
            aria-expanded={open}
            aria-label={open ? "Close navigation" : "Open navigation"}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[#1d1e19]/15 text-[#28372c] transition-colors hover:border-[#28372c] lg:hidden"
            onClick={() => setOpen((current) => !current)}
          >
            {open ? <X size={19} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open ? (
        <nav
          aria-label="Mobile public navigation"
          className="border-t border-[#1d1e19]/10 bg-[#f8f5ef] px-4 pb-5 pt-3 sm:px-6 lg:hidden"
          id="mobile-public-nav"
        >
          <div className="grid gap-1">
            {links.map((link) => (
              <Link
                className={`min-h-11 rounded-md px-3 py-3 text-sm font-semibold transition-colors ${pathname === link.href ? "bg-[#e7ded0] text-[#28372c]" : "text-[#6d695f] hover:bg-[#e7ded0]/60 hover:text-[#1d1e19]"}`}
                href={link.href}
                key={link.href}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              className="mt-3 rounded-full bg-[#28372c] px-4 py-3 text-center text-sm font-semibold text-[#f8f5ef] transition-colors hover:bg-[#1d1e19]"
              href="/products"
              onClick={() => setOpen(false)}
            >
              Shop products
            </Link>
            <Link
              className="min-h-11 rounded-md px-3 py-3 text-sm font-semibold text-[#20221f] hover:bg-[#efeee8]"
              href="/basket"
              onClick={() => setOpen(false)}
            >
              View basket
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}

export function PublicFooter({
  phone,
  email,
}: {
  phone: string | null;
  email: string | null;
}) {
  return (
    <footer className="bg-[#1d1e19] text-[#f8f5ef]">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_.8fr_.9fr] lg:px-10 lg:py-16">
        <div>
          <p className="text-sm font-semibold tracking-[0.1em]">SAT-J ENT</p>
          <p className="mt-5 max-w-sm text-sm leading-7 text-[#f8f5ef]/68">
            Doors, tiles, sanitary ware and finishing materials for homes,
            contractors and building projects.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold">Explore</p>
          <div className="mt-4 grid gap-3 text-sm text-[#f8f5ef]/68">
            <Link className="hover:text-white" href="/products">
              Products
            </Link>
            <Link className="hover:text-white" href="/branches">
              Branches
            </Link>
            <Link className="hover:text-white" href="/contact">
              Talk to SAT-J
            </Link>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold">Contact</p>
          <div className="mt-4 grid gap-3 text-sm text-[#f8f5ef]/68">
            {phone ? (
              <a className="hover:text-white" href={`tel:${phone}`}>
                {phone}
              </a>
            ) : (
              <span>Phone details coming soon</span>
            )}
            {email ? (
              <a className="hover:text-white" href={`mailto:${email}`}>
                {email}
              </a>
            ) : null}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-[#f8f5ef]/55 sm:px-6">
        <span>
          © {new Date().getFullYear()} SAT-J Ent. All rights reserved.
        </span>
        <span className="mx-2" aria-hidden="true">
          /
        </span>
        <Link className="hover:text-white" href="/privacy">
          Privacy
        </Link>
        <span className="mx-2" aria-hidden="true">
          /
        </span>
        <Link className="hover:text-white" href="/login">
          Staff login
        </Link>
      </div>
    </footer>
  );
}
