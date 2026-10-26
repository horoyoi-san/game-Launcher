package fsService

import (
	"SilwerWolf999-launcher/pkg/constant"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

const sophonVersionFile = "version.json"

var sophonVersionPattern = regexp.MustCompile(`^[0-9]+\.[0-9]+(?:\.[0-9]+)?$`)

type sophonManifest struct {
	Version string `json:"version"`
}

func getLatestSophonVersion() (string, error) {
	request, err := http.NewRequest(http.MethodGet, constant.SophonManifestURL, nil)
	if err != nil {
		return "", fmt.Errorf("create Sophon version request: %w", err)
	}
	request.Header.Set("Cache-Control", "no-cache")
	client := &http.Client{Timeout: 20 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return "", fmt.Errorf("check Sophon version: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return "", fmt.Errorf("check Sophon version: server returned %s (publish sophon.json in the Hoyo Sophon.Downloader release)", response.Status)
	}
	var manifest sophonManifest
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&manifest); err != nil {
		return "", fmt.Errorf("read Sophon version manifest: %w", err)
	}
	manifest.Version = strings.TrimSpace(manifest.Version)
	if !sophonVersionPattern.MatchString(manifest.Version) {
		return "", fmt.Errorf("Sophon version manifest has invalid version %q", manifest.Version)
	}
	return manifest.Version, nil
}

func readSophonVersion(directory string) (string, error) {
	data, err := os.ReadFile(filepath.Join(directory, sophonVersionFile))
	if err != nil {
		return "", err
	}
	var manifest sophonManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return "", err
	}
	return manifest.Version, nil
}

func writeSophonVersion(directory, version string) error {
	data, err := json.Marshal(sophonManifest{Version: version})
	if err != nil {
		return fmt.Errorf("encode Sophon version: %w", err)
	}
	if err := os.WriteFile(filepath.Join(directory, sophonVersionFile), data, 0644); err != nil {
		return fmt.Errorf("save Sophon version: %w", err)
	}
	return nil
}
