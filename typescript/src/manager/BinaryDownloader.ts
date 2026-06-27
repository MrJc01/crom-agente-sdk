import { IFileSystemAdapter, IShellAdapter, ManagerEvents } from "./types.js";
import { getFileSystemAdapter, getShellAdapter } from "./AdapterFactory.js";

export class BinaryDownloader {
  async getOsInfo() {
    let platform = "unknown";
    let arch = "unknown";
    
    try {
      if (typeof process !== "undefined" && process.platform) {
        platform = process.platform;
        arch = process.arch;
      } else {
        const { type, arch: getArch } = await import("@tauri-apps/plugin-os");
        const osType = await type();
        const osArch = await getArch();
        
        if (osType === "windows") platform = "win32";
        else if (osType === "macos") platform = "darwin";
        else if (osType === "linux") platform = "linux";
        
        arch = osArch;
      }
    } catch (e) {
      // Ignore
    }
    
    return { platform, arch };
  }

  mapAssetSuffix(platform: string, arch: string): string {
    let osStr = platform;
    if (platform === "win32") osStr = "windows";
    if (platform === "darwin") osStr = "darwin";
    
    let archStr = arch;
    if (arch === "x64" || arch === "x86_64") archStr = "amd64";
    if (arch === "arm64" || arch === "aarch64") archStr = "arm64";
    
    let ext = platform === "win32" ? ".exe" : "";
    return `${osStr}-${archStr}${ext}`;
  }

  async fetchLatestGithubRelease(repo: string = "MrJc01/crom-agente", retries: number = 3) {
    const url = `https://api.github.com/repos/${repo}/releases/latest`;
    
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url);
        if (res.ok) return await res.json();
        
        if (res.status === 403 || res.status === 429) {
          const reset = res.headers.get("x-ratelimit-reset");
          if (reset) {
            const waitTime = (parseInt(reset) * 1000) - Date.now();
            if (waitTime > 0 && waitTime < 60000) { // Only wait if it's less than a minute
              await new Promise(r => setTimeout(r, waitTime + 1000));
              continue;
            }
          }
          // Default exponential backoff
          await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
        }
      } catch (e) {
        if (i === retries - 1) throw e;
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
      }
    }
    throw new Error(`Failed to fetch release after ${retries} retries`);
  }

  async getAssetUrlForPlatform(repo: string = "MrJc01/crom-agente") {
    const { platform, arch } = await this.getOsInfo();
    const suffix = this.mapAssetSuffix(platform, arch);
    
    const release = await this.fetchLatestGithubRelease(repo);
    const asset = release.assets.find((a: any) => a.name.endsWith(suffix));
    if (!asset) throw new Error(`No asset found for ${suffix}`);
    
    return {
      url: asset.browser_download_url,
      version: release.tag_name,
      name: asset.name
    };
  }

  async downloadAsset(url: string, destPath: string, events?: ManagerEvents) {
    events?.onInstallProgress?.(20, "Downloading...");
    
    if (typeof process === "undefined") {
      // In Tauri browser context, browser fetch blocks cross-origin redirects from github.
      // So we use the shell adapter (curl or powershell) to bypass CORS.
      const shell = await getShellAdapter();
      const { platform } = await this.getOsInfo();
      
      if (platform === "win32") {
        await shell.exec("powershell", ["-Command", `Invoke-WebRequest -Uri '${url}' -OutFile '${destPath}'`]);
      } else {
        await shell.exec("curl", ["-L", "-o", destPath, url]);
      }
      return;
    }

    // In Node context, we can just use global fetch without CORS issues
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download asset: ${res.statusText}`);
    
    const contentLength = res.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    
    let loaded = 0;
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");
    
    const chunks: Uint8Array[] = [];
    
    while(true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      if (value) {
        chunks.push(value);
        loaded += value.length;
        if (total && events?.onInstallProgress) {
          const percent = Math.round((loaded / total) * 100);
          events.onInstallProgress(percent, `Downloading...`);
        }
      }
    }
    
    const all = new Uint8Array(loaded);
    let position = 0;
    for (const chunk of chunks) {
      all.set(chunk, position);
      position += chunk.length;
    }
    
    const fs = await getFileSystemAdapter();
    await fs.writeBinaryFile(destPath, all);
  }

  async checkLocalFallback(destDir: string, expectedBinName: string): Promise<boolean> {
    try {
      const fs = await getFileSystemAdapter();
      // Check if a binary exists in the parent directory of destDir (e.g., if user placed it manually in ~/.crom parent or next to the app)
      // Usually, when running in dev, it might be in ../target/release/crom-agente or similar.
      // We will check a fallback path, for example, `./crom-agente` in the current working directory.
      const localPath = `./${expectedBinName}`;
      const exists = await fs.exists(localPath);
      if (exists) {
        const content = await fs.readFile(localPath); // Not ideal for binary, but fs might support it or we can copy it via shell
        const shell = await getShellAdapter();
        const { platform } = await this.getOsInfo();
        if (platform === "win32") {
          await shell.exec("powershell", ["-Command", `Copy-Item -Path '${localPath}' -Destination '${destDir}\\${expectedBinName}' -Force`]);
        } else {
          await shell.exec("cp", [localPath, `${destDir}/${expectedBinName}`]);
        }
        return true;
      }
    } catch(e) {
      // Ignore
    }
    return false;
  }

  async extractArchive(archivePath: string, destDir: string) {
    const shell = await getShellAdapter();
    const { platform } = await this.getOsInfo();
    
    // Check if it's actually an archive
    if (!archivePath.endsWith(".zip") && !archivePath.endsWith(".tar.gz") && !archivePath.endsWith(".tar")) {
      const isWin = platform === "win32";
      const binName = `crom-agente${isWin ? '.exe' : ''}`;
      if (platform === "win32") {
        await shell.exec("powershell", ["-Command", `Copy-Item -Path '${archivePath}' -Destination '${destDir}\\${binName}' -Force`]);
        await shell.exec("powershell", ["-Command", `Remove-Item -Path '${archivePath}' -Force`]);
      } else {
        await shell.exec("cp", [archivePath, `${destDir}/${binName}`]);
        await shell.exec("rm", ["-f", archivePath]);
      }
      return;
    }

    if (platform === "win32") {
      await shell.exec("powershell", ["-Command", `Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force`]);
      await shell.exec("powershell", ["-Command", `Remove-Item -Path '${archivePath}' -Force`]);
    } else {
      await shell.exec("tar", ["-xzf", archivePath, "-C", destDir]);
      await shell.exec("rm", ["-f", archivePath]);
    }
  }

  async installOllama(events?: ManagerEvents) {
    const shell = await getShellAdapter();
    const { platform } = await this.getOsInfo();
    
    events?.onInstallProgress?.(10, "Installing Ollama...");
    if (platform === "win32") {
      events?.onInstallProgress?.(50, "Please download and install Ollama from ollama.com for Windows.");
    } else {
      let cmd = "curl -fsSL https://ollama.com/install.sh | sh";
      if (platform === "linux") {
        cmd = "timeout 300 sh -c 'curl -fsSL https://ollama.com/install.sh | sh'";
      }
      await shell.exec("sh", ["-c", cmd]);
      events?.onInstallProgress?.(100, "Ollama Installed");
    }
  }
}
