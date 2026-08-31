import type { ReactNode } from "react";
import { Header } from "./Header";
import type { HealthStatus } from "../types/reasoning";

interface AppShellProps {
  health: HealthStatus;
  pipelineActive?: boolean;
  children: ReactNode;
}

const PIPELINE = [
  "Query",
  "Retrieve",
  "Reason",
  "Ground",
  "Verify",
  "Answer"
] as const;

export function AppShell({
  health,
  pipelineActive = false,
  children
}: AppShellProps) {
  return (
    <div className="app-shell">
      <Header health={health} />

      <div className="pipeline-strip" aria-hidden="true">
        {PIPELINE.map((step) => (
          <div
            key={step}
            className="pipeline-step"
            data-active={pipelineActive}
          >
            {step}
          </div>
        ))}
      </div>

      {children}
    </div>
  );
}
