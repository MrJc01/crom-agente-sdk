import { IFileSystemAdapter, IShellAdapter, Process, ExecResult } from "../types.js";
import * as fs from "fs/promises";
import { spawn, exec, execFile } from "child_process";
import * as util from "util";
import * as os from "os";

const execAsync = util.promisify(exec);
const execFileAsync = util.promisify(execFile);

export class NodeFileSystemAdapter implements IFileSystemAdapter {
  async readFile(path: string): Promise<string> {
    return fs.readFile(path, "utf-8");
  }

  async writeFile(path: string, content: string): Promise<void> {
    await fs.writeFile(path, content, "utf-8");
  }

  async writeBinaryFile(path: string, data: Uint8Array): Promise<void> {
    await fs.writeFile(path, data);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fs.stat(path);
      return true;
    } catch {
      return false;
    }
  }

  async chmod(path: string, mode: number): Promise<void> {
    await fs.chmod(path, mode);
  }

  async mkdir(path: string, recursive: boolean): Promise<void> {
    await fs.mkdir(path, { recursive });
  }
}

export class NodeShellAdapter implements IShellAdapter {
  async spawn(cmd: string, args: string[]): Promise<Process> {
    const child = spawn(cmd, args, { stdio: "pipe", shell: process.platform === "win32" });
    
    let onStdoutCb: (data: string) => void = () => {};
    let onStderrCb: (data: string) => void = () => {};
    let onCloseCb: (code: number) => void = () => {};

    if (child.stdout) {
      child.stdout.on("data", (data) => onStdoutCb(data.toString()));
    }
    
    if (child.stderr) {
      child.stderr.on("data", (data) => onStderrCb(data.toString()));
    }

    child.on("close", (code) => {
      onCloseCb(code ?? 0);
    });

    child.on("error", (err) => {
      onStderrCb(`Error: ${err.message}`);
    });

    return {
      pid: child.pid,
      onStdout: (cb) => { onStdoutCb = cb; },
      onStderr: (cb) => { onStderrCb = cb; },
      onClose: (cb) => { onCloseCb = cb; },
      kill: async () => {
        child.kill();
      }
    };
  }

  async exec(cmd: string, args: string[]): Promise<ExecResult> {
    const { stdout, stderr } = await execFileAsync(cmd, args);
    return { stdout, stderr };
  }

  async kill(pid: number): Promise<void> {
    if (os.platform() === "win32") {
      await execAsync(`taskkill /F /T /PID ${pid}`);
    } else {
      process.kill(pid, "SIGKILL");
    }
  }

  async isProcessRunning(name: string): Promise<boolean> {
    try {
      if (os.platform() === "win32") {
        const { stdout } = await execAsync("tasklist");
        return stdout.toLowerCase().includes(name.toLowerCase());
      } else {
        await execAsync(`pgrep -x ${name}`);
        return true;
      }
    } catch {
      return false;
    }
  }
}
