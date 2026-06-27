import { IFileSystemAdapter, IShellAdapter, ManagerEvents } from "./types.js";
import { BinaryDownloader } from "./BinaryDownloader.js";

export class OllamaManager {
  private fs: IFileSystemAdapter;
  private shell: IShellAdapter;
  private downloader: BinaryDownloader;
  private process: any | null = null;

  constructor(fsAdapter: IFileSystemAdapter, shellAdapter: IShellAdapter) {
    this.fs = fsAdapter;
    this.shell = shellAdapter;
    this.downloader = new BinaryDownloader();
  }

  async isInstalled(): Promise<boolean> {
    try {
      const result = await this.shell.exec("ollama", ["-v"]);
      return result.stdout.includes("ollama");
    } catch (e) {
      return false;
    }
  }

  async install(events?: ManagerEvents): Promise<void> {
    const isInst = await this.isInstalled();
    if (isInst) return;
    await this.downloader.installOllama(events);
  }

  async start(events?: ManagerEvents): Promise<void> {
    const isRunning = await this.status();
    if (isRunning) return;
    events?.onInstallProgress?.(10, "Starting Ollama...");
    this.process = await this.shell.spawn("ollama", ["serve"]);
    events?.onStart?.();
  }

  async stop(): Promise<void> {
    if (this.process && this.process.pid) {
      await this.shell.kill(this.process.pid);
      this.process = null;
    } else {
      const isWin = (await this.downloader.getOsInfo()).platform === "win32";
      const name = isWin ? "ollama.exe" : "ollama";
      if (await this.shell.isProcessRunning(name)) {
        if (isWin) {
          await this.shell.exec("taskkill", ["/F", "/IM", name]);
        } else {
          await this.shell.exec("pkill", ["-x", name]);
        }
      }
    }
  }

  async status(): Promise<boolean> {
    const isWin = (await this.downloader.getOsInfo()).platform === "win32";
    const name = isWin ? "ollama.exe" : "ollama";
    return this.shell.isProcessRunning(name);
  }
}
