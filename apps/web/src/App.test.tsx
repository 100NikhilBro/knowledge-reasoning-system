import {
  describe,
  expect,
  it,
  vi,
  beforeEach
} from "vitest";
import {
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import type { Evidence, ReasoningResult } from "./types/reasoning";

function entityEvidence(
  options: Partial<Evidence> & {
    id: string;
    label: string;
    type?: string;
    source?: string;
    channel?: string;
    relationship?: Evidence["relationship"];
    metadata?: Evidence["metadata"];
  }
): Evidence {
  return {
    entity: {
      id: options.id,
      type: options.type ?? "Entity",
      label: options.label,
      source: options.source ?? "corpus.md",
      confidence: 1,
      properties: {}
    },
    score: 0.9,
    source: options.channel ?? "graph",
    ...(options.relationship
      ? { relationship: options.relationship }
      : {}),
    ...(options.metadata ? { metadata: options.metadata } : {})
  };
}

const groundedResult: ReasoningResult = {
  answer: "Proposal: Type Hints\nFeature: Typing",
  confidence: 0.64,
  citations: [
    {
      entityId: "proposal:PEP-484",
      source: "pep-484.md"
    }
  ],
  trace: {
    steps: [
      {
        description:
          "Selected Proposal: Type Hints via INTRODUCES (proposal:PEP-484 → feature:typing)",
        evidence: [
          entityEvidence({
            id: "proposal:PEP-484",
            label: "Type Hints",
            type: "Proposal",
            channel: "graph",
            metadata: { sources: ["graph", "vector"] },
            relationship: {
              from: "proposal:PEP-484",
              to: "feature:typing",
              type: "INTRODUCES",
              confidence: 1
            }
          })
        ]
      },
      {
        description:
          "Selected Feature: Typing via ADDRESSES (feature:typing → concern:readability)",
        evidence: [
          entityEvidence({
            id: "feature:typing",
            label: "Typing",
            type: "Feature",
            channel: "graph",
            relationship: {
              from: "feature:typing",
              to: "concern:readability",
              type: "ADDRESSES",
              confidence: 1
            }
          })
        ]
      },
      {
        description: "Selected Concern: Readability",
        evidence: [
          entityEvidence({
            id: "concern:readability",
            label: "Readability",
            type: "Concern",
            channel: "vector"
          })
        ]
      }
    ]
  },
  explanation: {
    answer: "Proposal: Type Hints\nFeature: Typing",
    reasoning: [
      "Evidence used: 3",
      "Grounded on proposal:PEP-484 from pep-484.md"
    ]
  }
};

const failClosedResult: ReasoningResult = {
  answer: "",
  confidence: 0,
  citations: [],
  trace: { steps: [] },
  explanation: {
    answer: "",
    reasoning: ["Evidence used: 0"]
  }
};

function mockApi(options: {
  reason?: (init?: RequestInit) => Promise<Response> | Response;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/health")) {
        return Response.json({
          status: "ok",
          service: "Knowledge Reasoning API"
        });
      }

      if (url.includes("/reason")) {
        if (options.reason) {
          return options.reason(init);
        }
        return Response.json(groundedResult);
      }

      return new Response("not found", { status: 404 });
    })
  );
}

async function runQuery(text: string) {
  const user = userEvent.setup();
  const input = await screen.findByLabelText(/Reasoning query/i);
  await user.clear(input);
  await user.type(input, text);
  await user.click(screen.getByRole("button", { name: /^Run$/i }));
  return user;
}

describe("Knowledge Reasoning Web UI", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the initial empty workspace", async () => {
    mockApi({});

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: /Evidence-grounded reasoning/i
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Knowledge Reasoning System/i,
        level: 1
      })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Reasoning query/i)).toBeInTheDocument();
  });

  it("A: successful grounded answer", async () => {
    mockApi({});
    render(<App />);
    await runQuery("What is PEP-484?");

    expect(
      await screen.findByRole("heading", { name: /Grounded response/i })
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Proposal: Type Hints/i).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("Grounded")).toBeInTheDocument();
  });

  it("B/C/D: graph, vector, and hybrid provenance badges", async () => {
    mockApi({});
    render(<App />);
    await runQuery("What is PEP-484?");

    await screen.findByRole("heading", { name: /Grounded evidence/i });

    expect(screen.getAllByText("Graph + Vector").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Graph").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Vector").length).toBeGreaterThan(0);
  });

  it("E/F: relationship path and multi-hop trace", async () => {
    mockApi({});
    render(<App />);
    await runQuery("How is PEP-484 connected to type hints?");

    const pathHeading = await screen.findByRole("heading", {
      name: /Relationship path/i
    });
    const pathPanel = pathHeading.closest("section");
    expect(pathPanel).not.toBeNull();

    expect(
      within(pathPanel as HTMLElement).getByRole("img")
    ).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/INTRODUCES/i)
    );
    expect(
      within(pathPanel as HTMLElement).getAllByText("INTRODUCES").length
    ).toBeGreaterThan(0);
    expect(
      within(pathPanel as HTMLElement).getAllByText("ADDRESSES").length
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: /Reasoning trace/i })
    ).toBeInTheDocument();
  });

  it("G/H: confidence display and verified state", async () => {
    mockApi({});
    render(<App />);
    await runQuery("What is PEP-484?");

    expect(
      await screen.findByLabelText(/Grounded confidence 64%/i)
    ).toBeInTheDocument();
    expect(screen.getByText("64%")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("I: fail-closed state", async () => {
    mockApi({
      reason: () => Response.json(failClosedResult)
    });
    render(<App />);
    await runQuery("Who proposed PEP-999?");

    expect(
      await screen.findByRole("heading", {
        name: /No grounded answer found/i
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not provide sufficient evidence/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Fail-closed")).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Grounded confidence 0%/i)
    ).toBeInTheDocument();
  });

  it("J: API/network error states", async () => {
    mockApi({
      reason: () => {
        throw new TypeError("Failed to fetch");
      }
    });
    render(<App />);
    await runQuery("What is PEP-484?");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Could not reach the API/i);
    expect(within(alert).getByText(/Network error/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Retry/i })
    ).toBeInTheDocument();
  });

  it("K: loading state", async () => {
    const user = userEvent.setup();
    let resolveReason: ((value: Response) => void) | undefined;

    mockApi({
      reason: () =>
        new Promise<Response>((resolve) => {
          resolveReason = resolve;
        })
    });

    render(<App />);

    const input = await screen.findByLabelText(/Reasoning query/i);
    await user.type(input, "What is typing?");
    await user.click(screen.getByRole("button", { name: /^Run$/i }));

    expect(
      await screen.findByText(/Reasoning in progress/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Retrieving knowledge")).toBeInTheDocument();
    expect(screen.getByText("Connecting evidence")).toBeInTheDocument();
    expect(screen.getByText("Reasoning")).toBeInTheDocument();
    expect(screen.getByText("Verifying")).toBeInTheDocument();

    resolveReason?.(Response.json(groundedResult));

    expect(
      await screen.findByRole("heading", { name: /Grounded response/i })
    ).toBeInTheDocument();
  });

  it("L: keeps shell query regions on narrow layout semantics", async () => {
    mockApi({});
    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: /Knowledge Reasoning System/i,
        level: 1
      })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Reasoning query/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Ask a complex knowledge question/i
      })
    ).toBeInTheDocument();
  });

  it("handles validation errors without leaking internals", async () => {
    mockApi({
      reason: () =>
        Response.json(
          {
            error: "ignored-raw",
            code: "INVALID_REQUEST",
            stack: "secret-stack"
          },
          { status: 400 }
        )
    });
    render(<App />);
    await runQuery("What is PEP-484?");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/query was rejected/i);
    expect(within(alert).getByText(/Validation error/i)).toBeInTheDocument();
    expect(screen.queryByText(/secret-stack/i)).not.toBeInTheDocument();
  });

  it("clears previous answers when a later request fails", async () => {
    let call = 0;

    mockApi({
      reason: () => {
        call += 1;
        if (call === 1) {
          return Response.json(groundedResult);
        }
        return Response.json(
          {
            error: "Reasoning failed",
            code: "REASONING_FAILED"
          },
          { status: 500 }
        );
      }
    });

    render(<App />);
    await runQuery("What is PEP-484?");

    expect(
      await screen.findByRole("heading", { name: /Grounded response/i })
    ).toBeInTheDocument();

    await runQuery("What is typing?");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Reasoning failed on the server/i
    );
    expect(
      screen.queryByRole("heading", { name: /Grounded response/i })
    ).not.toBeInTheDocument();
  });

  it("does not expose raw evidence scores in the evidence panel", async () => {
    mockApi({});
    render(<App />);
    await runQuery("What is PEP-484?");

    const evidenceHeading = await screen.findByRole("heading", {
      name: /Grounded evidence/i
    });
    const evidencePanel = evidenceHeading.closest("section");
    expect(evidencePanel).not.toBeNull();
    expect(
      within(evidencePanel as HTMLElement).queryByText(/score=/i)
    ).not.toBeInTheDocument();
    expect(
      within(evidencePanel as HTMLElement).queryByText(/0\.9/)
    ).not.toBeInTheDocument();
  });

  it("keeps API credentials out of rendered UI output", async () => {
    mockApi({});
    const { container } = render(<App />);
    await screen.findByRole("heading", {
      name: /Evidence-grounded reasoning/i
    });

    expect(container.textContent).not.toMatch(/change-me-in-development/);
    expect(container.textContent).not.toMatch(/password123/);
  });
});
