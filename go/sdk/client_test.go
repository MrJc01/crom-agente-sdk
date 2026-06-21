package sdk

import (
	"testing"
)

func TestNewClient(t *testing.T) {
	client := NewClient("fake_token", 17171)

	if client.Token != "fake_token" {
		t.Errorf("Expected token to be fake_token, got %s", client.Token)
	}

	if client.BaseURL != "http://127.0.0.1:17171/v1" {
		t.Errorf("Expected BaseURL to be http://127.0.0.1:17171/v1, got %s", client.BaseURL)
	}
}
