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
import type { ReasoningResult } from "./types/reasoning";

const sampleResult: ReasoningResult = {
  answer: "Proposal: Type Hints\nFeature: Typing",
  confidence: 0.9,
  citations: [
    {
      entityId: "proposal:PEP-484",
      source: "pep-484.md"
    }
  ],
  trace: {
    steps: [
      {
        description: "Selected Proposal: Type Hints",
        evidence: [
          {
            entity: {
              id: "proposal:PEP-484",
              type: "Proposal",
              label: "Type Hints",
              source: "pep-484.md",
              confidence: 1,
              properties: {}
            },
            score: 0.9,
            source: "graph"
          }
        ]
      }
    ]
  },
  explanation: {
    answer: "Proposal: Type Hints\nFeature: Typing",
    reasoning: [
      "Evidence used: 1",
      "Grounded on proposal:PEP-484 from pep-484.md"
    ]
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
        return Response.json(sampleResult);
      }

      return new Response("not found", { status: 404 });
    })
  );
}

describe("Knowledge Reasoning Web UI", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the initial empty state", async () => {
    mockApi({});

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: /How KRS Works/i
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Currently Supported/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /How to Use KRS/i })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "What is PEP-484?" }).length
    ).toBeGreaterThan(0);
  });

  it("submits a query and renders answer, confidence, citations, explanation, and trace", async () => {
    const user = userEvent.setup();

    mockApi({
      reason: (init) => {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.query).toBe("What is PEP-484?");
        return Response.json(sampleResult);
      }
    });

    render(<App />);

    const input = await screen.findByLabelText(/Reasoning query/i);
    await user.clear(input);
    await user.type(input, "What is PEP-484?");
    await user.click(
      screen.getByRole("button", { name: /Run reasoning/i })
    );

    const answer = await screen.findByRole("heading", {
      name: /Grounded response/i
    });
    const answerPanel = answer.closest("section");
    expect(answerPanel).not.toBeNull();
    expect(
      within(answerPanel as HTMLElement).getByText(/Proposal: Type Hints/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Confidence 0.9/i)).toBeInTheDocument();
    expect(
      screen.getAllByText("proposal:PEP-484").length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/Grounded on proposal:PEP-484 from pep-484.md/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Selected Proposal: Type Hints/i)
    ).toBeInTheDocument();
  });

  it("shows a loading state while reasoning", async () => {
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
    await user.click(
      screen.getByRole("button", { name: /Run reasoning/i })
    );

    expect(
      await screen.findByText(/Reasoning in progress/i)
    ).toBeInTheDocument();
    expect(screen.getByText("RETRIEVING EVIDENCE")).toBeInTheDocument();
    expect(screen.getByText("BUILDING CONTEXT")).toBeInTheDocument();
    expect(screen.getByText("VERIFYING ANSWER")).toBeInTheDocument();

    resolveReason?.(Response.json(sampleResult));

    expect(
      await screen.findByRole("heading", { name: /Grounded response/i })
    ).toBeInTheDocument();
  });

  it.each([
    [400, "INVALID_REQUEST", /query was rejected/i],
    [401, "UNAUTHORIZED", /Authentication failed/i],
    [429, "RATE_LIMITED", /Too many requests/i],
    [500, "REASONING_FAILED", /Reasoning failed on the server/i]
  ] as const)(
    "handles %s errors without leaking internals",
    async (status, code, message) => {
      const user = userEvent.setup();

      mockApi({
        reason: () =>
          Response.json(
            {
              error: "ignored-raw",
              code,
              stack: "secret-stack",
              detail: "neo4j bolt://secret"
            },
            { status }
          )
      });

      render(<App />);

      const input = await screen.findByLabelText(/Reasoning query/i);
      await user.type(input, "What is PEP-484?");
      await user.click(
        screen.getByRole("button", { name: /Run reasoning/i })
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(screen.queryByText(/secret-stack/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/neo4j/i)).not.toBeInTheDocument();
    }
  );

  it("clears previous answers when a later request fails", async () => {
    const user = userEvent.setup();
    let call = 0;

    mockApi({
      reason: () => {
        call += 1;
        if (call === 1) {
          return Response.json(sampleResult);
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

    const input = await screen.findByLabelText(/Reasoning query/i);
    await user.type(input, "What is PEP-484?");
    await user.click(
      screen.getByRole("button", { name: /Run reasoning/i })
    );

    expect(
      await screen.findByRole("heading", { name: /Grounded response/i })
    ).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "What is typing?");
    await user.click(
      screen.getByRole("button", { name: /Run reasoning/i })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Reasoning failed on the server/i
    );
    expect(
      screen.queryByRole("heading", { name: /Grounded response/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Proposal: Type Hints/i)).not.toBeInTheDocument();
  });

  it("handles network failure", async () => {
    const user = userEvent.setup();

    mockApi({
      reason: () => {
        throw new TypeError("Failed to fetch");
      }
    });

    render(<App />);

    const input = await screen.findByLabelText(/Reasoning query/i);
    await user.type(input, "What is PEP-484?");
    await user.click(
      screen.getByRole("button", { name: /Run reasoning/i })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Could not reach the API/i
    );
  });

  it("keeps API credentials out of rendered UI output", async () => {
    mockApi({});

    const { container } = render(<App />);
    await screen.findByRole("heading", {
      name: /How KRS Works/i
    });

    expect(container.textContent).not.toMatch(/change-me-in-development/);
    expect(container.textContent).not.toMatch(/password123/);
  });

  it("renders layout-critical shell regions", async () => {
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
      screen.getByRole("heading", { name: /Knowledge graph view/i })
    ).toBeInTheDocument();
  });
});
