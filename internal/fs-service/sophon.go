package fsService

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

type SophonVersion struct {
	GameID     string `json:"gameId"`
	LauncherID string `json:"launcherId"`
	Region     string `json:"region"`
	Version    string `json:"version"`
	Branch     string `json:"branch"`
}

type sophonBranchesResponse struct {
	RetCode int    `json:"retcode"`
	Message string `json:"message"`
	Data    struct {
		GameBranches []struct {
			Game struct {
				ID string `json:"id"`
			} `json:"game"`
			Main *struct {
				Tag string `json:"tag"`
			} `json:"main"`
			PreDownload *struct {
				Tag string `json:"tag"`
			} `json:"pre_download"`
		} `json:"game_branches"`
	} `json:"data"`
}

var sophonRegionEndpoints = map[string]struct {
	url         string
	launcherIDs []string
}{
	"OSREL": {
		url:         "https://sg-hyp-api.hoyoverse.com/hyp/hyp-connect/api/getGameBranches",
		launcherIDs: []string{"VYTpXlbWo8", "dYgxEMpG3U"},
	},
	"CNREL": {
		url:         "https://hyp-api.mihoyo.com/hyp/hyp-connect/api/getGameBranches",
		launcherIDs: []string{"jGHBHlcOq1"},
	},
	"OSBETA": {
		url:         "https://sg-hyp-api-beta.hoyoverse.com/hyp/hyp-connect/api/getGameBranches",
		launcherIDs: []string{"9HDza24TWA", "95ODRGH3xC", "KAGKS3zS99"},
	},
	"CNBETA": {
		url:         "https://hyp-api-beta.mihoyo.com/hyp/hyp-connect/api/getGameBranches",
		launcherIDs: []string{"GcFHm7rte6", "kwykHprMm9", "TC4836G73s", "WBjNy0hOrG", "TATUNXLuIq"},
	},
}

func (f *FSService) GetSophonVersions(gameIDs []string, region string) ([]SophonVersion, error) {
	region = strings.ToUpper(region)
	endpoint, ok := sophonRegionEndpoints[region]
	if !ok {
		return nil, fmt.Errorf("unsupported Sophon region: %s", region)
	}
	if len(gameIDs) == 0 {
		return nil, fmt.Errorf("no Sophon game IDs configured for region %s", region)
	}

	client := &http.Client{Timeout: 15 * time.Second}
	type result struct {
		versions []SophonVersion
		err      error
	}
	results := make(chan result, len(gameIDs)*len(endpoint.launcherIDs))
	requests := 0

	for _, gameID := range gameIDs {
		for _, launcherID := range endpoint.launcherIDs {
			requests++
			go func(gameID, launcherID string) {
				item := result{}
				defer func() { results <- item }()

				query := url.Values{}
				query.Set("game_id", gameID)
				query.Set("launcher_id", launcherID)
				requestURL := endpoint.url + "?" + query.Encode()
				response, err := client.Get(requestURL)
				if err != nil {
					item.err = err
					return
				}
				defer response.Body.Close()
				if response.StatusCode < 200 || response.StatusCode >= 300 {
					item.err = fmt.Errorf("Sophon version API returned %s", response.Status)
					return
				}

				var payload sophonBranchesResponse
				if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
					item.err = err
					return
				}
				if payload.RetCode != 0 {
					item.err = fmt.Errorf("Sophon version API error %d: %s", payload.RetCode, payload.Message)
					return
				}

				for _, game := range payload.Data.GameBranches {
					if game.Game.ID != gameID {
						continue
					}
					if game.Main != nil && game.Main.Tag != "" {
						item.versions = append(item.versions, SophonVersion{GameID: gameID, LauncherID: launcherID, Region: region, Version: game.Main.Tag, Branch: "main"})
					}
					if game.PreDownload != nil && game.PreDownload.Tag != "" {
						item.versions = append(item.versions, SophonVersion{GameID: gameID, LauncherID: launcherID, Region: region, Version: game.PreDownload.Tag, Branch: "pre_download"})
					}
				}
			}(gameID, launcherID)
		}
	}

	var versions []SophonVersion
	var firstErr error
	timer := time.NewTimer(16 * time.Second)
	defer timer.Stop()
	for i := 0; i < requests; i++ {
		select {
		case item := <-results:
			versions = append(versions, item.versions...)
			if firstErr == nil && item.err != nil {
				firstErr = item.err
			}
		case <-timer.C:
			return nil, fmt.Errorf("timed out checking Sophon versions")
		}
	}

	if len(versions) == 0 {
		if firstErr != nil {
			return nil, firstErr
		}
		return nil, fmt.Errorf("no Sophon versions found for region %s", region)
	}

	sort.SliceStable(versions, func(i, j int) bool {
		if versions[i].Branch != versions[j].Branch {
			return versions[i].Branch == "main"
		}
		return compareVersion(versions[i].Version, versions[j].Version)
	})
	return versions, nil
}

func compareVersion(left, right string) bool {
	leftParts := strings.Split(left, ".")
	rightParts := strings.Split(right, ".")
	for i := 0; i < len(leftParts) && i < len(rightParts); i++ {
		leftNumber, leftErr := strconv.Atoi(leftParts[i])
		rightNumber, rightErr := strconv.Atoi(rightParts[i])
		if leftErr != nil || rightErr != nil {
			return left > right
		}
		if leftNumber != rightNumber {
			return leftNumber > rightNumber
		}
	}
	return len(leftParts) > len(rightParts)
}
