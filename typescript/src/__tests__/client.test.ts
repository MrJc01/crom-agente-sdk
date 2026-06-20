import { describe, it, expect, vi, beforeEach } from "vitest";
import { CromClient } from "../client.js";
import { parseDaemonPayload } from "../utils.js";

describe("SDK Utils", () => {
  it("should parse stringified JSON", () => {
    const payload = JSON.stringify({ event: "thinking", data: { provider: "gemini" } });
    const parsed = parseDaemonPayload(payload);
    expect(parsed.event).toBe("thinking");
    expect(parsed.data.provider).toBe("gemini");
  });

  it("should parse serialized Uint8Array object", () => {
    const originalObj = { event: "finished", data: { reason: "completed" } };
    const encoder = new TextEncoder();
    const encoded = encoder.encode(JSON.stringify(originalObj));
    
    // Serialized as key-value pairs (like Tauri does sometimes)
    const serialized: Record<string, number> = {};
    encoded.forEach((val, idx) => {
      serialized[idx.toString()] = val;
    });

    const parsed = parseDaemonPayload(serialized);
    expect(parsed.event).toBe("finished");
    expect(parsed.data.reason).toBe("completed");
  });

  it("should return raw value if not parseable", () => {
    expect(parseDaemonPayload("plain text")).toBe("plain text");
    expect(parseDaemonPayload(null)).toBeNull();
  });
});

describe("CromClient API", () => {
  let client: CromClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new CromClient({
      daemonHost: "127.0.0.1",
      daemonPort: 9090,
      cloudUrl: "https://cloud.ia.crom.run",
      sessionToken: "session-123",
      daemonToken: "daemon-456",
    });
  });

  it("should initialize options correctly", () => {
    const opts = client.getOptions();
    expect(opts.daemonHost).toBe("127.0.0.1");
    expect(opts.daemonPort).toBe(9090);
    expect(opts.sessionToken).toBe("session-123");
  });

  it("should update options dynamically", () => {
    client.updateOptions({ sessionToken: "new-session-789" });
    expect(client.getOptions().sessionToken).toBe("new-session-789");
  });

  it("should fetch daemon token successfully", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: "new-daemon-token" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const token = await client.getDaemonToken();
    expect(token).toBe("new-daemon-token");
    expect(client.getOptions().daemonToken).toBe("new-daemon-token");
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:9090/api/token");
  });

  it("should get system info with auth token query param", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ os: "linux" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const sysInfo = await client.getSystemInfo();
    expect(sysInfo.os).toBe("linux");
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:9090/api/system/info?token=daemon-456");
  });

  it("should get cloud models with Bearer header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "model-1" }],
    });
    vi.stubGlobal("fetch", fetchMock);

    const models = await client.getCloudModels();
    expect(models).toEqual([{ id: "model-1" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://cloud.ia.crom.run/api/v1/models",
      expect.objectContaining({
        headers: { Authorization: "Bearer session-123" },
      })
    );
  });
});

describe("CromClient WebSocket", () => {
  it("should call onopen and send subscribe message", () => {
    const sendMock = vi.fn();
    class MockWebSocket {
      url: string;
      onopen: any;
      onmessage: any;
      send = sendMock;
      readyState = 1;
      constructor(url: string) {
        this.url = url;
        setTimeout(() => {
          if (this.onopen) this.onopen();
        }, 5);
      }
      close() {}
    }

    const client = new CromClient({
      daemonHost: "127.0.0.1",
      daemonPort: 9090,
      WebSocketConstructor: MockWebSocket,
    });

    return new Promise<void>((resolve, reject) => {
      client.on("error", (err) => {
        console.error("Test WebSocket error emitted:", err);
        reject(err);
      });
      client.on("open", () => {
        setTimeout(() => {
          try {
            console.log("WebSocket open emitted and asserted in test");
            expect(sendMock).toHaveBeenCalledWith(JSON.stringify({ type: "subscribe", workspace: "/test/path" }));
            resolve();
          } catch (e) {
            reject(e);
          }
        }, 5);
      });
      try {
        client.connectWebSocket("/test/path");
      } catch (e) {
        console.error("connectWebSocket threw error:", e);
        reject(e);
      }
    });
  });
});
