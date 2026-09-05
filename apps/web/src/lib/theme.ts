import { useEffect, useState } from "react";

export type ThemeMode = "dark" | "light";

const STORAGE_KEY = "krs-theme";

function readStoredTheme(): ThemeMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark") {
      return value;
    }
  } catch {
    // Ignore storage access failures and fall back to dark.
  }
  return "dark";
}

function applyTheme(theme: ThemeMode): void {
  document.documentElement.dataset.theme = theme;
}

/**
 * Dark-default theme with localStorage persistence.
 */
export function useTheme(): {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
} {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof document === "undefined") {
      return "dark";
    }
    const initial = readStoredTheme();
    applyTheme(initial);
    return initial;
  });

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Persistence is best-effort.
    }
  }, [theme]);

  return {
    theme,
    setTheme: setThemeState,
    toggleTheme: () => {
      setThemeState((current) => (current === "dark" ? "light" : "dark"));
    }
  };
}
