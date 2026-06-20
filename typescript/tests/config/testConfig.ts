import { CromClient, CromClientOptions } from "../../src/index.js";

// Configurações padrão de teste
export const TEST_DAEMON_HOST = "localhost";
export const TEST_DAEMON_PORT = 9090;
export const TEST_CLOUD_URL = "https://cloud.ia.crom.run";
export const TEST_SESSION_TOKEN = "sess-token-12345";
export const TEST_DAEMON_TOKEN = "daem-token-67890";

// Configuração padrão do modelo de teste (DeepSeek V4 Flash via OpenRouter)
export const DEFAULT_TEST_PROVIDER = "openrouter";
export const DEFAULT_TEST_MODEL = "deepseek/deepseek-v4-flash";

/**
 * Cria uma instância de CromClient pré-configurada para ambientes de teste.
 * Permite sobrescrever opções se necessário.
 */
export function createTestClient(options: Partial<CromClientOptions> = {}): CromClient {
  return new CromClient({
    daemonHost: TEST_DAEMON_HOST,
    daemonPort: TEST_DAEMON_PORT,
    cloudUrl: TEST_CLOUD_URL,
    sessionToken: TEST_SESSION_TOKEN,
    daemonToken: TEST_DAEMON_TOKEN,
    ...options,
  });
}
