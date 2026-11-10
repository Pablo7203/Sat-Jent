"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

type Theme = "dark" | "light";

const storageKey = "sat-j-internal-theme";
const changeEvent = "sat-j-internal-theme-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(changeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(changeEvent, callback);
  };
}

function getThemeSnapshot(): Theme {
  return window.localStorage.getItem(storageKey) === "dark" ? "dark" : "light";
}

function getServerTheme(): Theme {
  return "light";
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(
    subscribe,
    getThemeSnapshot,
    getServerTheme,
  );

  useEffect(() => {
    document.querySelector(".internal-app")?.setAttribute("data-theme", theme);
  }, [theme]);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    window.localStorage.setItem(storageKey, nextTheme);
    window.dispatchEvent(new Event(changeEvent));
  }

  const isDark = theme === "dark";
  return (
    <button
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={`theme-toggle flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium ${compact ? "min-w-10 justify-center px-0" : ""}`}
      onClick={toggleTheme}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      type="button"
    >
      {isDark ? (
        <Sun aria-hidden="true" size={17} />
      ) : (
        <Moon aria-hidden="true" size={17} />
      )}
      {!compact ? <span>{isDark ? "Light mode" : "Dark mode"}</span> : null}
    </button>
  );
}
