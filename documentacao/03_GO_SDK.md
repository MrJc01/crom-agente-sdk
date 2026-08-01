# 🦫 03. SDK em Go (`pkg/sdk` & `go/`)

Este documento cobre os bindings e APIs em **Go** do **`crom-agente-sdk`**, permitindo incorporar o motor de agentes autônomos *in-process* ou via IPC.

---

## 📑 Sumário
1. [Instalação do Módulo Go](#1-instalação-do-módulo-go)
2. [Estrutura do `sdk.Manager` e `sdk.Agent`](#2-estrutura-do-sdkmanager-e-sdkagent)
3. [Execução de Tarefas (`ExecuteTask`)](#3-execução-de-tarefas-executetask)
4. [Registrando Ferramentas Customizadas em Go (`RegisterTool`)](#4-registrando-ferramentas-customizadas-em-go-registertool)
5. [Carregando Scripts Locais (`LoadScriptsFromDir`)](#5-carregando-scripts-locais-loadscriptsfromdir)

---

## 1. Instalação do Módulo Go

```bash
go get github.com/crom/crom-agente/pkg/sdk
```

---

## 2. Estrutura do `sdk.Manager` e `sdk.Agent`

O SDK Go expõe duas estruturas principais em [agent.go](file:///home/j/Documentos/GitHub/crom-agente/pkg/sdk/agent.go):
- **`sdk.Manager`**: Gerencia instâncias de agentes e múltiplos workspaces.
- **`sdk.Agent`**: Representa uma instância isolada com configurações, histórico e registro de ferramentas.

```go
package main

import (
	"fmt"
	"github.com/crom/crom-agente/pkg/sdk"
)

func main() {
	manager := sdk.NewManager()

	agent, err := manager.CreateAgent(sdk.AgentConfig{
		AgentID:  "meu-agente-go",
		Provider: "openrouter",
		Model:    "google/gemini-2.5-flash",
	})
	if err != nil {
		panic(err)
	}

	fmt.Println("Agente Go instanciado com sucesso!")
}
```

---

## 3. Execução de Tarefas (`ExecuteTask`)

O método `ExecuteTask(ctx, task)` executa a tarefa iterativa no ciclo ReAct e retorna o resultado no campo `Result.Summary`:

```go
ctx := context.Background()
result, err := agent.ExecuteTask(ctx, "Analise o texto X e retorne em formato JSON")
if err != nil {
    log.Fatalf("Erro na execução: %v", err)
}

fmt.Printf("Status: %s\n", result.Status)
fmtPrintf("Sumário: %s\n", result.Summary)
```

---

## 4. Registrando Ferramentas Customizadas em Go (`RegisterTool`)

Você pode estender as capacidades do agente criando struct em Go que implementem a interface `tools.Tool`:

```go
type MinhaToolCustomizada struct{}

func (t *MinhaToolCustomizada) ID() string { return "minha_tool" }
func (t *MinhaToolCustomizada) Description() string { return "Executa uma ação customizada em Go" }
func (t *MinhaToolCustomizada) ParametersSchema() json.RawMessage {
	return json.RawMessage(`{"type": "object", "properties": {"entrada": {"type": "string"}}}`)
}
func (t *MinhaToolCustomizada) RequiresApproval() bool { return false }
func (t *MinhaToolCustomizada) Execute(ctx context.Context, args json.RawMessage) (tools.Result, error) {
	return tools.Result{Success: true, Data: "Processado em Go!"}, nil
}

// Registro no agente:
agent.RegisterTool(&MinhaToolCustomizada{})
```

---

## 5. Carregando Scripts Locais (`LoadScriptsFromDir`)

O SDK Go permite carregar automaticamente uma pasta inteira de scripts locais (sh, bash, python) e expô-los como ferramentas para o agente:

```go
err := agent.LoadScriptsFromDir("/caminho/para/scripts")
if err != nil {
    log.Printf("Falha ao carregar scripts: %v", err)
}
```
