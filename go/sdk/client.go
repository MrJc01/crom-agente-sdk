package sdk

import (
	"fmt"
	"net/http"
	"time"
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
	resp, err := c.HTTPClient.Get(fmt.Sprintf("%s/status", c.BaseURL))
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK, nil
}
