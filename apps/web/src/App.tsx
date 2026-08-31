import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiClientError,
  checkHealth,
  reason,
  resolveApiConfig
} from "./api/client";
import { AppShell } from "./components/AppShell";
import { AnswerPanel } from "./components/AnswerPanel";
import { EmptyState } from "./components/EmptyState";
import { ErrorState } from "./components/ErrorState";
import { EvidencePanel } from "./components/EvidencePanel";
import { GraphPanel } from "./components/GraphPanel";
import { HowKrsWorks } from "./components/HowKrsWorks";
import { LoadingState } from "./components/LoadingState";
import { QueryInput } from "./components/QueryInput";
import { ReasoningTraceView } from "./components/ReasoningTrace";
import {
  collectGroundedEvidence,
  deriveGraphFromResult
} from "./lib/graph-from-result";
import type {
  HealthStatus,
  ReasoningResult
} from "./types/reasoning";

export function App() {
  const apiConfig = useMemo(() => resolveApiConfig(), []);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReasoningResult | null>(null);
  const [health, setHealth] = useState<HealthStatus>("unknown");

  useEffect(() => {
    let cancelled = false;

    checkHealth(apiConfig).then((status) => {
      if (!cancelled) {
        setHealth(status);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [apiConfig]);

  const submit = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || loading) {
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const next = await reason(
        {
          query: trimmed,
          topK: 5
        },
        apiConfig
      );
      setResult(next);
      setHealth("ok");
    } catch (err) {
      setResult(null);
      const message =
        err instanceof ApiClientError
          ? err.message
          : "Unexpected client error.";
      setError(message);
      if (err instanceof ApiClientError && err.code === "NETWORK_ERROR") {
        setHealth("down");
      }
    } finally {
      setLoading(false);
    }
  }, [apiConfig, loading, query]);

  const evidence = useMemo(
    () => collectGroundedEvidence(result),
    [result]
  );

  const graph = useMemo(
    () => deriveGraphFromResult(result),
    [result]
  );

  return (
    <AppShell health={health} pipelineActive={Boolean(result) || loading}>
      <div className="workspace">
        <div className="stack">
          <QueryInput
            value={query}
            loading={loading}
            onChange={setQuery}
            onSubmit={() => {
              void submit();
            }}
          />

          {error ? <ErrorState message={error} /> : null}

          {loading ? <LoadingState /> : null}

          {!loading && !result && !error ? (
            <EmptyState onSelectExample={setQuery} />
          ) : null}

          {!loading && result ? <AnswerPanel result={result} /> : null}

          {!loading && !result ? (
            <HowKrsWorks onSelectExample={setQuery} />
          ) : null}
        </div>

        <div className="stack">
          {!loading && result ? (
            <>
              <EvidencePanel evidence={evidence} />
              <ReasoningTraceView trace={result.trace} />
              <GraphPanel model={graph} />
            </>
          ) : (
            <GraphPanel model={graph} />
          )}
        </div>
      </div>
    </AppShell>
  );
}
