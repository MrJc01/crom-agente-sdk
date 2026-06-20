import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestClient, TEST_DAEMON_TOKEN } from "../config/testConfig.js";
import { CromClient } from "../../src/index.js";

describe("CromClient System & Daemon API", () => {
  let client: CromClient;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    client = createTestClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should retrieve system info with correct daemon token", async () => {
    const mockData = { os: "linux", arch: "amd64", uptime: 100 };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const info = await client.getSystemInfo();
    expect(info.os).toBe("linux");
    expect(info.uptime).toBe(100);

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("/api/system/info");
    expect(calledUrl).toContain(`token=${TEST_DAEMON_TOKEN}`);
  });

  it("should throw error if getSystemInfo fails (HTTP error status)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Internal Server Error",
    });

    await expect(client.getSystemInfo()).rejects.toThrow("Failed to fetch system info: Internal Server Error");
  });

  it("should retrieve tags (Ollama models)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ["llama3", "codellama"],
    });

    const tags = await client.getTags();
    expect(tags).toContain("llama3");

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("/api/tags");
    expect(calledUrl).toContain(`token=${TEST_DAEMON_TOKEN}`);
  });

  it("should throw error if getTags fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Bad Gateway",
    });

    await expect(client.getTags()).rejects.toThrow("Failed to fetch tags: Bad Gateway");
  });

  it("should stop daemon for a given workspace", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const res = await client.stopDaemon("my-workspace");
    expect(res.success).toBe(true);

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("/stop");
    expect(calledUrl).toContain(`token=${TEST_DAEMON_TOKEN}`);
    expect(mockFetch.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ workspace: "my-workspace" }),
      })
    );
  });

  it("should stop daemon without workspace argument", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const res = await client.stopDaemon();
    expect(res.success).toBe(true);

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("/stop");
    expect(mockFetch.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: undefined,
      })
    );
  });

  it("should throw error if stopDaemon fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Unauthorized",
    });

    await expect(client.stopDaemon()).rejects.toThrow("Failed to stop daemon: Unauthorized");
  });
});
