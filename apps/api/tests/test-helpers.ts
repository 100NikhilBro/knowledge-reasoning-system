import {
  createApp,
  type ApiDependencies
} from "../src/app.js";

import {
  API_KEY_HEADER
} from "../src/middleware/api-key-auth.js";

export const TEST_API_KEY =
  "test-api-key-not-a-secret-for-ci";

export function testSecurityConfig(
  overrides: Partial<{
    apiKey: string;
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
  }> = {}
) {

  return {

    apiKey: TEST_API_KEY,

    rateLimitWindowMs: 60_000,

    rateLimitMaxRequests: 1_000,

    ...overrides

  };

}

export function createTestApp(
  dependencies: ApiDependencies = {}
) {

  return createApp({

    ...dependencies,

    securityConfig:
      dependencies.securityConfig ??
      testSecurityConfig()

  });

}

export function authHeaders(
  apiKey: string = TEST_API_KEY
): Record<string, string> {

  return {

    [API_KEY_HEADER]:
      apiKey

  };

}
