# 📊 07. Telemetria e Streaming via WebSockets

Este documento explica como consumir **Telemetria de Execução** (tokens, latência, modelo utilizado, custo em USD) e escutar eventos de streaming em tempo real via **WebSockets** utilizando o **`crom-agente-sdk`**.

---

## 📑 Sumário
1. [Conceito de Telemetria no `crom-agente`](#1-conceito-de-telemetria-no-crom-agente)
2. [Objeto `TelemetryMetrics` (TypeScript SDK)](#2-objeto-telemetrymetrics-typescript-sdk)
3. [Streaming via WebSocket em TypeScript](#3-streaming-via-websocket-em-typescript)
4. [Streaming via WebSocket em Python](#4-streaming-via-websocket-em-python)
5. [Exemplo de Dashboard de Monitoramento](#5-exemplo-de-dashboard-de-monitoramento)

---

## 1. Conceito de Telemetria no `crom-agente`

Toda execução processada pelo motor gera métricas de observabilidade consolidadas:
- **`durationMs`**: Tempo total transcorrido no ciclo ReAct em milissegundos.
- **`promptTokens`**: Quantidade de tokens enviados na mensagem de entrada.
- **`completionTokens`**: Quantidade de tokens gerados na resposta da LLM.
- **`totalTokens`**: Soma total de tokens consumidos na tarefa.
- **`estimatedCostUSD`**: Custo financeiro estimado da requisição em dólares americanos.

---

## 2. Objeto `TelemetryMetrics` (TypeScript SDK)

Quando você invoca `engine.run()`, a telemetria é devolvida no objeto de resposta:

```typescript
import { CromAgentEngine } from "@crom/agente-sdk";

const engine = new CromAgentEngine({
  provider: "openrouter",
  model: "google/gemini-2.5-flash"
});

const res = await engine.run("Qual a distância média da Terra à Lua?");

console.log("📊 Telemetria:");
console.log(`Duração: ${res.telemetry.durationMs}ms`);
console.log(`Tokens Totais: ${res.telemetry.totalTokens}`);
console.log(`Modelo Utilizado: ${res.modelUsed}`);
```

---

## 3. Streaming via WebSocket em TypeScript

O `CromClient` fornece o método `streamAgentTelemetry()` que abre um WebSocket seguro com a rota `/api/agent/telemetry/ws`:

```typescript
import { CromClient } from "@crom/agente-sdk";

const client = new CromClient({ daemonHost: "127.0.0.1", daemonPort: 9090 });

const unsubscribe = client.streamAgentTelemetry("meu-workspace", (data) => {
  console.log("⚡ [WS Telemetry Update]:", data);
});
```

---

## 4. Streaming via WebSocket em Python

```python
from cromia_sdk import CromClient

client = CromClient(port=17171)

def on_telemetry(data):
    print("🐍 [Python WS Telemetry]:", data)

unsubscribe = client.stream_agent_telemetry("meu-workspace", on_update=on_telemetry)
```

---

## 5. Exemplo de Dashboard de Monitoramento

```typescript
// Exemplo de agregação de métricas no servidor backend
let totalTokensConsumidos = 0;
let tempoTotalMs = 0;

export async function executarEDocumentar(prompt: string) {
  const result = await engine.run(prompt);

  if (result.telemetry.totalTokens) {
    totalTokensConsumidos += result.telemetry.totalTokens;
  }
  tempoTotalMs += result.telemetry.durationMs;

  console.log(`[Metrics Aggregate] Total Tokens: ${totalTokensConsumidos} | Tempo Acumulado: ${tempoTotalMs}ms`);
  return result.data;
}
```
