"use client";

import {
  ArrowRightLeft,
  BarChart3,
  CalendarDays,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PackageSearch,
  ShieldCheck,
  ShoppingCart,
  Tags,
  Truck,
  UserRound,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { logout } from "@/features/auth/actions";
import type { EmployeeContext, PermissionCode } from "@/lib/auth/types";
import { ThemeToggle } from "./theme-toggle";

type NavigationItem = {
  href: string;
  label: string;
  icon: ReactNode;
  permission?: PermissionCode;
  anyPermission?: PermissionCode[];
};

function NavigationLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavigationItem;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active =
    pathname === item.href ||
    pathname.startsWith(`${item.href}/`) ||
    (item.href === "/app/products" && pathname.startsWith("/app/catalog/")) ||
    (item.href === "/app/purchases" && pathname.startsWith("/app/purchases/"));
  return (
    <Link
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={`group flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${active ? "bg-[var(--app-nav-active)] text-[var(--app-nav-active-text)]" : "text-[var(--app-nav-muted)] hover:bg-[var(--app-nav-hover)] hover:text-[var(--app-nav-text)]"} ${collapsed ? "justify-center px-2" : ""}`}
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
    >
      {item.icon}
      {!collapsed ? item.label : null}
    </Link>
  );
}

function NavigationGroup({
  label,
  collapsed,
  children,
}: {
  label: string;
  collapsed: boolean;
  children: ReactNode;
}) {
  return (
    <section className="mt-6 first:mt-0">
      {collapsed ? (
        <div className="mx-auto mb-2 h-px w-7 bg-[var(--app-nav-divider)]" />
      ) : (
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-nav-label)]">
          {label}
        </p>
      )}
      <ul className="space-y-1">{children}</ul>
    </section>
  );
}

function NavigationItems({
  context,
  collapsed = false,
  onNavigate,
}: {
  context: EmployeeContext;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const can = (permission: PermissionCode) =>
    context.permissions.includes(permission);
  const show = (item: NavigationItem) =>
    item.permission
      ? can(item.permission)
      : item.anyPermission
        ? item.anyPermission.some(can)
        : true;
  const groups: { label: string; items: NavigationItem[] }[] = [
    {
      label: "General",
      items: [
        {
          href: "/app/dashboard",
          label: "Dashboard",
          icon: <LayoutDashboard aria-hidden="true" size={18} />,
          anyPermission: ["dashboard.company.read", "dashboard.branch.read"],
        },
        {
          href: "/app/profile",
          label: "My profile",
          icon: <UserRound aria-hidden="true" size={18} />,
        },
      ],
    },
    {
      label: "Daily operations",
      items: [
        {
          href: "/app/sales",
          label: "Sales",
          icon: <ShoppingCart aria-hidden="true" size={18} />,
          permission: "sales.read",
        },
        {
          href: "/app/store-orders",
          label: "Online orders",
          icon: <ShoppingCart aria-hidden="true" size={18} />,
          permission: "store_orders.read",
        },
        {
          href: "/app/daily-sales",
          label: "Daily sales",
          icon: <CalendarDays aria-hidden="true" size={18} />,
          permission: "daily_sales.read",
        },
        {
          href: "/app/inventory",
          label: "Inventory",
          icon: <PackageSearch aria-hidden="true" size={18} />,
          permission: "inventory.read",
        },
        {
          href: "/app/purchases",
          label: "Purchases",
          icon: <ClipboardList aria-hidden="true" size={18} />,
          permission: "purchases.read",
        },
        {
          href: "/app/purchases?status=awaiting",
          label: "Goods receiving",
          icon: <Truck aria-hidden="true" size={18} />,
          anyPermission: ["purchases.receive"],
        },
        {
          href: "/app/transfers",
          label: "Stock transfers",
          icon: <ArrowRightLeft aria-hidden="true" size={18} />,
          permission: "transfers.read",
        },
        {
          href: "/app/customers",
          label: "Customers",
          icon: <Users aria-hidden="true" size={18} />,
          permission: "customers.read",
        },
        {
          href: "/app/receivables",
          label: "Receivables",
          icon: <WalletCards aria-hidden="true" size={18} />,
          permission: "receivables.read",
        },
      ],
    },
    {
      label: "Management",
      items: [
        {
          href: "/app/expenses",
          label: "Expenses",
          icon: <WalletCards aria-hidden="true" size={18} />,
          permission: "expenses.read",
        },
        {
          href: "/app/finance",
          label: "Finance & accounts",
          icon: <BarChart3 aria-hidden="true" size={18} />,
          anyPermission: [
            "finance.accounts.read",
            "finance.ledger.read",
            "finance.reconcile",
            "reports.profitability.read",
          ],
        },
        {
          href: "/app/reports",
          label: "Reports",
          icon: <BarChart3 aria-hidden="true" size={18} />,
          anyPermission: ["reports.branch.read", "reports.company.read"],
        },
        {
          href: "/app/suppliers",
          label: "Suppliers",
          icon: <Truck aria-hidden="true" size={18} />,
          permission: "suppliers.read",
        },
      ],
    },
    {
      label: "Settings",
      items: [
        {
          href: "/app/products",
          label: "Products",
          icon: <Package aria-hidden="true" size={18} />,
          permission: "products.read",
        },
        {
          href: "/app/catalog/categories",
          label: "Categories",
          icon: <Tags aria-hidden="true" size={18} />,
          permission: "categories.read",
        },
        {
          href: "/app/admin/branches",
          label: "Branches",
          icon: <Building2 aria-hidden="true" size={18} />,
          permission: "branches.read",
        },
        {
          href: "/app/admin/users",
          label: "Users & access",
          icon: <ShieldCheck aria-hidden="true" size={18} />,
          permission: "users.read",
        },
        {
          href: "/app/admin/access",
          label: "Roles & permissions",
          icon: <Users aria-hidden="true" size={18} />,
          permission: "roles.read",
        },
      ],
    },
  ];

  return (
    <>
      {groups.map(({ label, items }) => {
        const visibleItems = items.filter(show);
        return visibleItems.length ? (
          <NavigationGroup collapsed={collapsed} key={label} label={label}>
            {visibleItems.map((item) => (
              <li key={item.href}>
                <NavigationLink
                  collapsed={collapsed}
                  item={item}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </NavigationGroup>
        ) : null;
      })}
    </>
  );
}

function EmployeeSummary({
  context,
  collapsed,
}: {
  context: EmployeeContext;
  collapsed?: boolean;
}) {
  const branch =
    context.accessibleBranches.length === 1
      ? context.accessibleBranches[0]?.name
      : "Multiple branches";
  return (
    <div className="border-t border-[var(--app-nav-divider)] pt-4">
      <div
        className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--app-nav-active)] text-xs font-semibold text-[var(--app-nav-active-text)]">
          {(context.profile.fullName || context.user.email)
            .slice(0, 2)
            .toUpperCase()}
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--app-nav-text)]">
              {context.profile.fullName || context.user.email}
            </p>
            <p className="truncate text-xs text-[var(--app-nav-muted)]">
              {context.role.name}
              {branch ? ` · ${branch}` : ""}
            </p>
          </div>
        ) : null}
      </div>
      <form action={logout}>
        <button
          className={`mt-3 flex min-h-10 items-center gap-3 rounded-lg text-sm font-semibold text-[var(--app-nav-muted)] hover:bg-[var(--app-nav-hover)] hover:text-[var(--app-nav-text)] ${collapsed ? "mx-auto w-10 justify-center" : "w-full px-3"}`}
          title={collapsed ? "Sign out" : undefined}
        >
          <LogOut aria-hidden="true" size={17} />
          {!collapsed ? "Sign out" : null}
        </button>
      </form>
    </div>
  );
}

export function AppNavigation({ context }: { context: EmployeeContext }) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileNavigationOpen) return;
    const previousOverflow = document.body.style.overflow;
    const menuButton = menuButtonRef.current;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavigationOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
      menuButton?.focus();
    };
  }, [mobileNavigationOpen]);

  return (
    <>
      <aside
        className={`internal-sidebar sticky top-0 hidden h-screen shrink-0 border-r border-[var(--app-nav-divider)] bg-[var(--app-sidebar)] p-3 transition-[width] duration-200 md:flex md:flex-col ${collapsed ? "w-[72px]" : "w-[248px]"}`}
      >
        <div
          className={`mb-7 flex min-h-10 items-center ${collapsed ? "justify-center" : "justify-between px-2"}`}
        >
          <Link
            className="flex items-center gap-2 font-semibold tracking-[-0.025em] text-[var(--app-nav-text)]"
            href="/app/dashboard"
            aria-label="SAT-J Ent dashboard"
          >
            <Building2
              aria-hidden="true"
              className="text-[var(--app-nav-brand)]"
              size={21}
            />
            {!collapsed ? "SAT-J ENT" : null}
          </Link>
          {!collapsed ? (
            <button
              aria-label="Collapse navigation"
              className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--app-nav-muted)] hover:bg-[var(--app-nav-hover)] hover:text-[var(--app-nav-text)]"
              onClick={() => setCollapsed(true)}
              type="button"
            >
              <ChevronLeft size={17} />
            </button>
          ) : null}
        </div>
        {collapsed ? (
          <button
            aria-label="Expand navigation"
            className="mb-5 flex h-8 w-full items-center justify-center rounded-md text-[var(--app-nav-muted)] hover:bg-[var(--app-nav-hover)] hover:text-[var(--app-nav-text)]"
            onClick={() => setCollapsed(false)}
            type="button"
          >
            <ChevronRight size={17} />
          </button>
        ) : null}
        <nav
          aria-label="Application navigation"
          className="min-h-0 flex-1 overflow-y-auto pr-1"
        >
          <NavigationItems collapsed={collapsed} context={context} />
        </nav>
        <div className={collapsed ? "mt-3 flex justify-center" : "mt-3"}>
          <ThemeToggle compact={collapsed} />
        </div>
        <EmployeeSummary collapsed={collapsed} context={context} />
      </aside>
      <header className="internal-sidebar border-b border-[var(--app-nav-divider)] bg-[var(--app-sidebar)] px-4 py-3 md:hidden">
        <div className="flex items-center justify-between">
          <Link
            className="flex items-center gap-2 font-semibold text-[var(--app-nav-text)]"
            href="/app/dashboard"
            aria-label="SAT-J Ent dashboard"
          >
            <Building2
              aria-hidden="true"
              className="text-[var(--app-nav-brand)]"
              size={21}
            />
            SAT-J ENT
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle compact />
            <button
              ref={menuButtonRef}
              aria-controls="mobile-application-navigation"
              aria-expanded={mobileNavigationOpen}
              aria-label={
                mobileNavigationOpen ? "Close navigation" : "Open navigation"
              }
              className="flex min-h-10 min-w-10 items-center justify-center rounded-md bg-[var(--app-nav-hover)] text-[var(--app-nav-text)]"
              onClick={() => setMobileNavigationOpen((open) => !open)}
              type="button"
            >
              <Menu aria-hidden="true" size={20} />
            </button>
          </div>
        </div>
        {mobileNavigationOpen ? (
          <div className="fixed inset-0 z-50">
            <button
              aria-label="Close navigation"
              className="absolute inset-0 h-full w-full bg-black/45"
              onClick={() => setMobileNavigationOpen(false)}
              type="button"
            />
            <div
              aria-label="Application navigation"
              aria-modal="true"
              className="internal-sidebar relative grid h-dvh min-h-0 w-[min(340px,88vw)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-r border-[var(--app-nav-divider)] bg-[var(--app-sidebar)] p-4 shadow-xl"
              id="mobile-application-navigation"
              role="dialog"
            >
              <div className="mb-5 flex items-center justify-between px-2">
                <span className="text-sm font-semibold text-[var(--app-nav-text)]">
                  Navigation
                </span>
                <button
                  ref={closeButtonRef}
                  aria-label="Close navigation"
                  className="flex size-10 items-center justify-center rounded-md text-[var(--app-nav-muted)] hover:bg-[var(--app-nav-hover)] hover:text-[var(--app-nav-text)]"
                  onClick={() => setMobileNavigationOpen(false)}
                  type="button"
                >
                  <X aria-hidden="true" size={19} />
                </button>
              </div>
              <nav
                aria-label="Mobile application navigation"
                className="min-h-0 overflow-y-auto overscroll-contain"
              >
                <NavigationItems
                  context={context}
                  onNavigate={() => setMobileNavigationOpen(false)}
                />
              </nav>
              <div className="relative z-10 mt-4 bg-[var(--app-sidebar)]">
                <EmployeeSummary context={context} />
              </div>
            </div>
          </div>
        ) : null}
      </header>
    </>
  );
}
