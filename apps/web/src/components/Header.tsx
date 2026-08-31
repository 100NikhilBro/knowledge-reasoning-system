import { StatusIndicator } from "./StatusIndicator";
import type { HealthStatus } from "../types/reasoning";

interface HeaderProps {
  health: HealthStatus;
}

export function Header({ health }: HeaderProps) {
  return (
    <header className="header">
      <div className="brand">
        <span className="brand-mark">KRS // WEB</span>
        <h1 className="brand-title">Knowledge Reasoning System</h1>
      </div>
      <div className="header-meta">
        <span>POST /reason</span>
        <StatusIndicator status={health} />
      </div>
    </header>
  );
}
