class CromClient:
    """
    Cliente principal para conexão com o Daemon local da CromIA.
    """

    def __init__(self, token: str, port: int = 17171):
        self.token = token
        self.base_url = f"http://127.0.0.1:{port}/v1"

    def ping(self) -> bool:
        """
        Verifica se o Daemon está online e acessível.
        """
        import requests
        try:
            # Tenta na rota global do daemon e com fallback para a base_url
            root_url = self.base_url.replace("/v1", "")
            response = requests.get(f"{root_url}/status")
            if response.status_code == 200:
                return True
            response = requests.get(f"{self.base_url}/status")
            return response.status_code == 200
        except requests.RequestException:
            return False

    def get_agent_telemetry(self, workspace: str) -> dict:
        """
        Retorna a telemetria consolidada de um workspace.
        """
        import requests
        headers = {}
        if self.token:
            headers["X-Session-Token"] = self.token
            headers["Authorization"] = f"Bearer {self.token}"
        root_url = self.base_url.replace("/v1", "")
        params = {"workspace": workspace}
        if self.token:
            params["token"] = self.token
        response = requests.get(f"{root_url}/api/agent/telemetry", params=params, headers=headers)
        response.raise_for_status()
        return response.json()

    def stream_agent_telemetry(self, workspace: str, on_update):
        """
        Inicia um streaming via WebSocket da telemetria do workspace,
        chamando o callback `on_update` a cada nova mensagem.
        Retorna uma função para fechar a conexão.
        """
        import asyncio
        import threading
        import websockets
        import json

        loop = asyncio.new_event_loop()
        stop_event = asyncio.Event()

        async def _stream():
            from urllib.parse import urlparse
            parsed = urlparse(self.base_url)
            host = parsed.hostname or "127.0.0.1"
            port = parsed.port or 17171
            ws_proto = "wss" if parsed.scheme == "https" else "ws"
            
            token_query = f"&token={self.token}" if self.token else ""
            ws_url = f"{ws_proto}://{host}:{port}/api/agent/telemetry/ws?workspace={workspace}{token_query}"

            try:
                async with websockets.connect(ws_url) as websocket:
                    while not stop_event.is_set():
                        try:
                            message = await asyncio.wait_for(websocket.recv(), timeout=0.5)
                            data = json.loads(message)
                            if asyncio.iscoroutinefunction(on_update):
                                await on_update(data)
                            else:
                                on_update(data)
                        except asyncio.TimeoutError:
                            continue
                        except websockets.ConnectionClosed:
                            break
            except Exception as e:
                # Silencia erros se estivemos parando
                if not stop_event.is_set():
                    print(f"[CromClient] Erro no stream de telemetria: {e}")

        def run_loop():
            asyncio.set_event_loop(loop)
            loop.run_until_complete(_stream())

        t = threading.Thread(target=run_loop, daemon=True)
        t.start()

        def unsubscribe():
            loop.call_soon_threadsafe(stop_event.set)
            def close_loop():
                loop.stop()
            loop.call_soon_threadsafe(close_loop)

        return unsubscribe
