import type { ReactNode } from "react";
import { Header } from "./Header";
import type { HealthStatus } from "../types/reasoning";
import { useTheme } from "../lib/theme";

interface AppShellProps {
  health: HealthStatus;
  children: ReactNode;
}

export function AppShell({ health, children }: AppShellProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="app-shell">
      <Header
        health={health}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <main className="workspace-main">{children}</main>
    </div>
  );
}
