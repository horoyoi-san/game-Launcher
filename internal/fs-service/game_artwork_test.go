package fsService

import (
	"net/url"
	"reflect"
	"testing"
)

func TestGameArtworkURL(t *testing.T) {
	tests := []struct {
		name        string
		region      string
		launcherID  string
		gameIDs     []string
		wantHost    string
		wantGameIDs []string
		wantErr     bool
	}{
		{
			name:        "global release",
			region:      "OSREL",
			launcherID:  "VYTpXlbWo8",
			gameIDs:     []string{"viiywh5G2H", "U5hbdsT9W7"},
			wantHost:    "sg-hyp-api.hoyoverse.com",
			wantGameIDs: []string{"viiywh5G2H", "U5hbdsT9W7"},
		},
		{
			name:        "China beta",
			region:      "CNBETA",
			launcherID:  "TATUNXLuIq",
			gameIDs:     []string{"pkMBmK7jxJ"},
			wantHost:    "hyp-api-beta.mihoyo.com",
			wantGameIDs: []string{"pkMBmK7jxJ"},
		},
		{
			name:        "global beta",
			region:      "OSBETA",
			launcherID:  "95ODRGH3xC",
			gameIDs:     []string{"4qvmDrMwKS"},
			wantHost:    "sg-hyp-api-beta.hoyoverse.com",
			wantGameIDs: []string{"4qvmDrMwKS"},
		},
		{
			name:       "unsupported launcher",
			region:     "OSREL",
			launcherID: "TATUNXLuIq",
			gameIDs:    []string{"game-id"},
			wantErr:    true,
		},
		{
			name:       "unsupported region",
			region:     "unknown",
			launcherID: "launcher-id",
			gameIDs:    []string{"game-id"},
			wantErr:    true,
		},
		{
			name:       "missing game IDs",
			region:     "OSREL",
			launcherID: "VYTpXlbWo8",
			wantErr:    true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			requestURL, err := gameArtworkURL(test.gameIDs, test.region, test.launcherID)
			if (err != nil) != test.wantErr {
				t.Fatalf("gameArtworkURL() error = %v, wantErr %v", err, test.wantErr)
			}
			if test.wantErr {
				return
			}

			parsedURL, err := url.Parse(requestURL)
			if err != nil {
				t.Fatalf("url.Parse() error = %v", err)
			}
			if parsedURL.Host != test.wantHost {
				t.Errorf("host = %q, want %q", parsedURL.Host, test.wantHost)
			}
			if parsedURL.Path != "/hyp/hyp-connect/api/getGames" {
				t.Errorf("path = %q, want getGames API path", parsedURL.Path)
			}
			if parsedURL.Query().Get("launcher_id") != test.launcherID {
				t.Errorf("launcher_id = %q, want %q", parsedURL.Query().Get("launcher_id"), test.launcherID)
			}
			if gotGameIDs := parsedURL.Query()["game_ids[]"]; !reflect.DeepEqual(gotGameIDs, test.wantGameIDs) {
				t.Errorf("game_ids[] = %v, want %v", gotGameIDs, test.wantGameIDs)
			}
		})
	}
}
