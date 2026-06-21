import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestClient, TEST_SESSION_TOKEN } from "../config/testConfig.js";
import { CromClient } from "../../src/index.js";

describe("CromClient Cloud & Third-Party APIs", () => {
  let client: CromClient;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    client = createTestClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should get cloud user info with Bearer headers", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 99, email: "user@crom.run" }),
    });

    const user = await client.getCloudUser();
    expect(user.email).toBe("user@crom.run");
    expect(user.id).toBe(99);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://cloud.ia.crom.run/api/v1/admin/me",
      expect.objectContaining({
        headers: { Authorization: `Bearer ${TEST_SESSION_TOKEN}` },
      })
    );
  });

  it("should throw error if getCloudUser returns unauthorized status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Unauthorized",
    });

    await expect(client.getCloudUser()).rejects.toThrow("Failed to fetch cloud user: Unauthorized");
  });

  it("should get cloud models list with Authorization header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        object: "list",
        data: [{ id: "model-a" }, { id: "model-b" }]
      }),
    });

    const res = await client.getCloudModels();
    expect(res.data).toHaveLength(2);
    expect(res.data[0].id).toBe("model-a");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://cloud.ia.crom.run/api/v1/models",
      expect.objectContaining({
        headers: { Authorization: `Bearer ${TEST_SESSION_TOKEN}` },
      })
    );
  });

  it("should get latest software release without authorization header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: "v1.2.3" }),
    });

    const rel = await client.getLatestRelease();
    expect(rel.version).toBe("v1.2.3");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://cloud.ia.crom.run/api/v1/github/releases?repo=crom-agente"
    );
  });

  it("should fetch OpenRouter models without auth header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: "openai/gpt-4o" }] }),
    });

    const res = await client.getOpenRouterModels();
    expect(res.data[0].id).toBe("openai/gpt-4o");
    expect(mockFetch).toHaveBeenCalledWith("https://openrouter.ai/api/v1/models");
  });
});
