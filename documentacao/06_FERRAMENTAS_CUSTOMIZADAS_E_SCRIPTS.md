# 🛠️ 06. Ferramentas Customizadas e Carregamento de Scripts

Este documento detalha como estender o **`crom-agente`** criando **Ferramentas Customizadas (Custom Tools)** nativas e carregando scripts externos locais dinamicamente através do SDK.

---

## 📑 Sumário
1. [Conceito de Ferramenta Customizada](#1-conceito-de-ferramenta-customizada)
2. [Criando Custom Tools em Go (`RegisterTool`)](#2-criando-custom-tools-em-go-registertool)
3. [Carregando Scripts Automáticos (`LoadScriptsFromDir`)](#3-carregando-scripts-automáticos-loadscriptsfromdir)
4. [Injetando Servidores MCP via TypeScript SDK](#4-injetando-servidores-mcp-via-typescript-sdk)

---

## 1. Conceito de Ferramenta Customizada

Uma ferramenta customizada permite que o agente execute funções nativas da sua aplicação backend ou scripts do seu sistema operacional como passos do seu ciclo cognitivo ReAct.

---

## 2. Criando Custom Tools em Go (`RegisterTool`)

Em Go, qualquer struct que implemente a interface `tools.Tool` pode ser registrada no agente:

```go
type ScriptExecutorTool struct {
	ScriptPath string
}

func (s *ScriptExecutorTool) ID() string {
	return "script_executor"
}

func (s *ScriptExecutorTool) Description() string {
	return "Executa o script de validação de rede interno"
}

func (s *ScriptExecutorTool) ParametersSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"ip_alvo": { "type": "string", "description": "IP para testar" }
		},
		"required": ["ip_alvo"]
	}`)
}

func (s *ScriptExecutorTool) RequiresApproval() bool {
	return false
}

func (s *ScriptExecutorTool) Execute(ctx context.Context, args json.RawMessage) (tools.Result, error) {
	// Lógica de execução nativa em Go
	return tools.Result{Success: true, Data: "IP 127.0.0.1 Acessível"}, nil
}

// Registro no agente:
agent.RegisterTool(&ScriptExecutorTool{})
```

---

## 3. Carregando Scripts Automáticos (`LoadScriptsFromDir`)

O SDK pode varrer uma pasta e transformar todos os scripts `.sh`, `.py` ou `.js` encontrados em ferramentas invocáveis pela LLM:

```go
// Carrega todos os scripts da pasta ./meus-scripts
err := agent.LoadScriptsFromDir("./meus-scripts")
```

Cada script é carregado com um nome de ferramenta correspondente ao nome do arquivo (ex: `validar_banco.sh` $\rightarrow$ tool `validar_banco`).

---

## 4. Injetando Servidores MCP via TypeScript SDK

No TypeScript SDK, ferramentas externas podem ser injetadas dinamicamente via servidores MCP inline:

```typescript
import { CromAgentEngine } from "@crom/agente-sdk";

const engine = new CromAgentEngine({
  toolsConfig: { mode: "only", list: ["mcp_minha_api_*"] },
  mcpServers: [
    {
      name: "minha_api",
      command: "node",
      args: ["./mcp-server-custom.js"]
    }
  ]
});
```
