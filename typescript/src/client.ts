import { AgentEvent, AgentErrorCode, MCPServerStatus, IPCMessage, IPCResponse } from "./types.js";
import { parseDaemonPayload } from "./utils.js";

export interface CromClientOptions {
  daemonHost?: string;
  daemonPort?: number;
  cloudUrl?: string;
  sessionToken?: string;
  daemonToken?: string;
  onTokenRefreshNeeded?: () => Promise<string | null>;
  onWebSocketClose?: (event: CloseEvent) => void;
  onWebSocketError?: (event: Event) => void;
  WebSocketConstructor?: any;
}

export class CromClient {
  private options: Required<CromClientOptions>;
  private ws: any = null;
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 2000;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private wsUrl: string = "";

  constructor(options: CromClientOptions = {}) {
    this.options = {
      daemonHost: options.daemonHost || "127.0.0.1",
      daemonPort: options.daemonPort || 9090,
      cloudUrl: options.cloudUrl || "https://cloud.ia.crom.run",
      sessionToken: options.sessionToken || "",
      daemonToken: options.daemonToken || "",
      onTokenRefreshNeeded: options.onTokenRefreshNeeded || (async () => null),
      onWebSocketClose: options.onWebSocketClose || (() => {}),
      onWebSocketError: options.onWebSocketError || (() => {}),
      WebSocketConstructor: options.WebSocketConstructor || null,
    };
  }

  updateOptions(options: Partial<CromClientOptions>) {
    this.options = { ...this.options, ...options } as any;
  }

  getOptions(): Required<CromClientOptions> {
    return this.options;
  }

  // --- Listener management ---
  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: (data: any) => void) {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
    }
  }

  private emit(event: string, data: any) {
    const set = this.listeners.get(event);
    if (set) {
      for (const cb of set) {
        try {
          cb(data);
        } catch (e) {
          console.error("Error in CromClient event listener:", e);
        }
      }
    }
  }

  // --- HTTP Helpers ---
  buildDaemonUrl(path: string, params: Record<string, string> = {}): string {
    const host = this.options.daemonHost;
    const port = this.options.daemonPort;
    const url = new URL(`http://${host}:${port}${path}`);
    
    const token = this.options.daemonToken || this.options.sessionToken;
    if (token) {
      url.searchParams.set("token", token);
    }
    
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null) {
        url.searchParams.set(key, val);
      }
    }
    return url.toString();
  }

  private buildCloudUrl(path: string): string {
    return `${this.options.cloudUrl.replace(/\/$/, "")}${path}`;
  }

  private getCloudHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.options.sessionToken) {
      headers["Authorization"] = `Bearer ${this.options.sessionToken}`;
    }
    return headers;
  }

  // --- HTTP REST API methods ---
  async getDaemonToken(): Promise<string> {
    const url = `http://${this.options.daemonHost}:${this.options.daemonPort}/api/token`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch daemon token: ${res.statusText}`);
    const data = await res.json();
    if (data && data.token) {
      this.options.daemonToken = data.token;
      return data.token;
    }
    throw new Error("No token returned from daemon");
  }

  async getSystemInfo(): Promise<any> {
    const url = this.buildDaemonUrl("/api/system/info");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch system info: ${res.statusText}`);
    return res.json();
  }

  async getTags(): Promise<any> {
    const url = this.buildDaemonUrl("/api/tags");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch tags: ${res.statusText}`);
    return res.json();
  }

  async getTerminals(): Promise<any> {
    const url = this.buildDaemonUrl("/api/terminal/list");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch terminal list: ${res.statusText}`);
    return res.json();
  }

  async closeTerminal(terminalId: string): Promise<any> {
    const url = this.buildDaemonUrl("/api/terminal/close", { id: terminalId });
    const res = await fetch(url, {
      method: "POST",
    });
    if (!res.ok) throw new Error(`Failed to close terminal: ${res.statusText}`);
    return res.json();
  }

  async getTerminalBuffer(terminalId: string): Promise<string> {
    const url = this.buildDaemonUrl("/api/terminal/buffer", { id: terminalId });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch terminal buffer: ${res.statusText}`);
    return res.text();
  }

  async getTerminalInfo(terminalId: string): Promise<any> {
    const url = this.buildDaemonUrl("/api/terminal/info", { id: terminalId });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch terminal info: ${res.statusText}`);
    return res.json();
  }

  async getProjectFiles(projectPath: string): Promise<any[]> {
    const url = this.buildDaemonUrl("/api/project/files", { path: projectPath });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch project files: ${res.statusText}`);
    return res.json();
  }

  async stopDaemon(workspace?: string): Promise<any> {
    const url = this.buildDaemonUrl("/stop");
    const body = workspace ? JSON.stringify({ workspace }) : undefined;
    const res = await fetch(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : {},
      body,
    });
    if (!res.ok) throw new Error(`Failed to stop daemon: ${res.statusText}`);
    return res.json();
  }

  async getScheduledTasks(): Promise<any[]> {
    const url = this.buildDaemonUrl("/api/schedule");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch scheduled tasks: ${res.statusText}`);
    return res.json();
  }

  async addScheduledTask(task: { name: string; cron: string; workspace: string; task: string }): Promise<any> {
    const url = this.buildDaemonUrl("/api/schedule");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    });
    if (!res.ok) throw new Error(`Failed to add scheduled task: ${res.statusText}`);
    return res.json();
  }

  async deleteScheduledTask(id: string): Promise<any> {
    const url = this.buildDaemonUrl("/api/schedule", { id });
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) throw new Error(`Failed to delete scheduled task: ${res.statusText}`);
    return res.json();
  }

  async runScheduledTask(id: string): Promise<any> {
    const url = this.buildDaemonUrl("/api/schedule/run", { id });
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) throw new Error(`Failed to run scheduled task: ${res.statusText}`);
    return res.json();
  }

  async getScreenDevices(): Promise<any> {
    const url = this.buildDaemonUrl("/api/devices/screens");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch screen devices: ${res.statusText}`);
    return res.json();
  }

  async getAudioDevices(): Promise<any> {
    const url = this.buildDaemonUrl("/api/devices/audio");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch audio devices: ${res.statusText}`);
    return res.json();
  }

  async startRecording(type: "audio" | "screen", params: Record<string, string> = {}): Promise<any> {
    const url = this.buildDaemonUrl("/api/record/start", { type, ...params });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to start recording: ${res.statusText}`);
    return res.json();
  }

  async stopRecording(type: "audio" | "screen"): Promise<Blob> {
    const url = this.buildDaemonUrl("/api/record/stop", { type });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to stop recording: ${res.statusText}`);
    return res.blob();
  }

  async transcribeAudio(audioBlob: Blob): Promise<{ text: string }> {
    const url = this.buildDaemonUrl("/api/transcribe");
    const res = await fetch(url, {
      method: "POST",
      body: audioBlob,
      headers: {
        "Content-Type": "audio/wav"
      }
    });
    if (!res.ok) throw new Error(`Failed to transcribe audio: ${res.statusText}`);
    return res.json();
  }

  // --- Filesystem API methods ---
  async listFiles(dirPath: string): Promise<any[]> {
    const url = this.buildDaemonUrl("/api/files", { path: dirPath });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to list files: ${res.statusText}`);
    return res.json();
  }

  async readFile(filePath: string): Promise<string> {
    const url = this.buildDaemonUrl("/api/file", { path: filePath });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to read file: ${res.statusText}`);
    return res.text();
  }

  async writeFile(filePath: string, content: string, encoding?: string): Promise<any> {
    const url = this.buildDaemonUrl("/api/file");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: filePath,
        content: content,
        encoding: encoding
      }),
    });
    if (!res.ok) throw new Error(`Failed to write file: ${res.statusText}`);
    return res.json();
  }

  // --- Cloud & Models REST API ---
  async getCloudUser(): Promise<any> {
    const url = this.buildCloudUrl("/api/v1/admin/me");
    const res = await fetch(url, {
      headers: this.getCloudHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch cloud user: ${res.statusText}`);
    return res.json();
  }

  async getCloudModels(): Promise<any> {
    const url = this.buildCloudUrl("/api/v1/models");
    const res = await fetch(url, {
      headers: this.getCloudHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch cloud models: ${res.statusText}`);
    return res.json();
  }

  async getLatestRelease(repo: string = "crom-agente"): Promise<any> {
    const url = this.buildCloudUrl(`/api/v1/github/releases?repo=${repo}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch latest release: ${res.statusText}`);
    return res.json();
  }

  async getOpenRouterModels(): Promise<any> {
    const url = "https://openrouter.ai/api/v1/models";
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch OpenRouter models: ${res.statusText}`);
    return res.json();
  }

  // --- WebSocket Connection ---
  connectWebSocket(
    workspacePath: string,
    activeSessionId?: string,
    initialPrompt?: string,
    defaultProvider?: string,
    defaultModel?: string
  ) {
    this.disconnectWebSocket();

    const host = this.options.daemonHost;
    const port = this.options.daemonPort;
    const token = this.options.sessionToken || this.options.daemonToken;
    const wsProto = typeof window !== "undefined" && window.location?.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProto}//${host}:${port}/ws${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    this.wsUrl = wsUrl;

    const WebSocketImpl = this.options.WebSocketConstructor || (typeof window !== "undefined" ? window.WebSocket : null);
    if (!WebSocketImpl) {
      throw new Error("No WebSocket constructor available. Pass one in options for Node environment.");
    }

    const socket = new WebSocketImpl(wsUrl);
    this.ws = socket;

    socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit("open", { url: wsUrl });

      socket.send(JSON.stringify({ type: "subscribe", workspace: workspacePath }));

      const autoApprove = typeof localStorage !== "undefined" ? localStorage.getItem("crom_auto_approve_enabled") === "true" : false;
      socket.send(JSON.stringify({ type: "set_auto_approve", workspace: workspacePath, auto_approve: autoApprove }));

      if (initialPrompt && initialPrompt.trim()) {
        socket.send(JSON.stringify({
          type: "run",
          workspace: workspacePath,
          session: activeSessionId,
          task: initialPrompt,
          provider: defaultProvider,
          model: defaultModel
        }));
        this.emit("prompt_sent", { prompt: initialPrompt });
      }
    };

    socket.onmessage = (event: any) => {
      try {
        const parsed = parseDaemonPayload(event.data);
        if (!parsed) return;
        const responses = Array.isArray(parsed) ? parsed : [parsed];

        for (const resp of responses) {
          let payload = resp.data;
          if (typeof payload === "string") {
            try {
              payload = JSON.parse(payload);
            } catch (e) {
              // ignore
            }
          }

          let eventType = "";
          let iteration = 0;
          let eventData: any = null;

          if (payload && typeof payload === "object") {
            if ("event" in payload) {
              eventType = payload.event;
              iteration = payload.iteration || 0;
              eventData = payload.data;
            } else if ("type" in payload) {
              if (payload.type === "status") {
                eventType = "status_change";
                eventData = { status: payload.status };
              } else if (payload.type === "ask_permission") {
                eventType = "permission_request";
                eventData = { action: payload.action, target: payload.target };
              } else if (payload.type === "message") {
                eventType = "message";
                eventData = payload;
              } else {
                eventType = payload.type;
                eventData = payload;
              }
            }
          }

          if (!eventType) {
            if (resp.error) {
              eventType = "error";
              eventData = { error: { code: "ERR_DAEMON", message: resp.error } };
            } else {
              continue;
            }
          }

          this.emit(eventType, {
            event: eventType,
            iteration,
            data: eventData
          });
        }
      } catch (err) {
        this.emit("error", { error: err });
      }
    };

    socket.onerror = (err: any) => {
      this.emit("error", { error: err });
      if (this.options.onWebSocketError) {
        this.options.onWebSocketError(err);
      }
    };

    socket.onclose = (event: any) => {
      this.emit("close", event);
      if (this.options.onWebSocketClose) {
        this.options.onWebSocketClose(event);
      }

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);
        this.reconnectAttempts += 1;

        if (this.options.onTokenRefreshNeeded) {
          this.options.onTokenRefreshNeeded().then((newToken) => {
            if (newToken) {
              this.options.sessionToken = newToken;
            }
            this.scheduleReconnect(workspacePath, activeSessionId, initialPrompt, defaultProvider, defaultModel, delay);
          }).catch(() => {
            this.scheduleReconnect(workspacePath, activeSessionId, initialPrompt, defaultProvider, defaultModel, delay);
          });
        } else {
          this.scheduleReconnect(workspacePath, activeSessionId, initialPrompt, defaultProvider, defaultModel, delay);
        }
      }
    };
  }

  private scheduleReconnect(
    workspacePath: string,
    activeSessionId?: string,
    initialPrompt?: string,
    defaultProvider?: string,
    defaultModel?: string,
    delay: number = 2000
  ) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connectWebSocket(workspacePath, activeSessionId, initialPrompt, defaultProvider, defaultModel);
    }, delay);
  }

  disconnectWebSocket() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  sendRun(workspacePath: string, sessionId: string, task: string, provider?: string, model?: string, autoApprove?: boolean) {
    if (!this.ws || this.ws.readyState !== 1) throw new Error("WebSocket not connected");
    this.ws.send(JSON.stringify({
      type: "run",
      workspace: workspacePath,
      session: sessionId,
      task,
      provider,
      model,
      auto_approve: autoApprove
    }));
  }

  sendStop(workspacePath: string) {
    if (!this.ws || this.ws.readyState !== 1) throw new Error("WebSocket not connected");
    this.ws.send(JSON.stringify({
      type: "stop",
      workspace: workspacePath
    }));
  }

  sendAutoApprove(workspacePath: string, enabled: boolean) {
    if (!this.ws || this.ws.readyState !== 1) throw new Error("WebSocket not connected");
    this.ws.send(JSON.stringify({
      type: "set_auto_approve",
      workspace: workspacePath,
      auto_approve: enabled
    }));
  }

  sendPermissionResponse(workspacePath: string, approved: boolean) {
    if (!this.ws || this.ws.readyState !== 1) throw new Error("WebSocket not connected");
    this.ws.send(JSON.stringify({
      type: "permission_response",
      workspace: workspacePath,
      payload: {
        approved,
        remember: false
      }
    }));
  }
}
