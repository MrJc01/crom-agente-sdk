import { EnvironmentType, IFileSystemAdapter, IShellAdapter } from "./types.js";
import { detectEnvironment } from "./EnvironmentDetector.js";

let fsAdapterInstance: IFileSystemAdapter | null = null;
let shellAdapterInstance: IShellAdapter | null = null;

export async function getFileSystemAdapter(): Promise<IFileSystemAdapter> {
  if (fsAdapterInstance) return fsAdapterInstance;
  
  const env = detectEnvironment();
  
  if (env === EnvironmentType.Tauri) {
    const { TauriFileSystemAdapter } = await import("./adapters/TauriAdapter.js");
    fsAdapterInstance = new TauriFileSystemAdapter();
    return fsAdapterInstance;
  } else if (env === EnvironmentType.Node) {
    const { NodeFileSystemAdapter } = await import("./adapters/NodeAdapter.js");
    fsAdapterInstance = new NodeFileSystemAdapter();
    return fsAdapterInstance;
  } else {
    throw new Error("Ambiente não suportado: Sistema de arquivos no browser puro não é possível sem servidor.");
  }
}

export async function getShellAdapter(): Promise<IShellAdapter> {
  if (shellAdapterInstance) return shellAdapterInstance;
  
  const env = detectEnvironment();
  
  if (env === EnvironmentType.Tauri) {
    const { TauriShellAdapter } = await import("./adapters/TauriAdapter.js");
    shellAdapterInstance = new TauriShellAdapter();
    return shellAdapterInstance;
  } else if (env === EnvironmentType.Node) {
    const { NodeShellAdapter } = await import("./adapters/NodeAdapter.js");
    shellAdapterInstance = new NodeShellAdapter();
    return shellAdapterInstance;
  } else {
    throw new Error("Ambiente não suportado: Comandos de shell no browser puro não são possíveis.");
  }
}
