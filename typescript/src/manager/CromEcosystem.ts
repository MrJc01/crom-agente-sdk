import { DaemonManager } from "./DaemonManager.js";
import { OllamaManager } from "./OllamaManager.js";
import { CromClient, CromClientOptions } from "../client.js";
import { getFileSystemAdapter, getShellAdapter } from "./AdapterFactory.js";
import { ManagerEvents, DaemonConfig } from "./types.js";

export class CromEcosystem {
  public daemon!: DaemonManager;
  public ollama!: OllamaManager;
  public client!: CromClient;

  private constructor() {}

  static async init(config: DaemonConfig = {}): Promise<CromEcosystem> {
    const fs = await getFileSystemAdapter();
    const shell = await getShellAdapter();
    
    const ecosystem = new CromEcosystem();
    ecosystem.daemon = new DaemonManager(fs, shell, config);
    ecosystem.ollama = new OllamaManager(fs, shell);
    ecosystem.client = new CromClient();
    
    return ecosystem;
  }

  async ensureReady(events?: ManagerEvents): Promise<void> {
    await this.daemon.install(events);
    await this.daemon.start(events);
    
    try {
      await this.ollama.install(events);
      await this.ollama.start(events);
    } catch (e) {
      console.warn("Failed to ensure Ollama:", e);
    }

    const token = await this.daemon.getToken();
    if (token) {
      this.client.updateOptions({
        sessionToken: token
      });
    }
  }

  createClient(options: CromClientOptions = {}): CromClient {
    this.client.updateOptions(options);
    return this.client;
  }
}
