#![warn(clippy::all)]
#![warn(missing_docs)]

//! # CromIA SDK
//! 
//! Biblioteca oficial de integração com o ecosistema CromIA. Permite a conexão
//! nativa de agentes em Rust com o Daemon local da CromIA.

use reqwest::Client;

/// Cliente base para gerenciar comunicação com o Daemon
pub struct CromClient {
    token: String,
    base_url: String,
    http_client: Client,
}

impl CromClient {
    /// Inicializa uma nova instância do cliente CromIA.
    pub fn new(token: &str, port: u16) -> Self {
        Self {
            token: token.to_string(),
            base_url: format!("http://127.0.0.1:{}/v1", port),
            http_client: Client::new(),
        }
    }

    /// Executa um ping no Daemon para validar a conexão HTTP.
    pub async fn ping(&self) -> Result<bool, reqwest::Error> {
        let url = format!("{}/status", self.base_url);
        let resp = self.http_client.get(&url).send().await?;
        Ok(resp.status().is_success())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_client_initialization() {
        let client = CromClient::new("fake_token", 17171);
        assert_eq!(client.token, "fake_token");
        assert_eq!(client.base_url, "http://127.0.0.1:17171/v1");
    }
}
