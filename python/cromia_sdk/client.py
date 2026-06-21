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
            response = requests.get(f"{self.base_url}/status")
            return response.status_code == 200
        except requests.RequestException:
            return False
