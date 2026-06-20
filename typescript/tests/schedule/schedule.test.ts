import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestClient, TEST_DAEMON_TOKEN } from "../config/testConfig.js";
import { CromClient } from "../../src/index.js";

describe("CromClient Scheduled Tasks API", () => {
  let client: CromClient;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    client = createTestClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should get active scheduled tasks", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "cron-1", name: "backup" }],
    });

    const tasks = await client.getScheduledTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].name).toBe("backup");

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("/api/schedule");
    expect(calledUrl).toContain(`token=${TEST_DAEMON_TOKEN}`);
  });

  it("should throw error if getScheduledTasks fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Bad Gateway",
    });

    await expect(client.getScheduledTasks()).rejects.toThrow("Failed to fetch scheduled tasks: Bad Gateway");
  });

  it("should add a new scheduled task with JSON payload", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const taskObj = { name: "test-task", cron: "*/5 * * * *", workspace: "/proj", task: "cmd" };
    const res = await client.addScheduledTask(taskObj);
    expect(res.success).toBe(true);

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("/api/schedule");
    expect(mockFetch.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskObj),
      })
    );
  });

  it("should throw error if addScheduledTask fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Conflict",
    });

    const taskObj = { name: "test-task", cron: "*/5 * * * *", workspace: "/proj", task: "cmd" };
    await expect(client.addScheduledTask(taskObj)).rejects.toThrow("Failed to add scheduled task: Conflict");
  });

  it("should delete a scheduled task using DELETE method and query param ID", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const res = await client.deleteScheduledTask("cron-123");
    expect(res.success).toBe(true);

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("/api/schedule");
    expect(calledUrl).toContain("id=cron-123");
    expect(mockFetch.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "DELETE",
      })
    );
  });

  it("should throw error if deleteScheduledTask fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Not Found",
    });

    await expect(client.deleteScheduledTask("cron-abc")).rejects.toThrow("Failed to delete scheduled task: Not Found");
  });

  it("should run a scheduled task immediately with POST method and query param ID", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const res = await client.runScheduledTask("cron-456");
    expect(res.success).toBe(true);

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("/api/schedule/run");
    expect(calledUrl).toContain("id=cron-456");
    expect(mockFetch.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("should throw error if runScheduledTask fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Internal Error",
    });

    await expect(client.runScheduledTask("cron-456")).rejects.toThrow("Failed to run scheduled task: Internal Error");
  });
});
