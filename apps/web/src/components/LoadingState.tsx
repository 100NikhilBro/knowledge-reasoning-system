import { useEffect, useState } from "react";

/**
 * UI-only staged progress while waiting for a single /reason response.
 * Does not claim live backend streaming events.
 */
const STAGES = [
  "Retrieving knowledge",
  "Connecting evidence",
  "Reasoning",
  "Verifying"
] as const;

export function LoadingState() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const media =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : { matches: false };

    if (media.matches) {
      setActiveIndex(STAGES.length - 1);
      return;
    }

    const id = window.setInterval(() => {
      setActiveIndex((current) =>
        current < STAGES.length - 1 ? current + 1 : current
      );
    }, 900);

    return () => window.clearInterval(id);
  }, []);

  return (
    <section
      className="panel loading-panel"
      aria-live="polite"
      aria-busy="true"
      aria-labelledby="loading-title"
    >
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Pipeline</p>
          <h2 className="panel-title" id="loading-title">
            Reasoning in progress
          </h2>
        </div>
      </div>

      <ol className="loading-flow">
        {STAGES.map((stage, index) => (
          <li key={stage}>
            <div
              className="loading-step"
              data-active={index <= activeIndex}
              data-current={index === activeIndex}
            >
              <span className="loading-marker" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="14" height="14">
                  {index <= activeIndex ? (
                    <circle cx="8" cy="8" r="5" fill="currentColor" />
                  ) : (
                    <circle
                      cx="8"
                      cy="8"
                      r="4.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.25"
                    />
                  )}
                </svg>
              </span>
              <span>{stage}</span>
            </div>
            {index < STAGES.length - 1 ? (
              <div className="loading-arrow" aria-hidden="true">
                <svg viewBox="0 0 12 20" width="12" height="18">
                  <path
                    d="M6 2 V16 M3 13 L6 17 L9 13"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                </svg>
              </div>
            ) : null}
          </li>
        ))}
      </ol>

      <p className="muted loading-disclaimer">
        Stages are a progress presentation while the API returns one completed
        reasoning result — not live backend event streaming.
      </p>
    </section>
  );
}
