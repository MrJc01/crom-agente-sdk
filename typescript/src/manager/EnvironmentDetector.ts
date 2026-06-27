import { EnvironmentType } from "./types.js";

export function detectEnvironment(): EnvironmentType {
  // Check if running inside Tauri context
  if (
    typeof window !== "undefined" && 
    (
      (window as any).__TAURI_INTERNALS__ !== undefined || 
      (window as any).__TAURI_IPC__ !== undefined
    )
  ) {
    return EnvironmentType.Tauri;
  }
  
  // Check if running in Node.js
  if (typeof process !== "undefined" && process.versions && process.versions.node) {
    return EnvironmentType.Node;
  }
  
  // Fallback to pure browser
  return EnvironmentType.Browser;
}
