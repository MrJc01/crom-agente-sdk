package sdk

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/crom/crom-agente/internal/orchestrator"
	"github.com/gorilla/websocket"
)

// CromClient é o cliente oficial para integração em Go com a CromIA.
type CromClient struct {
	Token      string
	BaseURL    string
	HTTPClient *http.Client
}

// NewClient inicializa um CromClient.
func NewClient(token string, port int) *CromClient {
	return &CromClient{
		Token:   token,
		BaseURL: fmt.Sprintf("http://127.0.0.1:%d/v1", port),
		HTTPClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// Ping verifica se o Daemon local está ativo.
func (c *CromClient) Ping() (bool, error) {
	// Tenta com fallback para sem prefixo /v1
	rootURL := c.BaseURL
	if len(rootURL) > 3 && rootURL[len(rootURL)-3:] == "/v1" {
		rootURL = rootURL[:len(rootURL)-3]
	}
	resp, err := c.HTTPClient.Get(fmt.Sprintf("%s/status", rootURL))
	if err != nil {
		resp2, err2 := c.HTTPClient.Get(fmt.Sprintf("%s/status", c.BaseURL))
		if err2 != nil {
			return false, err2
		}
		defer resp2.Body.Close()
		return resp2.StatusCode == http.StatusOK, nil
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK, nil
}

// GetAgentTelemetry retorna a telemetria consolidada de um workspace.
func (c *CromClient) GetAgentTelemetry(workspace string) (*orchestrator.AgentTelemetry, error) {
	rootURL := c.BaseURL
	if len(rootURL) > 3 && rootURL[len(rootURL)-3:] == "/v1" {
		rootURL = rootURL[:len(rootURL)-3]
	}

	reqURL := fmt.Sprintf("%s/api/agent/telemetry?workspace=%s", rootURL, url.QueryEscape(workspace))
	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, err
	}

	if c.Token != "" {
		req.Header.Set("X-Session-Token", c.Token)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.Token))
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("daemon retornou status %d", resp.StatusCode)
	}

	var telemetry orchestrator.AgentTelemetry
	if err := json.NewDecoder(resp.Body).Decode(&telemetry); err != nil {
		return nil, err
	}

	return &telemetry, nil
}

// StreamAgentTelemetry conecta via WebSocket para receber atualizações de telemetria em tempo real.
func (c *CromClient) StreamAgentTelemetry(workspace string) (<-chan orchestrator.AgentTelemetry, func(), error) {
	u, err := url.Parse(c.BaseURL)
	if err != nil {
		return nil, nil, err
	}
	wsProto := "ws"
	if u.Scheme == "https" {
		wsProto = "wss"
	}
	wsHost := u.Host

	// Remove /v1 se estiver no Host ou se reconstruir a url
	wsUrl := url.URL{
		Scheme: wsProto,
		Host:   wsHost,
		Path:   "/api/agent/telemetry/ws",
	}
	q := wsUrl.Query()
	q.Set("workspace", workspace)
	if c.Token != "" {
		q.Set("token", c.Token)
	}
	wsUrl.RawQuery = q.Encode()

	conn, _, err := websocket.DefaultDialer.Dial(wsUrl.String(), nil)
	if err != nil {
		return nil, nil, err
	}

	ch := make(chan orchestrator.AgentTelemetry, 10)
	done := make(chan struct{})

	go func() {
		defer close(ch)
		defer conn.Close()
		for {
			select {
			case <-done:
				return
			default:
				var t orchestrator.AgentTelemetry
				err := conn.ReadJSON(&t)
				if err != nil {
					return
				}
				select {
				case ch <- t:
				default:
				}
			}
		}
	}()

	closeFunc := func() {
		close(done)
		conn.Close()
	}

	return ch, closeFunc, nil
}
