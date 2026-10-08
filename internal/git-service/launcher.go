package gitService

import (
	"SilwerWolf999-launcher/pkg/constant"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/minio/selfupdate"
)

type GitService struct{}

type launcherManifest struct {
	Version string `json:"version"`
	SHA256  string `json:"sha256"`
}

var launcherVersionPattern = regexp.MustCompile(`^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$`)

func (g *GitService) GetLatestLauncherVersion() (bool, string, string) {
	manifest, err := fetchLauncherManifest(constant.LauncherManifestURL)
	if err != nil {
		return false, "", err.Error()
	}
	return true, manifest.Version, ""
}

func (g *GitService) UpdateLauncherProgress(version string) (bool, string) {
	manifest, err := fetchLauncherManifest(constant.LauncherManifestURL)
	if err != nil {
		return false, err.Error()
	}
	if manifest.Version != version {
		return false, fmt.Sprintf("launcher update changed from %s to %s; check again", version, manifest.Version)
	}

	resp, err := (&http.Client{Timeout: 5 * time.Minute}).Get(constant.LauncherDownloadURL)
	if err != nil {
		return false, fmt.Errorf("download launcher update: %w", err).Error()
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return false, fmt.Sprintf("download launcher update: server returned %s", resp.Status)
	}

	temporaryFile, err := os.CreateTemp("", "launcher-update-*.exe")
	if err != nil {
		return false, fmt.Errorf("create temporary launcher update: %w", err).Error()
	}
	temporaryPath := temporaryFile.Name()
	defer os.Remove(temporaryPath)

	hash := sha256.New()
	if _, err := io.Copy(io.MultiWriter(temporaryFile, hash), resp.Body); err != nil {
		temporaryFile.Close()
		return false, fmt.Errorf("save launcher update: %w", err).Error()
	}
	if err := temporaryFile.Close(); err != nil {
		return false, fmt.Errorf("close launcher update: %w", err).Error()
	}
	actualHash := hash.Sum(nil)
	expectedHash, err := hex.DecodeString(manifest.SHA256)
	if err != nil || len(expectedHash) != sha256.Size || subtle.ConstantTimeCompare(actualHash, expectedHash) != 1 {
		return false, "launcher update checksum mismatch"
	}

	temporaryFile, err = os.Open(temporaryPath)
	if err != nil {
		return false, fmt.Errorf("open launcher update: %w", err).Error()
	}
	defer temporaryFile.Close()
	if err := selfupdate.Apply(temporaryFile, selfupdate.Options{}); err != nil {
		return false, fmt.Errorf("apply launcher update: %w", err).Error()
	}
	return true, ""
}

func fetchLauncherManifest(manifestURL string) (launcherManifest, error) {
	client := &http.Client{Timeout: 20 * time.Second}
	response, err := client.Get(manifestURL)
	if err != nil {
		return launcherManifest{}, fmt.Errorf("check launcher updates: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return launcherManifest{}, fmt.Errorf("check launcher updates: server returned %s", response.Status)
	}

	var manifest launcherManifest
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&manifest); err != nil {
		return launcherManifest{}, fmt.Errorf("read launcher update manifest: %w", err)
	}
	if !launcherVersionPattern.MatchString(manifest.Version) {
		return launcherManifest{}, fmt.Errorf("launcher update manifest has invalid version %q", manifest.Version)
	}
	manifest.SHA256 = strings.TrimSpace(manifest.SHA256)
	if len(manifest.SHA256) != sha256.Size*2 {
		return launcherManifest{}, fmt.Errorf("launcher update manifest has invalid SHA-256")
	}
	if _, err := hex.DecodeString(manifest.SHA256); err != nil {
		return launcherManifest{}, fmt.Errorf("launcher update manifest has invalid SHA-256: %w", err)
	}
	manifest.SHA256 = strings.ToLower(manifest.SHA256)
	return manifest, nil
}
