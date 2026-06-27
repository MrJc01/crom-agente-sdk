export enum EnvironmentType {
  Node = "Node",
  Tauri = "Tauri",
  Browser = "Browser"
}

export interface IFileSystemAdapter {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  writeBinaryFile(path: string, data: Uint8Array): Promise<void>;
  exists(path: string): Promise<boolean>;
  chmod(path: string, mode: number): Promise<void>;
  mkdir(path: string, recursive: boolean): Promise<void>;
}

export interface Process {
  pid?: number;
  onStdout: (cb: (data: string) => void) => void;
  onStderr: (cb: (data: string) => void) => void;
  onClose: (cb: (code: number) => void) => void;
  kill: () => Promise<void>;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
}

export interface IShellAdapter {
  spawn(cmd: string, args: string[]): Promise<Process>;
  exec(cmd: string, args: string[]): Promise<ExecResult>;
  kill(pid: number): Promise<void>;
  isProcessRunning(name: string): Promise<boolean>;
}

export interface DaemonConfig {
  host?: string;
  port?: number;
  path?: string;
  workspace?: string;
  [key: string]: any;
}

export interface ManagerEvents {
  onInstallProgress?: (progress: number, status: string) => void;
  onStart?: () => void;
  onError?: (error: Error) => void;
  onLog?: (data: string) => void;
}
