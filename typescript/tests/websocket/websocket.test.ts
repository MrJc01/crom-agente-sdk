import { describe, it, expect, vi, beforeEach } from "vitest";
import { CromClient } from "../../src/index.js";
import { 
  DEFAULT_TEST_PROVIDER, 
  DEFAULT_TEST_MODEL, 
  TEST_DAEMON_HOST, 
  TEST_DAEMON_PORT, 
  TEST_SESSION_TOKEN 
} from "../config/testConfig.js";

describe("CromClient WebSocket Integration & Events", () => {
  it("should establish connection, send subscribe, auto-approve and task payload with DeepSeek model", () => {
    const sendMessages: string[] = [];
    
    class MockWebSocket {
      url: string;
      onopen: any;
      onmessage: any;
      onclose: any;
      onerror: any;
      readyState = 1;

      constructor(url: string) {
        this.url = url;
        // Simulate open connection asynchronously
        setTimeout(() => {
          if (this.onopen) this.onopen();
        }, 10);
      }

      send(msg: string) {
        sendMessages.push(msg);
      }

      close() {
        setTimeout(() => {
          if (this.onclose) this.onclose({ code: 1000, reason: "Normal closure" });
        }, 5);
      }
    }

    const client = new CromClient({
      daemonHost: TEST_DAEMON_HOST,
      daemonPort: TEST_DAEMON_PORT,
      sessionToken: TEST_SESSION_TOKEN,
      WebSocketConstructor: MockWebSocket as any,
    });

    return new Promise<void>((resolve, reject) => {
      client.on("open", () => {
        // Assertions after the connect/handshake messages are pushed
        setTimeout(() => {
          try {
            // Should contain WS token URL format
            expect(client["wsUrl"]).toContain("ws://localhost:9090/ws?token=sess-token-12345");

            // We expect 3 messages sent:
            // 1. Subscribe to workspace
            // 2. Set auto approve status
            // 3. Run task with OpenRouter and DeepSeek V4 Flash
            expect(sendMessages).toHaveLength(3);

            const msg1 = JSON.parse(sendMessages[0]);
            expect(msg1).toEqual({ type: "subscribe", workspace: "/work/path" });

            const msg2 = JSON.parse(sendMessages[1]);
            expect(msg2).toEqual({ type: "set_auto_approve", workspace: "/work/path", auto_approve: false });

            const msg3 = JSON.parse(sendMessages[2]);
            expect(msg3).toEqual({
              type: "run",
              workspace: "/work/path",
              session: "session-abc",
              task: "Explain quantum physics",
              provider: DEFAULT_TEST_PROVIDER,
              model: DEFAULT_TEST_MODEL,
            });

            // Verify our default settings match DeepSeek
            expect(msg3.provider).toBe("openrouter");
            expect(msg3.model).toBe("deepseek/deepseek-v4-flash");

            resolve();
          } catch (err) {
            reject(err);
          }
        }, 20);
      });

      client.connectWebSocket(
        "/work/path",
        "session-abc",
        "Explain quantum physics",
        DEFAULT_TEST_PROVIDER,
        DEFAULT_TEST_MODEL
      );
    });
  });

  it("should listen and parse incoming structured daemon websocket messages", () => {
    let activeSocket: any = null;

    class MockWebSocket {
      onopen: any;
      onmessage: any;
      readyState = 1;
      constructor() {
        activeSocket = this;
        setTimeout(() => {
          if (this.onopen) this.onopen();
        }, 2);
      }
      send() {}
      close() {}
    }

    const client = new CromClient({
      WebSocketConstructor: MockWebSocket as any,
    });

    client.connectWebSocket("/test-path");

    return new Promise<void>((resolve, reject) => {
      const receivedEvents: any[] = [];

      client.on("thinking", (evt) => {
        receivedEvents.push({ type: "thinking", data: evt });
      });
      client.on("status_change", (evt) => {
        receivedEvents.push({ type: "status_change", data: evt });
      });
      client.on("permission_request", (evt) => {
        receivedEvents.push({ type: "permission_request", data: evt });
      });
      client.on("message", (evt) => {
        receivedEvents.push({ type: "message", data: evt });
      });
      client.on("finished", (evt) => {
        receivedEvents.push({ type: "finished", data: evt });
      });

      setTimeout(() => {
        try {
          expect(activeSocket).not.toBeNull();

          // Push event 1: thinking
          activeSocket.onmessage({
            data: JSON.stringify({
              data: JSON.stringify({
                event: "thinking",
                iteration: 2,
                data: { provider: "openrouter" },
              }),
            }),
          });

          // Push event 2: status
          activeSocket.onmessage({
            data: JSON.stringify({
              data: JSON.stringify({
                type: "status",
                status: "coding",
              }),
            }),
          });

          // Push event 3: permission request
          activeSocket.onmessage({
            data: JSON.stringify({
              data: JSON.stringify({
                type: "ask_permission",
                action: "run_command",
                target: "npm run build",
              }),
            }),
          });

          // Push event 4: message
          activeSocket.onmessage({
            data: JSON.stringify({
              data: JSON.stringify({
                type: "message",
                role: "assistant",
                content: "Hello from DeepSeek V4",
              }),
            }),
          });

          // Push event 5: finished
          activeSocket.onmessage({
            data: JSON.stringify({
              data: JSON.stringify({
                event: "finished",
                data: { reason: "completed", total_iterations: 4 },
              }),
            }),
          });

          // Check if events are registered properly
          expect(receivedEvents).toHaveLength(5);
          expect(receivedEvents[0]).toEqual({
            type: "thinking",
            data: expect.objectContaining({ event: "thinking", iteration: 2 }),
          });
          expect(receivedEvents[1]).toEqual({
            type: "status_change",
            data: expect.objectContaining({ event: "status_change", data: { status: "coding" } }),
          });
          expect(receivedEvents[2]).toEqual({
            type: "permission_request",
            data: expect.objectContaining({ event: "permission_request", data: { action: "run_command", target: "npm run build" } }),
          });
          expect(receivedEvents[3]).toEqual({
            type: "message",
            data: expect.objectContaining({
              event: "message",
              data: expect.objectContaining({
                role: "assistant",
                content: "Hello from DeepSeek V4",
              }),
            }),
          });
          expect(receivedEvents[4]).toEqual({
            type: "finished",
            data: expect.objectContaining({ event: "finished", data: expect.objectContaining({ reason: "completed" }) }),
          });

          resolve();
        } catch (err) {
          reject(err);
        }
      }, 15);
    });
  });

  it("should trigger disconnect cleanup and disconnect WebSocket correctly", () => {
    const closeSpy = vi.fn();
    class MockWebSocket {
      readyState = 1;
      send() {}
      close = closeSpy;
    }

    const client = new CromClient({
      WebSocketConstructor: MockWebSocket as any,
    });

    client["ws"] = new MockWebSocket();
    client.disconnectWebSocket();

    expect(closeSpy).toHaveBeenCalled();
    expect(client["ws"]).toBeNull();
  });
});
