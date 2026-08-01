# 🦀 05. SDK em Rust (`rust/`)

Este documento cobre o SDK assíncrono em **Rust** do ecossistema CromIA (`rust/`), projetado para aplicações e microsserviços de altíssima performance.

---

## 📑 Sumário
1. [Adicionando o Crate ao `Cargo.toml`](#1-adicionando-o-crate-ao-cargotoml)
2. [Estrutura do `CromClient`](#2-estrutura-do-cromclient)
3. [Execução Assíncrona com `tokio` e `reqwest`](#3-execução-assíncrona-com-tokio-e-reqwest)
4. [Exemplo Completo em Rust](#4-exemplo-completo-em-rust)

---

## 1. Adicionando o Crate ao `Cargo.toml`

```toml
[dependencies]
tokio = { version = "1.0", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
reqwest = { version = "0.11", features = ["json"] }
```

---

## 2. Estrutura do `CromClient`

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentRequest {
    pub workspace: String,
    pub provider: String,
    pub model: String,
    pub task: String,
    pub max_iterations: usize,
    pub allowed_tools: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentResponse {
    pub summary: Option<String>,
    pub status: String,
}

pub struct CromClient {
    base_url: String,
    client: reqwest::Client,
}

impl CromClient {
    pub fn new(host: &str, port: u16) -> Self {
        Self {
            base_url: format!("http://{}:{}", host, port),
            client: reqwest::Client::new(),
        }
    }

    pub async fn ping(&self) -> Result<bool, reqwest::Error> {
        let res = self.client.get(format!("{}/status", self.base_url)).send().await?;
        Ok(res.status().is_success())
    }

    pub async fn run_task(&self, req: &AgentRequest) -> Result<AgentResponse, reqwest::Error> {
        let res = self.client
            .post(format!("{}/api/agent/run", self.base_url))
            .json(req)
            .send()
            .await?
            .json::<AgentResponse>()
            .await?;

        Ok(res)
    }
}
```

---

## 3. Execução Assíncrona com `tokio`

```rust
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = CromClient::new("127.0.0.1", 9090);

    let is_online = client.ping().await?;
    println!("Daemon Online: {}", is_online);

    let req = AgentRequest {
        workspace: "/tmp/crom-rust-ephemeral".to_string(),
        provider: "openrouter".to_string(),
        model: "google/gemini-2.5-flash".to_string(),
        task: "Analise o payload e retorne apenas o status em JSON".to_string(),
        max_iterations: 3,
        allowed_tools: vec![], // Pensamento puro
    };

    let res = client.run_task(&req).await?;
    println!("Status: {}", res.status);
    println!("Resultado: {:?}", res.summary);

    Ok(())
}
```
