import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import type { ReasoningContext } from "../src/types/reasoning-context.js";

import {
  GROUNDING_SYSTEM_PROMPT,
  serializeGroundedContextForLlm
} from "../src/llm/build-grounding-prompt.js";

import { parseLlmStructuredOutput } from "../src/llm/parse-llm-structured-output.js";

import {
  resolveLlmConfig
} from "../src/config/resolve-llm-config.js";

import {
  createLlmProvider,
  createLlmProviderFromEnv
} from "../src/factories/create-llm-provider.js";

import { GroqLlmProvider } from "../src/providers/groq.llm-provider.js";

import { LlmAnswerGenerator } from "../src/services/llm-answer-generator.service.js";

import { DefaultAnswerVerifier } from "../src/services/answer-verifier.service.js";

import { DefaultContextBuilder } from "../src/services/context-builder.service.js";

import {
  LlmError,
  redactLlmErrorText
} from "../src/errors/llm-error.js";

import { isGeneratedAnswerGrounded } from "../src/utils/is-generated-answer-grounded.js";

import type { LlmProvider } from "../src/contracts/llm-provider.js";

function contextWithProposal(
  query = "What is PEP-484?"
): ReasoningContext {

  const builder =
    new DefaultContextBuilder({
      maxEvidence: 20
    });

  const context =
    builder.build({
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
          score: 0.95,
          source: "graph"
        }
      ]
    });

  context.query = query;
  return context;

}

describe("LLM config + factory", () => {

  it("resolves Groq config from env without embedding secrets in errors", () => {

    const config =
      resolveLlmConfig({
        LLM_PROVIDER: "groq",
        GROQ_API_KEY: "gsk_test_not_real",
        GROQ_MODEL: "openai/gpt-oss-20b",
        GROQ_TIMEOUT_MS: "15000"
      });

    expect(config.provider).toBe("groq");
    expect(config.model).toBe("openai/gpt-oss-20b");
    expect(config.timeoutMs).toBe(15_000);
    expect(config.apiKey).toBe("gsk_test_not_real");

  });

  it("requires GROQ_API_KEY for groq provider", () => {

    expect(() =>
      resolveLlmConfig({
        LLM_PROVIDER: "groq"
      })
    ).toThrow(/GROQ_API_KEY/);

  });

  it("creates Groq provider via DI factory", () => {

    const provider =
      createLlmProviderFromEnv({
        GROQ_API_KEY: "gsk_test_not_real"
      });

    expect(provider).toBeInstanceOf(GroqLlmProvider);
    expect(provider.id).toBe("groq");

  });

});

describe("grounding prompt + serialization", () => {

  it("includes grounding requirements in the system prompt", () => {

    expect(GROUNDING_SYSTEM_PROMPT).toMatch(
      /ONLY from the supplied grounded evidence/i
    );
    expect(GROUNDING_SYSTEM_PROMPT).toMatch(
      /Do NOT use outside or general knowledge/i
    );
    expect(GROUNDING_SYSTEM_PROMPT).toMatch(
      /Do NOT invent/i
    );
    expect(GROUNDING_SYSTEM_PROMPT).toMatch(
      /only supports part of the query/i
    );

  });

  it("serializes only grounded context fields", () => {

    const json =
      serializeGroundedContextForLlm(
        contextWithProposal(),
        "What is PEP-484?"
      );

    const parsed =
      JSON.parse(json) as {
        query: string;
        evidence: Array<{ entityId: string }>;
      };

    expect(parsed.query).toBe("What is PEP-484?");
    expect(parsed.evidence[0]?.entityId).toBe(
      "proposal:PEP-484"
    );
    expect(json).not.toMatch(/gsk_/);
    expect(json).not.toMatch(/apiKey/i);

  });

});

describe("structured output parsing", () => {

  it("parses valid JSON object output", () => {

    const parsed =
      parseLlmStructuredOutput(
        JSON.stringify({
          answer: "Type Hints are defined by PEP-484.",
          citedEntityIds: ["proposal:PEP-484"],
          reasoning: ["used proposal"]
        })
      );

    expect(parsed.answer).toContain("Type Hints");
    expect(parsed.citedEntityIds).toEqual([
      "proposal:PEP-484"
    ]);

  });

  it("rejects malformed provider output", () => {

    expect(() =>
      parseLlmStructuredOutput("not-json")
    ).toThrow(LlmError);

    expect(() =>
      parseLlmStructuredOutput('{"answer":1}')
    ).toThrow(/answer must be a string/);

  });

});

describe("Groq provider HTTP boundary", () => {

  it("constructs chat completion request with grounded context", async () => {

    const fetchImpl =
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    answer:
                      "PEP-484 introduces Type Hints.",
                    citedEntityIds: [
                      "proposal:PEP-484"
                    ]
                  })
                }
              }
            ]
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json"
            }
          }
        )
      );

    const provider =
      createLlmProvider(
        {
          provider: "groq",
          apiKey: "gsk_test_not_real",
          model: "openai/gpt-oss-20b",
          baseUrl: "https://api.groq.com/openai/v1",
          timeoutMs: 5_000
        },
        { fetchImpl }
      );

    const context =
      contextWithProposal();

    const result =
      await provider.generate({
        query: "What is PEP-484?",
        groundedContextJson:
          serializeGroundedContextForLlm(
            context,
            "What is PEP-484?"
          ),
        systemPrompt: GROUNDING_SYSTEM_PROMPT
      });

    expect(result.answer).toContain("Type Hints");

    expect(fetchImpl).toHaveBeenCalledOnce();

    const [url, init] =
      fetchImpl.mock.calls[0]!;

    expect(String(url)).toBe(
      "https://api.groq.com/openai/v1/chat/completions"
    );

    const headers =
      init?.headers as Record<string, string>;

    expect(headers.Authorization).toBe(
      "Bearer gsk_test_not_real"
    );

    const body =
      JSON.parse(String(init?.body)) as {
        model: string;
        messages: Array<{
          role: string;
          content: string;
        }>;
      };

    expect(body.model).toBe("openai/gpt-oss-20b");
    expect(body.messages[0]?.content).toContain(
      "ONLY from the supplied grounded evidence"
    );
    expect(body.messages[1]?.content).toContain(
      "proposal:PEP-484"
    );

  });

  it("maps model_not_found HTTP 404 to INVALID_CONFIG with sanitized detail", async () => {

    const fetchImpl =
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: {
              message:
                "The model `llama-3.3-70b-versatile` does not exist or you do not have access to it.",
              type: "invalid_request_error",
              code: "model_not_found"
            }
          }),
          { status: 404 }
        )
      );

    const provider =
      new GroqLlmProvider({
        apiKey: "gsk_test_not_real",
        model: "llama-3.3-70b-versatile",
        baseUrl: "https://api.groq.com/openai/v1",
        timeoutMs: 5_000,
        fetchImpl
      });

    await expect(
      provider.generate({
        query: "What is PEP-484?",
        groundedContextJson: "{}",
        systemPrompt: GROUNDING_SYSTEM_PROMPT
      })
    ).rejects.toMatchObject({
      name: "LlmError",
      code: "INVALID_CONFIG",
      message: expect.stringMatching(
        /HTTP 404.*model_not_found|does not exist/i
      )
    });

  });

  it("maps timeout to LlmError TIMEOUT", async () => {

    const fetchImpl =
      vi.fn(async (_url, init) => {
        const signal =
          (init as RequestInit | undefined)?.signal;

        return await new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            const error =
              new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      });

    const provider =
      new GroqLlmProvider({
        apiKey: "gsk_test_not_real",
        model: "llama-3.3-70b-versatile",
        baseUrl: "https://api.groq.com/openai/v1",
        timeoutMs: 5,
        fetchImpl
      });

    await expect(
      provider.generate({
        query: "q",
        groundedContextJson: "{}",
        systemPrompt: GROUNDING_SYSTEM_PROMPT,
        timeoutMs: 5
      })
    ).rejects.toMatchObject({
      code: "TIMEOUT"
    });

  });

  it("maps Groq HTTP 429 to LlmError RATE_LIMITED without leaking secrets", async () => {

    const fetchImpl =
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: {
              message:
                "Rate limit reached for model. Bearer gsk_leaked_should_redact",
              type: "rate_limit_error",
              code: "rate_limit_exceeded"
            }
          }),
          { status: 429 }
        )
      );

    const provider =
      new GroqLlmProvider({
        apiKey: "gsk_test_not_real",
        model: "openai/gpt-oss-20b",
        baseUrl: "https://api.groq.com/openai/v1",
        timeoutMs: 5_000,
        fetchImpl
      });

    await expect(
      provider.generate({
        query: "q",
        groundedContextJson: "{}",
        systemPrompt: GROUNDING_SYSTEM_PROMPT
      })
    ).rejects.toMatchObject({
      name: "LlmError",
      code: "RATE_LIMITED",
      message: expect.stringMatching(/HTTP 429/i)
    });

    try {
      await provider.generate({
        query: "q",
        groundedContextJson: "{}",
        systemPrompt: GROUNDING_SYSTEM_PROMPT
      });
    } catch (error) {
      expect(String(error)).not.toMatch(/gsk_leaked/);
    }

  });

  it("maps provider HTTP failures without leaking secrets", async () => {

    const fetchImpl =
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: {
              message:
                "Unauthorized Bearer gsk_leaked_should_redact"
            }
          }),
          { status: 401 }
        )
      );

    const provider =
      new GroqLlmProvider({
        apiKey: "gsk_test_not_real",
        model: "llama-3.3-70b-versatile",
        baseUrl: "https://api.groq.com/openai/v1",
        timeoutMs: 5_000,
        fetchImpl
      });

    await expect(
      provider.generate({
        query: "q",
        groundedContextJson: "{}",
        systemPrompt: GROUNDING_SYSTEM_PROMPT
      })
    ).rejects.toThrow(/HTTP 401/);

  });

  it("redacts credentials from error text", () => {

    expect(
      redactLlmErrorText(
        "Authorization Bearer gsk_abc123 and api_key=secret"
      )
    ).not.toMatch(/gsk_abc123/);

    expect(
      redactLlmErrorText(
        "Authorization Bearer gsk_abc123"
      )
    ).toContain("[REDACTED]");

  });

});

describe("LlmAnswerGenerator + verification", () => {

  it("passes grounded context into the provider and accepts grounded NL answers", async () => {

    const llm: LlmProvider = {
      id: "mock",
      model: "mock",
      generate: vi.fn(async request => {
        expect(request.groundedContextJson).toContain(
          "proposal:PEP-484"
        );
        expect(request.systemPrompt).toContain(
          "Do NOT invent"
        );

        return {
          answer:
            "PEP-484 defines Type Hints.",
          citedEntityIds: ["proposal:PEP-484"]
        };
      })
    };

    const generator =
      new LlmAnswerGenerator(llm);

    const context =
      contextWithProposal();

    const result =
      await generator.generate(context);

    const verifier =
      new DefaultAnswerVerifier();

    const verified =
      verifier.verify({
        result,
        context,
        explanation: {
          answer: result.answer,
          reasoning: [
            "Evidence used: 1",
            "Grounded on proposal:PEP-484 from pep-484.md"
          ]
        }
      });

    expect(verified.report.accepted).toBe(true);
    expect(verified.result.answer).toContain(
      "Type Hints"
    );
    expect(verified.result.citations[0]?.entityId).toBe(
      "proposal:PEP-484"
    );
    expect(llm.generate).toHaveBeenCalledOnce();

  });

  it("replaces ungrounded LLM answers with a grounded partial answer", async () => {

    const context =
      contextWithProposal();

    const verifier =
      new DefaultAnswerVerifier();

    const outcome =
      verifier.verify({
        result: {
          answer:
            "Quantum computing invented PEP-999 secretly.",
          confidence: 0.99,
          citations: [
            {
              entityId: "proposal:PEP-484",
              source: "pep-484.md"
            }
          ],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.report.accepted).toBe(true);
    expect(outcome.result.answer).toContain("Proposal: Type Hints");
    expect(outcome.result.answer).toMatch(
      /available evidence does not support additional claims/i
    );
    expect(outcome.result.answer).not.toMatch(/Quantum|PEP-999/i);
    expect(outcome.result.citations[0]?.entityId).toBe(
      "proposal:PEP-484"
    );

  });

  it("treats template answers as grounded", () => {

    const context =
      contextWithProposal();

    expect(
      isGeneratedAnswerGrounded(
        "Proposal: Type Hints",
        context
      )
    ).toBe(true);

  });

});
