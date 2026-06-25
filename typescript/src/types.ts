/**
 * crom-agente SDK — Tipos do Protocolo de Eventos Estruturados
 *
 * Estes tipos definem o protocolo JSON que o daemon do crom-agente emite via WebSocket/IPC.
 * Use-os para consumir eventos do agente de forma tipada em qualquer aplicação TypeScript.
 */

// ─── Eventos do Agente ───

/** Tipos de evento possíveis emitidos pelo AgenticLoop */
export type AgentEventType =
  | "thinking"
  | "message"
  | "tool_call"
  | "tool_result"
  | "error"
  | "finished";

/** Evento estruturado emitido pelo agente em tempo real */
export interface AgentEvent {
  /** Timestamp ISO 8601 do momento da emissão */
  timestamp: string;
  /** Tipo do evento */
  event: AgentEventType;
  /** Número da iteração atual do loop ReAct (1-indexed) */
  iteration?: number;
  /** Dados específicos do evento */
  data?: Record<string, any>;
}

// ─── Dados Específicos por Tipo de Evento ───

/** Dados do evento "thinking" */
export interface ThinkingEventData {
  provider: string;
  model: string;
}

/** Dados do evento "message" */
export interface MessageEventData {
  role: "assistant" | "system" | "user" | "tool";
  content: string;
  usage: TokenUsage;
  has_tool_calls: boolean;
}

/** Dados do evento "tool_call" */
export interface ToolCallEventData {
  tool_call_id: string;
  tool: string;
  arguments: Record<string, any>;
}

/** Dados do evento "tool_result" */
export interface ToolResultEventData {
  tool_call_id: string;
  tool: string;
  success: boolean;
  output?: string;
  error?: string;
  error_code?: AgentErrorCode;
}

/** Dados do evento "error" */
export interface ErrorEventData {
  error: AgentError;
}

/** Dados do evento "finished" */
export interface FinishedEventData {
  reason: "completed" | "max_iterations" | "consecutive_failures" | "canceled";
  total_iterations: number;
}

// ─── Erros Tipados ───

/** Erro tipado emitido pelo agente para tratamento programático */
export interface AgentError {
  /** Código identificador do erro */
  code: AgentErrorCode;
  /** Mensagem legível do erro */
  message: string;
  /** Detalhes adicionais específicos do erro */
  details?: Record<string, any>;
}

/** Códigos de erro padronizados do agente */
export type AgentErrorCode =
  | "ERR_LLM_RATE_LIMIT"
  | "ERR_LLM_AUTHENTICATION"
  | "ERR_LLM_EMPTY_RESPONSE"
  | "ERR_TOOL_NOT_FOUND"
  | "ERR_TOOL_EXECUTION"
  | "ERR_TOOL_TIMEOUT"
  | "ERR_PERMISSION_DENIED"
  | "ERR_SANDBOX_VIOLATION"
  | "ERR_MAX_ITERATIONS"
  | "ERR_CONSECUTIVE_FAILURES"
  | "ERR_CONTEXT_CANCELED";

// ─── Token Usage ───

/** Informações de consumo de tokens de uma chamada ao LLM */
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// ─── MCP Server Status ───

/** Estado atual de um servidor MCP */
export interface MCPServerStatus {
  name: string;
  mode: "subprocess" | "sse";
  tool_count: number;
  tools: string[];
  running: boolean;
}

// ─── Protocolo IPC/WebSocket ───

/** Mensagem enviada pelo cliente ao daemon */
export interface IPCMessage {
  type: "run" | "status" | "stop" | "ping" | "subscribe" | "permission_response";
  workspace?: string;
  task?: string;
  session?: string;
  payload?: any;
}

/** Resposta enviada pelo daemon ao cliente */
export interface IPCResponse {
  success: boolean;
  data?: AgentEvent | LegacyEvent;
  error?: string;
  stream: boolean;
}

// ─── Eventos Legados (retrocompatibilidade) ───

/** Evento legado de status */
export interface LegacyStatusEvent {
  type: "status";
  status: string;
}

/** Evento legado de mensagem */
export interface LegacyMessageEvent {
  type: "message";
  role: string;
  content: string;
}

/** Evento legado de permissão */
export interface LegacyPermissionEvent {
  type: "ask_permission";
  action: string;
  target: string;
}

/** União de todos os eventos legados */
export type LegacyEvent =
  | LegacyStatusEvent
  | LegacyMessageEvent
  | LegacyPermissionEvent;

// ─── Helpers ───

/** Type guard para verificar se um payload é um AgentEvent estruturado */
export function isAgentEvent(data: any): data is AgentEvent {
  return data && typeof data.event === "string" && typeof data.timestamp === "string";
}

/** Type guard para verificar se um payload é um evento legado */
export function isLegacyEvent(data: any): data is LegacyEvent {
  return data && typeof data.type === "string" && !data.event;
}

/** Tabela de ações recomendadas para cada código de erro */
export const ERROR_ACTIONS: Record<AgentErrorCode, string> = {
  ERR_LLM_RATE_LIMIT: "Aguarde o cooldown ou troque de provedor/chave.",
  ERR_LLM_AUTHENTICATION: "Verifique e atualize sua chave de API nas configurações.",
  ERR_LLM_EMPTY_RESPONSE: "O modelo retornou vazio. Tente novamente ou troque de modelo.",
  ERR_TOOL_NOT_FOUND: "Ferramenta não registrada. Verifique as ferramentas disponíveis.",
  ERR_TOOL_EXECUTION: "Erro na execução da ferramenta. Verifique os logs.",
  ERR_TOOL_TIMEOUT: "A ferramenta excedeu o tempo limite. Aumente o timeout ou simplifique a operação.",
  ERR_PERMISSION_DENIED: "A ação foi rejeitada. Altere as permissões ou aprove manualmente.",
  ERR_SANDBOX_VIOLATION: "Tentativa de acessar recurso fora do sandbox do workspace.",
  ERR_MAX_ITERATIONS: "O agente atingiu o limite de iterações. Aumente o limite ou simplifique a tarefa.",
  ERR_CONSECUTIVE_FAILURES: "Muitas falhas consecutivas. Verifique a configuração e os logs.",
  ERR_CONTEXT_CANCELED: "A execução foi cancelada pelo usuário ou pelo sistema.",
};

// ─── Novas Interfaces de Telemetria e Estado ───

export interface TerminalTelemetry {
  id: string;
  pid: number;
  name: string;
  closed: boolean;
  updated_at: string;
}

export interface ProcessTelemetry {
  id: string;
  command: string;
  pid: number;
  status: "running" | "completed" | "failed" | "killed";
  started_at: string;
  is_background: boolean;
}

export interface TaskItem {
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed" | "failed";
}

export interface AgentState {
  id?: string;
  name?: string;
  status?: string;
  diretorio_atual: string;
  arquivos_focados: string[];
  tarefa_em_andamento: string;
  ultimo_status: string;
  status_operacional: string;
  modo_cognitivo: string;
  logs_relevantes: string[];
  tokens_gastos: number;
  total_turnos: number;
  timestamp: string;
  messages?: any[];
  plan?: TaskItem[];
  browser_url?: string;
  subagents_context?: Record<string, string>;
  files_created: number;
  files_validated: number;
  tool_calls_emitted: number;
  tool_calls_from_text_parse: number;
  circuit_breaker_triggered: boolean;
  active_terminals: TerminalTelemetry[];
  active_processes: ProcessTelemetry[];
  current_step: string;
  current_step_duration_ms: number;
}

export interface BrowserTelemetry {
  active: boolean;
  url: string;
}

export interface AgentTelemetry {
  workspace_name: string;
  is_running: boolean;
  agent_state: AgentState;
  browser: BrowserTelemetry;
  mcp_servers: MCPServerStatus[];
}
