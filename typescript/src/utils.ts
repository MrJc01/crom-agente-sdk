/**
 * Decodifica e faz o parsing de dados recebidos pelo daemon.
 * Lida com strings JSON normais e também com objetos Uint8Array serializados.
 */
export function parseDaemonPayload(responseData: any): any {
  if (!responseData) return null;

  if (typeof responseData === "string") {
    try {
      return JSON.parse(responseData);
    } catch (e) {
      return responseData;
    }
  }

  if (typeof responseData === "object" && !Array.isArray(responseData)) {
    // Verifica se é um Uint8Array serializado como objeto {"0": 123, "1": 34}
    const keys = Object.keys(responseData);
    const isBufferLike = keys.length > 0 && keys.every((k) => !isNaN(Number(k)));

    if (!isBufferLike) {
      return responseData; // Objeto JSON comum
    }

    try {
      const uint8 = new Uint8Array(Object.values(responseData));
      const decoded = new TextDecoder().decode(uint8);
      return JSON.parse(decoded);
    } catch (e) {
      return responseData;
    }
  }

  return responseData;
}
