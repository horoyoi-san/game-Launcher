package fsService

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type GameArtwork struct {
	GameID        string `json:"gameId"`
	BackgroundURL string `json:"backgroundUrl"`
	ThumbnailURL  string `json:"thumbnailUrl"`
}

type gameArtworkResponse struct {
	RetCode int    `json:"retcode"`
	Message string `json:"message"`
	Data    struct {
		Games []struct {
			ID      string `json:"id"`
			Display struct {
				Background *struct {
					URL string `json:"url"`
				} `json:"background"`
				Thumbnail *struct {
					URL string `json:"url"`
				} `json:"thumbnail"`
			} `json:"display"`
		} `json:"games"`
	} `json:"data"`
}

func gameArtworkURL(gameIDs []string, region, launcherID string) (string, error) {
	endpoint, ok := sophonRegionEndpoints[strings.ToUpper(region)]
	if !ok {
		return "", fmt.Errorf("unsupported game artwork region: %s", region)
	}
	if len(gameIDs) == 0 {
		return "", fmt.Errorf("no game IDs configured for region %s", region)
	}

	validLauncher := false
	for _, id := range endpoint.launcherIDs {
		if id == launcherID {
			validLauncher = true
			break
		}
	}
	if !validLauncher {
		return "", fmt.Errorf("unsupported launcher ID %s for region %s", launcherID, region)
	}

	apiURL, err := url.Parse(strings.TrimSuffix(endpoint.url, "getGameBranches") + "getGames")
	if err != nil {
		return "", fmt.Errorf("invalid game artwork endpoint: %w", err)
	}
	query := apiURL.Query()
	for _, gameID := range gameIDs {
		if gameID == "" {
			return "", fmt.Errorf("empty game ID for region %s", region)
		}
		query.Add("game_ids[]", gameID)
	}
	query.Set("launcher_id", launcherID)
	apiURL.RawQuery = query.Encode()
	return apiURL.String(), nil
}

func (f *FSService) GetGameArtwork(gameIDs []string, region, launcherID string) ([]GameArtwork, error) {
	requestURL, err := gameArtworkURL(gameIDs, region, launcherID)
	if err != nil {
		return nil, err
	}

	client := &http.Client{Timeout: 15 * time.Second}
	response, err := client.Get(requestURL)
	if err != nil {
		return nil, fmt.Errorf("could not load game artwork: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("game artwork API returned %s", response.Status)
	}

	var payload gameArtworkResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("could not decode game artwork response: %w", err)
	}
	if payload.RetCode != 0 {
		return nil, fmt.Errorf("game artwork API error %d: %s", payload.RetCode, payload.Message)
	}

	artwork := make([]GameArtwork, 0, len(payload.Data.Games))
	for _, game := range payload.Data.Games {
		item := GameArtwork{GameID: game.ID}
		if game.Display.Background != nil {
			item.BackgroundURL = game.Display.Background.URL
		}
		if game.Display.Thumbnail != nil {
			item.ThumbnailURL = game.Display.Thumbnail.URL
		}
		artwork = append(artwork, item)
	}
	return artwork, nil
}
