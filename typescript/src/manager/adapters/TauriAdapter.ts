import { IFileSystemAdapter, IShellAdapter, Process, ExecResult } from "../types.js";

export class TauriFileSystemAdapter implements IFileSystemAdapter {
  async readFile(path: string): Promise<string> {
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    return readTextFile(path);
  }

  async writeFile(path: string, content: string): Promise<void> {
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    await writeTextFile(path, content);
  }

  async writeBinaryFile(path: string, data: Uint8Array): Promise<void> {
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    await writeFile(path, data);
  }

  async exists(path: string): Promise<boolean> {
    const { exists } = await import("@tauri-apps/plugin-fs");
    return exists(path);
  }

  async chmod(path: string, mode: number): Promise<void> {
    // Tauri FS plugin doesn't have native chmod. We will use shell as a fallback.
    const { Command } = await import("@tauri-apps/plugin-shell");
    try {
      await Command.create("chmod", [mode.toString(8), path]).execute();
    } catch (e) {
      console.warn(`Failed to chmod ${path} via Tauri shell. Assuming ok on Windows.`, e);
    }
  }

  async mkdir(path: string, recursive: boolean): Promise<void> {
    const { mkdir } = await import("@tauri-apps/plugin-fs");
    await mkdir(path, { recursive });
  }
}

export class TauriShellAdapter implements IShellAdapter {
  async spawn(cmd: string, args: string[]): Promise<Process> {
    const { Command } = await import("@tauri-apps/plugin-shell");
    const command = Command.create(cmd, args);
    let child: any = null;
    let onStdoutCb: (data: string) => void = () => {};
    let onStderrCb: (data: string) => void = () => {};
    let onCloseCb: (code: number) => void = () => {};

    command.on("close", (data: any) => {
      onCloseCb(data.code);
    });

    command.on("error", (error: any) => {
      onStderrCb(`Error: ${error}`);
    });

    command.stdout.on("data", (line: string) => {
      onStdoutCb(line);
    });

    command.stderr.on("data", (line: string) => {
      onStderrCb(line);
    });

    child = await command.spawn();

    return {
      pid: child.pid,
      onStdout: (cb) => { onStdoutCb = cb; },
      onStderr: (cb) => { onStderrCb = cb; },
      onClose: (cb) => { onCloseCb = cb; },
      kill: async () => {
        if (child) {
          await child.kill();
        }
      }
    };
  }

  async exec(cmd: string, args: string[]): Promise<ExecResult> {
    const { Command } = await import("@tauri-apps/plugin-shell");
    const output = await Command.create(cmd, args).execute();
    return {
      stdout: output.stdout,
      stderr: output.stderr
    };
  }

  async kill(pid: number): Promise<void> {
    const { type } = await import("@tauri-apps/plugin-os");
    const osType = await type();
    const { Command } = await import("@tauri-apps/plugin-shell");
    
    if (osType === "windows") {
      await Command.create("taskkill", ["/F", "/T", "/PID", pid.toString()]).execute();
    } else {
      await Command.create("kill", ["-9", pid.toString()]).execute();
    }
  }

  async isProcessRunning(name: string): Promise<boolean> {
    const { type } = await import("@tauri-apps/plugin-os");
    const osType = await type();
    const { Command } = await import("@tauri-apps/plugin-shell");

    try {
      if (osType === "windows") {
        const out = await Command.create("tasklist").execute();
        return out.stdout.toLowerCase().includes(name.toLowerCase());
      } else {
        const out = await Command.create("pgrep", ["-x", name]).execute();
        return out.code === 0;
      }
    } catch (e) {
      return false;
    }
  }
}
