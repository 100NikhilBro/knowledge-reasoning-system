import type { ReactNode } from "react";
import { Header } from "./Header";
import type { HealthStatus } from "../types/reasoning";

interface AppShellProps {
  health: HealthStatus;
  children: ReactNode;
}

export function AppShell({ health, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <Header health={health} />
      <main className="workspace-main">{children}</main>
    </div>
  );
}
