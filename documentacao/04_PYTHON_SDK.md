# 🐍 04. SDK em Python (`cromia_sdk`)

Este documento descreve o SDK oficial em **Python** do ecossistema CromIA (`python/cromia_sdk`), abordando a integração com o Daemon local, chamadas assíncronas e streaming de telemetria via WebSockets.

---

## 📑 Sumário
1. [Instalação](#1-instalação)
2. [A Classe `CromClient`](#2-a-classe-cromclient)
3. [Verificação de Status e Telemetria](#3-verificação-de-status-e-telemetria)
4. [Streaming via WebSockets (`stream_agent_telemetry`)](#4-streaming-via-websockets-stream_agent_telemetry)
5. [Exemplo Completo com FastAPI e Asyncio](#5-exemplo-completo-com-fastapi-e-asyncio)

---

## 1. Instalação

```bash
pip install cromia-sdk
```

---

## 2. A Classe `CromClient`

A classe `CromClient` (em `python/cromia_sdk/client.py`) fornece a interface de comunicação HTTP REST e WebSocket com o Daemon:

```python
from cromia_sdk import CromClient

# Inicializa o cliente apontando para o daemon local (porta padrão 17171 ou 9090)
client = CromClient(token="seu_token_opcional", port=17171)

# Verifica se o daemon está online
is_online = client.ping()
print(f"Daemon Online: {is_online}")
```

---

## 3. Verificação de Status e Telemetria

```python
# Obtém métricas de telemetria de um workspace
telemetry = client.get_agent_telemetry(workspace="/caminho/workspace")
print("Tokens Gastos:", telemetry.get("tokens_gastos"))
print("Turnos:", telemetry.get("total_turnos"))
```

---

## 4. Streaming via WebSockets (`stream_agent_telemetry`)

O cliente Python abre uma conexão WebSocket concorrente em background e invoca seu callback a cada nova atualização de estado do agente:

```python
def on_telemetry_update(data):
    print("🔔 Atualização de Telemetria recebida:", data)

# Inicia o streaming assíncrono em background
unsubscribe = client.stream_agent_telemetry(
    workspace="/caminho/workspace",
    on_update=on_telemetry_update
)

# Para cancelar a escuta posteriormente:
# unsubscribe()
```

---

## 5. Exemplo Completo com FastAPI e Asyncio

```python
from fastapi import FastAPI
from cromia_sdk import CromClient
import httpx

app = FastAPI()
client = CromClient(port=9090)

@app.post("/executar-tarefa")
async def executar_tarefa(prompt: str):
    url = f"{client.base_url}/api/agent/run"
    payload = {
        "workspace": "/tmp/crom-python-ephemeral",
        "provider": "openrouter",
        "model": "google/gemini-2.5-flash",
        "task": prompt,
        "allowed_tools": [] # Pensamento puro
    }

    async with httpx.AsyncClient() as http:
        res = await http.post(url, json=payload, timeout=30.0)
        return res.json()
```
