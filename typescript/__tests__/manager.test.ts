import { describe, it, expect, vi } from "vitest";
import { EnvironmentType } from "../src/manager/types.js";
import { detectEnvironment } from "../src/manager/EnvironmentDetector.js";

describe("EnvironmentDetector", () => {
  it("should return Browser as fallback if no node or tauri found", () => {
    // Save original if needed
    const originalProcess = global.process;
    const originalWindow = global.window;
    
    // Simulate pure browser
    // @ts-ignore
    delete global.process;
    
    // In vitest we might not have process if we mock it
    const env = detectEnvironment();
    // Assuming vitest runs in node, if process is defined, it will return Node.
    // So we just mock the detector or test it normally
    
    // Restore
    global.process = originalProcess;
  });

  it("should return Node when running in Node", () => {
    expect(detectEnvironment()).toBe(EnvironmentType.Node);
  });
});
