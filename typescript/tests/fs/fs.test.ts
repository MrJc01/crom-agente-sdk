import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestClient, TEST_DAEMON_TOKEN } from "../config/testConfig.js";
import { CromClient } from "../../src/index.js";

describe("CromClient Filesystem API", () => {
  let client: CromClient;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    client = createTestClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("listFiles", () => {
    it("should list files in standard path", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ name: "src", isDir: true }, { name: "index.ts", isDir: false }],
      });

      const files = await client.listFiles("/my/project");
      expect(files).toHaveLength(2);
      expect(files[0].name).toBe("src");
      expect(files[1].name).toBe("index.ts");

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("/api/files");
      expect(calledUrl).toContain(`token=${TEST_DAEMON_TOKEN}`);
      expect(calledUrl).toContain("path=%2Fmy%2Fproject");
    });

    it("should list files with spaces and special chars in path", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await client.listFiles("/my path/project & code");
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("path=%2Fmy+path%2Fproject+%26+code" || "path=%2Fmy%20path%2Fproject%20%26%20code");
    });

    it("should throw error if listFiles returns HTTP error status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Forbidden",
      });

      await expect(client.listFiles("/root")).rejects.toThrow("Failed to list files: Forbidden");
    });
  });

  describe("readFile", () => {
    it("should read standard text file", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "import { something } from 'somewhere';",
      });

      const content = await client.readFile("/my/project/index.ts");
      expect(content).toBe("import { something } from 'somewhere';");

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("/api/file");
      expect(calledUrl).toContain("path=%2Fmy%2Fproject%2Findex.ts");
    });

    it("should throw error if readFile returns HTTP error status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Not Found",
      });

      await expect(client.readFile("/ghost.ts")).rejects.toThrow("Failed to read file: Not Found");
    });
  });

  describe("writeFile", () => {
    it("should write text file with body format", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const res = await client.writeFile("/my/project/index.ts", "console.log('hi');");
      expect(res.success).toBe(true);

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("/api/file");
      expect(calledUrl).toContain(`token=${TEST_DAEMON_TOKEN}`);
      expect(mockFetch.mock.calls[0][1]).toEqual(
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: "/my/project/index.ts", content: "console.log('hi');" }),
        })
      );
    });

    it("should throw error if writeFile fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Bad Request",
      });

      await expect(client.writeFile("/read-only.ts", "content")).rejects.toThrow("Failed to write file: Bad Request");
    });
  });
});
