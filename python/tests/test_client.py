from cromia_sdk.client import CromClient

def test_client_init():
    client = CromClient(token="test_token", port=17171)
    assert client.token == "test_token"
    assert client.base_url == "http://127.0.0.1:17171/v1"

def test_client_ping_mocked(monkeypatch):
    class MockResponse:
        status_code = 200

    def mock_get(*args, **kwargs):
        return MockResponse()

    monkeypatch.setattr("requests.get", mock_get)

    client = CromClient(token="test_token")
    assert client.ping() is True
