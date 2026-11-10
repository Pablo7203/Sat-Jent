"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type BasketLine = {
  variantId: string;
  slug: string;
  name: string;
  variant: string;
  sku: string;
  unit: string;
  price: number | null;
  quantity: number;
};

type BasketSnapshot = { ready: boolean; lines: BasketLine[] };
type BasketContextValue = BasketSnapshot & {
  count: number;
  add: (line: Omit<BasketLine, "quantity">, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
};

const BasketContext = createContext<BasketContextValue | null>(null);
const storageKey = "satj-store-basket-v1";
const serverSnapshot: BasketSnapshot = { ready: false, lines: [] };
const listeners = new Set<() => void>();
let clientSnapshot = serverSnapshot;
let initialized = false;

function isBasketLine(line: unknown): line is BasketLine {
  if (!line || typeof line !== "object") return false;
  const value = line as Record<string, unknown>;
  return (
    typeof value.variantId === "string" &&
    typeof value.slug === "string" &&
    typeof value.name === "string" &&
    typeof value.variant === "string" &&
    typeof value.sku === "string" &&
    typeof value.unit === "string" &&
    (value.price === null ||
      (typeof value.price === "number" &&
        Number.isFinite(value.price) &&
        value.price >= 0)) &&
    typeof value.quantity === "number" &&
    Number.isFinite(value.quantity) &&
    value.quantity > 0
  );
}

function initializeClientSnapshot() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    const saved = window.localStorage.getItem(storageKey);
    const parsed: unknown = saved ? JSON.parse(saved) : [];
    clientSnapshot = {
      ready: true,
      lines: Array.isArray(parsed) ? parsed.filter(isBasketLine) : [],
    };
  } catch {
    clientSnapshot = { ready: true, lines: [] };
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Storage can be unavailable in private or restricted browser modes.
    }
  }
}

function getSnapshot() {
  initializeClientSnapshot();
  return clientSnapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== storageKey && event.key !== null) return;
    initialized = false;
    initializeClientSnapshot();
    for (const notify of listeners) notify();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function publish(lines: BasketLine[]) {
  clientSnapshot = { ready: true, lines };
  initialized = true;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(lines));
  } catch {
    // The basket remains usable for this visit if storage is full or disabled.
  }
  for (const notify of listeners) notify();
}

function updateLines(update: (current: BasketLine[]) => BasketLine[]) {
  initializeClientSnapshot();
  publish(update(clientSnapshot.lines));
}

export function BasketProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => serverSnapshot,
  );
  const add = useCallback(
    (line: Omit<BasketLine, "quantity">, quantity = 1) => {
      updateLines((current) => {
        const existing = current.find(
          (item) => item.variantId === line.variantId,
        );
        if (!existing) return [...current, { ...line, quantity }];
        return current.map((item) =>
          item.variantId === line.variantId
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      });
    },
    [],
  );
  const setQuantity = useCallback((variantId: string, quantity: number) => {
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    updateLines((current) =>
      current.map((item) =>
        item.variantId === variantId ? { ...item, quantity } : item,
      ),
    );
  }, []);
  const remove = useCallback(
    (variantId: string) =>
      updateLines((current) =>
        current.filter((item) => item.variantId !== variantId),
      ),
    [],
  );
  const clear = useCallback(() => updateLines(() => []), []);
  const count = snapshot.lines.reduce(
    (total, line) => total + line.quantity,
    0,
  );
  const value = useMemo(
    () => ({ ...snapshot, count, add, setQuantity, remove, clear }),
    [snapshot, count, add, setQuantity, remove, clear],
  );

  return (
    <BasketContext.Provider value={value}>{children}</BasketContext.Provider>
  );
}

export function useBasket() {
  const context = useContext(BasketContext);
  if (!context) throw new Error("useBasket must be used inside BasketProvider");
  return context;
}
