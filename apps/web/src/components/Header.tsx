import { StatusIndicator } from "./StatusIndicator";
import type { HealthStatus } from "../types/reasoning";

interface HeaderProps {
  health: HealthStatus;
}

export function Header({ health }: HeaderProps) {
  return (
    <header className="header">
      <div className="brand">
        <span className="brand-mark">KRS</span>
        <div>
          <h1 className="brand-title">Knowledge Reasoning System</h1>
          <p className="brand-sub">Evidence-grounded answers · real relationships</p>
        </div>
      </div>
      <div className="header-meta">
        <span className="mono">POST /reason</span>
        <StatusIndicator status={health} />
      </div>
    </header>
  );
}
