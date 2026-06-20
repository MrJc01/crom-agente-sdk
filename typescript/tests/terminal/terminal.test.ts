import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestClient, TEST_DAEMON_TOKEN } from "../config/testConfig.js";
import { CromClient } from "../../src/index.js";

describe("CromClient Terminals API", () => {
  let client: CromClient;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    client = createTestClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should list active terminals", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ["term-1", "term-2", "term-3"],
    });

    const list = await client.getTerminals();
    expect(list).toHaveLength(3);
    expect(list).toContain("term-2");

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("/api/terminal/list");
    expect(calledUrl).toContain(`token=${TEST_DAEMON_TOKEN}`);
  });

  it("should throw error if getTerminals fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Internal Error",
    });

    await expect(client.getTerminals()).rejects.toThrow("Failed to fetch terminal list: Internal Error");
  });

  it("should close a terminal session using parameter query string", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ closed: true }),
    });

    const res = await client.closeTerminal("term-xyz");
    expect(res.closed).toBe(true);

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("/api/terminal/close");
    expect(calledUrl).toContain(`token=${TEST_DAEMON_TOKEN}`);
    expect(calledUrl).toContain("id=term-xyz");
    expect(mockFetch.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("should throw error if closeTerminal fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Not Found",
    });

    await expect(client.closeTerminal("non-existent")).rejects.toThrow("Failed to close terminal: Not Found");
  });
});
