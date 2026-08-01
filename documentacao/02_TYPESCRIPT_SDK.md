# 📘 02. SDK TypeScript (`@crom/agente-sdk`)

Este documento é o guia de referência completo da implementação em **TypeScript / JavaScript** do **`crom-agente-sdk`**.

---

## 📑 Sumário
1. [Instalação](#1-instalação)
2. [A Classe `CromAgentEngine`](#2-a-classe-cromagentengine)
3. [A Classe `CromClient`](#3-a-classe-cromclient)
4. [Gerenciadores Ecosystem (`DaemonManager` e `OllamaManager`)](#4-gerenciadores-ecosystem-daemonmanager-e-ollamamanager)
5. [Eventos e Streaming de Telemetria via WebSockets](#5-eventos-e-streaming-de-telemetria-via-websockets)
6. [Exemplo Completo de Integração](#6-exemplo-completo-de-integração)

---

## 1. Instalação

```bash
npm install @crom/agente-sdk
```

---

## 2. A Classe `CromAgentEngine`

A classe `CromAgentEngine` (localizada em `typescript/src/engine.ts`) permite executar o agente programaticamente sem necessidade de arquivos `.json` de configuração no disco:

```typescript
import { CromAgentEngine } from "@crom/agente-sdk";

const engine = new CromAgentEngine({
  provider: "openrouter",
  model: "google/gemini-2.5-flash",
  ephemeral: true, // Garante criação e limpeza de workspace efêmero em /tmp
  maxIterations: 5,
  toolsConfig: {
    mode: "none" // Cadeia de pensamento pura (0 ferramentas executadas)
  }
});

const response = await engine.run("Qual a capital da França?");
console.log(response.data); // "Paris"
console.log(`Tempo: ${response.telemetry.durationMs}ms`);
```

---

## 3. A Classe `CromClient`

A classe `CromClient` (em `typescript/src/client.ts`) gerencia a conexão HTTP REST e WebSockets com o Daemon local do `crom-agente`:

```typescript
import { CromClient } from "@crom/agente-sdk";

const client = new CromClient({
  daemonHost: "127.0.0.1",
  daemonPort: 9090
});

// Verifica se o Daemon local está rodando
const isOnline = await client.ping();
console.log(`Status do Daemon: ${isOnline ? "Online" : "Offline"}`);
```

---

## 4. Gerenciadores Ecosystem (`DaemonManager` e `OllamaManager`)

O SDK inclui utilitários para verificar e gerenciar binários e serviços do ecossistema:

```typescript
import { DaemonManager, OllamaManager } from "@crom/agente-sdk";

// Gerencia o binário do Daemon local
const daemonMgr = new DaemonManager();
const daemonStatus = await daemonMgr.checkStatus();

// Gerencia o Ollama local se disponível
const ollamaMgr = new OllamaManager();
const ollamaOnline = await ollamaMgr.isAvailable();
```

---

## 5. Eventos e Streaming de Telemetria via WebSockets

O `CromClient` permite escutar eventos e métricas de telemetria em tempo real:

```typescript
const client = new CromClient();

// Inscreve-se nos eventos de telemetria do workspace
const unsubscribe = client.streamAgentTelemetry("meu-workspace", (telemetryData) => {
  console.log("📈 Atualização de Telemetria:", telemetryData);
});

// Para cancelar a inscrição:
// unsubscribe();
```

---

## 6. Exemplo Completo de Integração

```typescript
import { CromAgentEngine } from "@crom/agente-sdk";
import { z } from "zod";

const AnaliseSchema = z.object({
  sentimento: z.enum(["POSITIVO", "NEGATIVO"]),
  score: z.number()
});

type Analise = z.infer<typeof AnaliseSchema>;

const engine = new CromAgentEngine({
  provider: "openrouter",
  model: "google/gemini-2.5-flash",
  toolsConfig: { mode: "none" }
});

export async function processarTexto(texto: string) {
  const result = await engine.run<Analise>(
    `Classifique o texto: "${texto}" e retorne um JSON com sentimento e score`,
    {
      jsonResponse: true,
      schemaValidator: (json) => AnaliseSchema.parse(json)
    }
  );

  return result.data;
}
```
