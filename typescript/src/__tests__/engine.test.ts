import { describe, it, expect, vi, beforeEach } from "vitest";
import { CromAgentEngine } from "../engine.js";

describe("CromAgentEngine", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should instantiate with default options", () => {
    const engine = new CromAgentEngine();
    expect(engine).toBeInstanceOf(CromAgentEngine);
  });

  it("should configure pure reasoning mode with 0 allowed tools", () => {
    const engine = new CromAgentEngine({
      toolsConfig: { mode: "none" }
    });

    const allowedTools = (engine as any).resolveAllowedTools();
    expect(allowedTools).toEqual([]);
  });

  it("should configure 'only' tools filter mode", () => {
    const engine = new CromAgentEngine({
      toolsConfig: { mode: "only", list: ["http_client", "database_tester"] }
    });

    const allowedTools = (engine as any).resolveAllowedTools();
    expect(allowedTools).toEqual(["http_client", "database_tester"]);
  });

  it("should configure 'except' tools filter mode", () => {
    const engine = new CromAgentEngine({
      toolsConfig: { mode: "except", list: ["write_file", "terminal_command"] }
    });

    const allowedTools = (engine as any).resolveAllowedTools();
    expect(allowedTools).not.toContain("write_file");
    expect(allowedTools).not.toContain("terminal_command");
    expect(allowedTools).toContain("read_file");
  });
});
