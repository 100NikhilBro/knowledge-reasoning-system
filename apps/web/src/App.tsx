import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
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
import { LoadingState } from "./components/LoadingState";
import { QueryInput } from "./components/QueryInput";
import { ReasoningTraceView } from "./components/ReasoningTrace";
import { RelationshipPath } from "./components/RelationshipPath";
import {
  collectGroundedEvidence,
  deriveGraphFromResult,
  deriveRelationshipPath
} from "./lib/graph-from-result";
import type {
  HealthStatus,
  ReasoningResult
} from "./types/reasoning";

export function App() {
  const apiConfig = useMemo(() => resolveApiConfig(), []);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [result, setResult] = useState<ReasoningResult | null>(null);
  const [health, setHealth] = useState<HealthStatus>("unknown");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;

    checkHealth(apiConfig).then((status) => {
      if (!cancelled) {
        setHealth(status);
      }
    });

    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [apiConfig]);

  const submit = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || loading) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setErrorCode(undefined);
    setResult(null);
    setSubmittedQuery(trimmed);

    try {
      const next = await reason(
        {
          query: trimmed,
          topK: 5
        },
        apiConfig,
        controller.signal
      );
      setResult(next);
      setHealth("ok");
    } catch (err) {
      if (
        err instanceof ApiClientError &&
        err.message === "Request cancelled."
      ) {
        return;
      }

      setResult(null);
      const message =
        err instanceof ApiClientError
          ? err.message
          : "Unexpected client error.";
      setError(message);
      setErrorCode(
        err instanceof ApiClientError ? String(err.code) : "UNKNOWN"
      );
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

  const path = useMemo(
    () => deriveRelationshipPath(result),
    [result]
  );

  return (
    <AppShell health={health}>
      <div className="workspace">
        <QueryInput
          value={query}
          loading={loading}
          onChange={setQuery}
          onSubmit={() => {
            void submit();
          }}
        />

        {error ? (
          <ErrorState
            message={error}
            code={errorCode}
            onRetry={
              errorCode === "NETWORK_ERROR" ||
              errorCode === "RATE_LIMITED" ||
              errorCode === "REASONING_FAILED"
                ? () => {
                    void submit();
                  }
                : undefined
            }
          />
        ) : null}

        {loading ? <LoadingState /> : null}

        {!loading && !result && !error ? (
          <EmptyState
            onSelectExample={(example) => {
              setQuery(example);
            }}
          />
        ) : null}

        {!loading && result ? (
          <div className="result-stack">
            <AnswerPanel result={result} query={submittedQuery} />
            <RelationshipPath hops={path} />
            <EvidencePanel evidence={evidence} />
            <ReasoningTraceView trace={result.trace} />
            <GraphPanel model={graph} />
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
