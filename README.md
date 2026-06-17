# crom-agente-sdk

Este repositório contém a camada de **SDK (Software Development Kit)** do ecossistema `crom-agente`. Ele fornece bindings e wrappers de alto nível em múltiplas linguagens para facilitar a integração de aplicativos de terceiros com o daemon local do orquestrador de agentes.

---

## 🗺️ Protocolos de Comunicação Suportados

O SDK abstrai e encapsula os quatro principais canais de comunicação fornecidos pelo daemon Go:
1. **gRPC API**: Chamadas tipadas de alta performance para sincronização de estado, execução e gerenciamento de sessões de agentes.
2. **REST API**: Operações stateless simples (listagem de arquivos, verificação de integridade, busca de dispositivos de hardware).
3. **WebSockets (WS)**: Manipulação interativa de pseudo-terminais (PTY) e logs em tempo real dos loops ReAct.
4. **IPC / Unix Socket**: Canal prioritário para controle rápido do CLI local.

---

## 🛠️ Suporte a Linguagens (Planejado)

* **Go SDK** (Bindings Nativos): Disponíveis no diretório `/go`.
* **Python SDK**: Disponível no diretório `/python` (otimizado para integração de scripts de automação e ferramentas de IA externas).
* **TypeScript SDK**: Disponível no diretório `/typescript` (projetado para extensões do VS Code e aplicativos web headless).
* **Rust SDK**: Disponível no diretório `/rust` (para bindings de ultra performance e segurança).

---

## ⚡ Exemplo de Uso (Python SDK Concept)

```python
from crom_sdk import CromClient

# Inicializa o cliente buscando a chave no arquivo global ~/.crom/.env
client = CromClient()

# Inicia a gravação de tela de uma janela específica
client.record.start(source="window", window_id="0x06800004")

# Executa um prompt no agente do workspace ativo
response = client.agent.execute(
    prompt="Crie um script em Python para ler o arquivo dados.csv",
    workspace_path="/home/j/workspace-teste"
)

print(response.output)

# Encerra a gravação
client.record.stop()
```
