package gitService

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"sunbringer-launcher/pkg/constant"
)

var (
	eldredaGameTagPattern = regexp.MustCompile(`(?m)^\s*\.tag\s*=\s*"([^"]+)"\s*,?`)
	remielleGameTagPattern = regexp.MustCompile(`(?m)^\s*\.@"([^"]+)"\s*=\s*\.`)
)

// GetNAPServerGameVersion reads the client version configured by the selected server.
func (g *GitService) GetNAPServerGameVersion(serverChoice string) (string, string) {
	var configPath string
	var pattern *regexp.Regexp
	switch strings.ToLower(strings.TrimSpace(serverChoice)) {
	case "eldreda":
		configPath = filepath.Join(constant.EldredaStorageDir, "defaults", "eldreda.zon")
		pattern = eldredaGameTagPattern
	case "remielle":
		configPath = filepath.Join(constant.RemielleStorageDir, "dpsv", "config.zon")
		pattern = remielleGameTagPattern
	default:
		return "", fmt.Sprintf("unsupported NAP server: %s", serverChoice)
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return "", fmt.Errorf("read %s server version config %s: %w", serverChoice, configPath, err).Error()
	}
	match := pattern.FindSubmatch(data)
	if len(match) < 2 {
		return "", fmt.Sprintf("could not find configured game version in %s", configPath)
	}
	return string(match[1]), ""
}
