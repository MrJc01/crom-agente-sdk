import { CromClient } from "./client.js";
import * as os from "os";
import * as path from "path";

export type ToolFilterMode = "only" | "plus" | "except" | "none";

export interface MCPServerInlineConfig {
  name: string;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export interface TelemetryMetrics {
  durationMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCostUSD?: number;
}

export interface AgentExecutionResponse<T> {
  data: T;
  telemetry: TelemetryMetrics;
  modelUsed: string;
}

export interface CromAgentOptions {
  /** Provedor de LLM (ex: "openrouter", "openai", "gemini", "ollama") */
  provider?: string;
  /** Modelo de LLM (ex: "google/gemini-2.5-flash") */
  model?: string;
  /** Limite máximo de iterações do ReAct loop */
  maxIterations?: number;
  /** Diretório de workspace */
  workspacePath?: string;
  /** Se true, cria e gerencia workspace temporário efêmero em /tmp */
  ephemeral?: boolean;
  /** Configuração de restrição/filtro de ferramentas */
  toolsConfig?: {
    mode: ToolFilterMode;
    list?: string[];
  };
  /** Servidores MCP inline registrados via código */
  mcpServers?: MCPServerInlineConfig[];
  /** Host do Daemon local (padrão: 127.0.0.1) */
  daemonHost?: string;
  /** Porta do Daemon local (padrão: 9090) */
  daemonPort?: number;
  /** Regras adicionais do sistema */
  systemRules?: string[];
}

export interface RunOptions<T = any> {
  /** Se true, parseia a resposta como JSON */
  jsonResponse?: boolean;
  /** Função para validar/parsear o schema (ex: Zod parse) */
  schemaValidator?: (data: any) => T;
}

export class CromAgentEngine {
  private client: CromClient;
  private config: Required<Omit<CromAgentOptions, "mcpServers" | "systemRules" | "toolsConfig">> & {
    mcpServers: MCPServerInlineConfig[];
    systemRules: string[];
    toolsConfig: { mode: ToolFilterMode; list: string[] };
  };

  constructor(options: CromAgentOptions = {}) {
    const daemonHost = options.daemonHost || "127.0.0.1";
    const daemonPort = options.daemonPort || 9090;

    this.client = new CromClient({ daemonHost, daemonPort });

    this.config = {
      provider: options.provider || "openrouter",
      model: options.model || "google/gemini-2.5-flash",
      maxIterations: options.maxIterations ?? 5,
      workspacePath: options.workspacePath || path.join(os.tmpdir(), "crom-ephemeral"),
      ephemeral: options.ephemeral ?? true,
      daemonHost,
      daemonPort,
      mcpServers: options.mcpServers || [],
      systemRules: options.systemRules || [],
      toolsConfig: {
        mode: options.toolsConfig?.mode || "none",
        list: options.toolsConfig?.list || [],
      },
    };
  }

  private resolveAllowedTools(): string[] | null {
    const { mode, list } = this.config.toolsConfig;

    switch (mode) {
      case "none":
        return []; // Modo Pensamento Puro: 0 ferramentas executadas
      case "only":
        return list;
      case "except":
        const allBuiltin = [
          "read_file", "write_file", "edit_file", "delete_file", 
          "terminal_command", "http_client", "database_tester", "git_status"
        ];
        return allBuiltin.filter(t => !list.includes(t));
      case "plus":
        return list;
      default:
        return [];
    }
  }

  public async run<TOutput = string>(
    inputPrompt: string, 
    runOpts: RunOptions<TOutput> = {}
  ): Promise<AgentExecutionResponse<TOutput>> {
    const startTime = Date.now();
    const allowedTools = this.resolveAllowedTools();
    const finalWorkspace = this.config.ephemeral 
      ? path.join(os.tmpdir(), `crom-run-${Date.now()}`)
      : this.config.workspacePath;

    let fullPrompt = "";
    if (this.config.systemRules.length > 0) {
      fullPrompt += `REGRAS DO SISTEMA:\n${this.config.systemRules.join("\n")}\n\n`;
    }
    fullPrompt += inputPrompt;

    if (runOpts.jsonResponse) {
      fullPrompt += `\n\nIMPORTANTE: Retorne ESTREITAMENTE um JSON válido. Não inclua texto explicativo fora do JSON.`;
    }

    const payload = {
      workspace: finalWorkspace,
      provider: this.config.provider,
      model: this.config.model,
      task: fullPrompt,
      max_iterations: this.config.maxIterations,
      allowed_tools: allowedTools,
      mcp_servers: this.config.mcpServers,
    };

    const endpoint = this.client.buildDaemonUrl("/api/agent/run");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Erro no daemon do crom-agente: HTTP ${response.status}`);
    }

    const resData = await response.json();
    const rawSummary: string = resData.summary || resData.last_message || "";
    const durationMs = Date.now() - startTime;

    let parsedResult: any = rawSummary;

    if (runOpts.jsonResponse) {
      const sanitized = rawSummary.replace(/```json/g, "").replace(/```/g, "").trim();
      parsedResult = JSON.parse(sanitized);

      if (runOpts.schemaValidator) {
        parsedResult = runOpts.schemaValidator(parsedResult);
      }
    }

    return {
      data: parsedResult as TOutput,
      modelUsed: resData.model_used || this.config.model,
      telemetry: {
        durationMs,
        promptTokens: resData.prompt_tokens,
        completionTokens: resData.completion_tokens,
        totalTokens: resData.total_tokens,
        estimatedCostUSD: resData.cost_usd,
      },
    };
  }
}
