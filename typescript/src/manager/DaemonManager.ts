import { IFileSystemAdapter, IShellAdapter, ManagerEvents, DaemonConfig, Process } from "./types.js";
import { BinaryDownloader } from "./BinaryDownloader.js";

export class DaemonManager {
  private fs: IFileSystemAdapter;
  private shell: IShellAdapter;
  private downloader: BinaryDownloader;
  private process: Process | null = null;
  private config: DaemonConfig;

  constructor(fsAdapter: IFileSystemAdapter, shellAdapter: IShellAdapter, config: DaemonConfig = {}) {
    this.fs = fsAdapter;
    this.shell = shellAdapter;
    this.downloader = new BinaryDownloader();
    this.config = config;
  }

  private async getHomeDir(): Promise<string> {
    if (typeof process !== "undefined" && process.env) {
      return process.env.HOME || process.env.USERPROFILE || "";
    }
    const { homeDir } = await import("@tauri-apps/api/path");
    return homeDir();
  }

  private async getBinPath(): Promise<string> {
    if (this.config.path) return this.config.path;
    const home = await this.getHomeDir();
    const isWin = (await this.downloader.getOsInfo()).platform === "win32";
    return `${home}/.crom/bin/crom-agente${isWin ? '.exe' : ''}`;
  }

  async isInstalled(): Promise<boolean> {
    const binPath = await this.getBinPath();
    return this.fs.exists(binPath);
  }

  async install(events?: ManagerEvents): Promise<void> {
    const isInst = await this.isInstalled();
    if (isInst) return;

    const home = await this.getHomeDir();
    const cromDir = `${home}/.crom`;
    const binDir = `${cromDir}/bin`;
    const downloadDir = `${cromDir}/downloads`;

    try {
      await this.fs.mkdir(binDir, true);
      await this.fs.mkdir(downloadDir, true);
    } catch (e: any) {
      if (e.message?.includes('EPERM') || e.message?.includes('EACCES')) {
        throw new Error(`Permissão negada ao criar diretório ${cromDir}. Execute como administrador ou altere o dono da pasta.`);
      }
      throw e;
    }

    const isWin = (await this.downloader.getOsInfo()).platform === "win32";
    const expectedBinName = `crom-agente${isWin ? '.exe' : ''}`;

    let downloaded = false;
    try {
      const asset = await this.downloader.getAssetUrlForPlatform();
      const archivePath = `${downloadDir}/${asset.name}`;

      await this.downloader.downloadAsset(asset.url, archivePath, events);
      
      events?.onInstallProgress?.(80, "Extracting...");
      await this.downloader.extractArchive(archivePath, binDir);
      downloaded = true;
    } catch (e: any) {
      console.warn("Download failed, checking local fallback...", e.message);
    }

    if (!downloaded) {
      events?.onInstallProgress?.(50, "Checking local fallback...");
      const fallbackSuccess = await this.downloader.checkLocalFallback(binDir, expectedBinName);
      if (!fallbackSuccess) {
        throw new Error("Falha ao baixar Daemon e não foi encontrado fallback local.");
      }
    }
    const binPath = await this.getBinPath();
    if (await this.fs.exists(binPath)) {
      await this.fs.chmod(binPath, 0o755);
      const osInfo = await this.downloader.getOsInfo();
      if (osInfo.platform === "darwin") {
        try { await this.shell.exec("xattr", ["-d", "com.apple.quarantine", binPath]); } catch(e){}
      }
    }
    
    events?.onInstallProgress?.(100, "Daemon Installed");
  }

  async start(events?: ManagerEvents): Promise<void> {
    const isRunning = await this.status();
    if (isRunning.running) return;

    const binPath = await this.getBinPath();
    const args = ["daemon", "start"];
    
    if (this.config.port) args.push("--port", this.config.port.toString());
    
    events?.onInstallProgress?.(10, "Starting Daemon...");

    const isWin = (await this.downloader.getOsInfo()).platform === "win32";
    let spawnCmd = isWin ? "powershell" : "sh";
    let spawnArgs = isWin 
      ? ["-Command", `& '${binPath}' ${args.join(" ")}`]
      : ["-c", `'${binPath}' ${args.join(" ")}`];

    this.process = await this.shell.spawn(spawnCmd, spawnArgs);
    
    const home = await this.getHomeDir();
    const logPath = `${home}/.crom/daemon.log`;
    
    this.process.onStdout((data) => {
      events?.onLog?.(data);
    });
    
    this.process.onStderr((data) => {
      events?.onLog?.(data);
    });

    events?.onStart?.();
  }

  async stop(): Promise<void> {
    this.process = null;
      const isWin = (await this.downloader.getOsInfo()).platform === "win32";
      const name = isWin ? "crom-agente.exe" : "crom-agente";
      const running = await this.shell.isProcessRunning(name);
      if (running) {
        if (isWin) {
          await this.shell.exec("taskkill", ["/F", "/IM", name]);
        } else {
          await this.shell.exec("pkill", ["-x", name]);
        }
      }
  }

  async status(): Promise<{ running: boolean, version: string }> {
    const isWin = (await this.downloader.getOsInfo()).platform === "win32";
    const name = isWin ? "crom-agente.exe" : "crom-agente";
    const running = await this.shell.isProcessRunning(name);
    
    let version = "unknown";
    if (running) {
       try {
         version = await this.getVersion();
       } catch (e) {}
    }
    return { running, version };
  }

  async getVersion(): Promise<string> {
    const binPath = await this.getBinPath();
    if (!(await this.fs.exists(binPath))) return "not_installed";
    
    try {
      const isWin = (await this.downloader.getOsInfo()).platform === "win32";
      let execCmd = isWin ? "powershell" : "sh";
      let execArgs = isWin 
        ? ["-Command", `& '${binPath}' version`]
        : ["-c", `'${binPath}' version`];

      const result = await this.shell.exec(execCmd, execArgs);
      return result.stdout.trim();
    } catch (e) {
      return "unknown";
    }
  }

  async getToken(): Promise<string | null> {
    const home = await this.getHomeDir();
    const tokenPath = `${home}/.crom/session_token`;
    if (await this.fs.exists(tokenPath)) {
      return (await this.fs.readFile(tokenPath)).trim();
    }
    return null;
  }
}
