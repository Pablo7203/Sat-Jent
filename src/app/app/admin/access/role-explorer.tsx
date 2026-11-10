"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Permission = { code: string; description: string };
type Role = {
  id: string;
  code: string;
  name: string;
  scope: string;
  permissions: Permission[];
};

function moduleName(code: string) {
  return code.split(".")[0];
}

function moduleLabel(value: string) {
  const label = value.replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function RoleExplorer({ roles }: { roles: Role[] }) {
  const [query, setQuery] = useState("");
  const [module, setModule] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const search = query.trim().toLowerCase();
  const filtering = Boolean(search || module);
  const modules = [
    ...new Set(
      roles.flatMap((role) =>
        role.permissions.map((permission) => moduleName(permission.code)),
      ),
    ),
  ].sort();
  const visible = roles
    .map((role) => ({
      ...role,
      matches: role.permissions
        .filter(
          (permission) =>
            (!module || moduleName(permission.code) === module) &&
            (!search ||
              `${permission.code} ${permission.description}`
                .toLowerCase()
                .includes(search)),
        )
        .sort((a, b) => a.code.localeCompare(b.code)),
    }))
    .filter((role) => !filtering || role.matches.length > 0);

  function clearFilters() {
    setQuery("");
    setModule("");
    setExpanded({});
  }

  return (
    <div className="space-y-5">
      <div className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]">
        <label className="space-y-2 text-sm font-medium">
          <span className="block">Search permissions</span>
          <Input
            type="search"
            value={query}
            placeholder="Try sales.cancel or record payments"
            onChange={(event) => {
              setQuery(event.target.value);
              setExpanded({});
            }}
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span className="block">Module</span>
          <select
            className="min-h-11 w-full rounded-lg border bg-surface px-3 py-2 text-base"
            value={module}
            onChange={(event) => {
              setModule(event.target.value);
              setExpanded({});
            }}
          >
            <option value="">All modules</option>
            {modules.map((value) => (
              <option key={value} value={value}>
                {moduleLabel(value)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" className="text-sm text-muted-foreground">
          {visible.length} of {roles.length} roles
          {filtering ? " match your filters" : " available"}
        </p>
        <div className="flex flex-wrap gap-2">
          {filtering && (
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
          {visible.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => {
                const allOpen = visible.every(
                  (role) => expanded[role.id] ?? filtering,
                );
                setExpanded(
                  Object.fromEntries(
                    visible.map((role) => [role.id, !allOpen]),
                  ),
                );
              }}
            >
              {visible.every((role) => expanded[role.id] ?? filtering)
                ? "Collapse all"
                : "Expand all"}
            </Button>
          )}
        </div>
      </div>
      {visible.length === 0 && (
        <div className="rounded-xl bg-secondary p-6">
          <h2 className="font-semibold">
            {roles.length ? "No matching permissions" : "No roles available"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {roles.length
              ? "Try another permission name or choose a different module."
              : "No system roles were returned. Contact your administrator if this continues."}
          </p>
        </div>
      )}
      <div className="space-y-3">
        {visible.map((role) => {
          const open = expanded[role.id] ?? filtering;
          const groups = [
            ...new Set(
              role.matches.map((permission) => moduleName(permission.code)),
            ),
          ];
          return (
            <section key={role.id} className="rounded-xl bg-surface">
              <h2>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`permissions-${role.id}`}
                  className="flex w-full items-center gap-3 rounded-xl bg-secondary/60 p-4 text-left hover:bg-secondary sm:p-5"
                  onClick={() =>
                    setExpanded((current) => ({ ...current, [role.id]: !open }))
                  }
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold">
                      {role.name}
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium">
                      <span className="rounded-md bg-primary/10 px-2 py-1 text-primary">
                        {role.scope === "COMPANY"
                          ? "Company-wide"
                          : "Assigned branches"}
                      </span>
                      <span className="break-all text-muted-foreground">
                        {role.code}
                      </span>
                    </span>
                    <span className="mt-2 block text-sm font-normal text-muted-foreground">
                      {filtering
                        ? `${role.matches.length} of ${role.permissions.length} permissions match`
                        : `${role.permissions.length} permissions`}
                    </span>
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    size={20}
                    className={`shrink-0 ${open ? "rotate-180" : ""}`}
                  />
                </button>
              </h2>
              <div
                id={`permissions-${role.id}`}
                hidden={!open}
                className="p-4 sm:p-5"
              >
                <div className="grid gap-6 xl:grid-cols-2">
                  {groups.map((group) => (
                    <div key={group} className="min-w-0">
                      <h3 className="mb-3 font-semibold">
                        {moduleLabel(group)}
                      </h3>
                      <ul className="space-y-4">
                        {role.matches
                          .filter(
                            (permission) =>
                              moduleName(permission.code) === group,
                          )
                          .map((permission) => (
                            <li key={permission.code} className="text-sm">
                              <code className="break-all text-xs font-medium">
                                {permission.code}
                              </code>
                              <p className="mt-1 text-muted-foreground">
                                {permission.description}
                              </p>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
                {role.matches.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No permissions assigned.
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
