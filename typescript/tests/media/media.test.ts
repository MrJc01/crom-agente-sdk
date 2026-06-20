import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestClient, TEST_DAEMON_TOKEN } from "../config/testConfig.js";
import { CromClient } from "../../src/index.js";

describe("CromClient Media & Recording API", () => {
  let client: CromClient;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    client = createTestClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should list audio devices", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ["default-mic", "usb-mic"],
    });

    const devices = await client.getAudioDevices();
    expect(devices).toContain("default-mic");
    expect(devices).toHaveLength(2);

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("/api/devices/audio");
    expect(calledUrl).toContain(`token=${TEST_DAEMON_TOKEN}`);
  });

  it("should list screen devices", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ["monitor-0", "monitor-1"],
    });

    const devices = await client.getScreenDevices();
    expect(devices).toContain("monitor-1");

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("/api/devices/screens");
  });

  it("should start audio recording with parameters", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "recording" }),
    });

    const params = { device: "usb-mic", sample_rate: "16000" };
    const res = await client.startRecording("audio", params);
    expect(res.status).toBe("recording");

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("/api/record/start");
    expect(calledUrl).toContain("type=audio");
    expect(calledUrl).toContain("device=usb-mic");
    expect(calledUrl).toContain("sample_rate=16000");
  });

  it("should stop recording and return audio blob", async () => {
    const fakeBlob = new Blob(["wav-payload"], { type: "audio/wav" });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => fakeBlob,
    });

    const blob = await client.stopRecording("audio");
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("audio/wav");

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("/api/record/stop");
    expect(calledUrl).toContain("type=audio");
  });

  it("should transcribe audio blob with Content-Type header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "antigravity test transcription" }),
    });

    const audioBlob = new Blob(["bytes"], { type: "audio/wav" });
    const res = await client.transcribeAudio(audioBlob);
    expect(res.text).toBe("antigravity test transcription");

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("/api/transcribe");
    expect(mockFetch.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: audioBlob,
        headers: { "Content-Type": "audio/wav" },
      })
    );
  });

  it("should throw error if media APIs return non-OK statuses", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Device Busy",
    });

    await expect(client.getAudioDevices()).rejects.toThrow("Failed to fetch audio devices: Device Busy");
  });
});
