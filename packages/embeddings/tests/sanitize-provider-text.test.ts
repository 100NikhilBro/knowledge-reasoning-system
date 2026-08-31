import { describe, expect, it } from "vitest";

import { sanitizeProviderText }
from "../src/utils/sanitize-provider-text.js";

describe("sanitizeProviderText", () => {

  it("redacts explicit secrets and bearer tokens", () => {

    const secret = "sk-live-abcdef123456";

    const sanitized =
      sanitizeProviderText(
        `Authorization Bearer ${secret} failed`,
        [secret]
      );

    expect(sanitized).not.toContain(secret);
    expect(sanitized).toContain("[REDACTED]");

  });

});
