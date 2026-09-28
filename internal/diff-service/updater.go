package diffService

import (
	"SilwerWolf999-launcher/pkg/constant"
	"archive/zip"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const diffUpdaterPath = "Updater/HappyGenyuanImsactUpdate.exe"

func (h *DiffService) ApplyDiffZip(gamePath, patchPath string) (bool, string) {
	gamePath, err := filepath.Abs(gamePath)
	if err != nil {
		return false, err.Error()
	}
	if info, err := os.Stat(gamePath); err != nil || !info.IsDir() {
		if err != nil {
			return false, fmt.Sprintf("game folder is unavailable: %v", err)
		}
		return false, "selected game path is not a folder"
	}

	patchPath, err = filepath.Abs(patchPath)
	if err != nil {
		return false, err.Error()
	}
	if !isSupportedPatchArchive(patchPath) {
		return false, "select a .zip or .7z patch archive"
	}
	if info, err := os.Stat(patchPath); err != nil || !info.Mode().IsRegular() {
		if err != nil {
			return false, fmt.Sprintf("patch file is unavailable: %v", err)
		}
		return false, "selected patch is not a file"
	}

	launcherPath, err := os.Executable()
	if err != nil {
		return false, err.Error()
	}
	launcherDir := filepath.Dir(launcherPath)
	updaterPath := filepath.Join(launcherDir, filepath.FromSlash(diffUpdaterPath))
	if _, err := os.Stat(updaterPath); err != nil {
		if err := downloadAndExtractDiffUpdater(launcherDir); err != nil {
			return false, err.Error()
		}
	}
	if _, err := os.Stat(updaterPath); err != nil {
		return false, fmt.Sprintf("diff updater executable not found at %s: %v", updaterPath, err)
	}

	cmd := exec.Command(
		updaterPath,
		"-patchAt", gamePath,
		"-checkmode", "0",
		"-zip_count", "1",
		patchPath,
		"--config_change_guidance", "false",
	)
	cmd.Dir = filepath.Dir(updaterPath)
	output, err := cmd.CombinedOutput()
	message := strings.TrimSpace(string(output))
	if err != nil {
		if message == "" {
			return false, fmt.Sprintf("run diff updater: %v", err)
		}
		return false, fmt.Sprintf("diff updater failed: %v\n%s", err, message)
	}
	return true, message
}

func isSupportedPatchArchive(path string) bool {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".zip", ".7z":
		return true
	default:
		return false
	}
}

func downloadAndExtractDiffUpdater(destination string) error {
	client := &http.Client{Timeout: 2 * time.Minute}
	response, err := client.Get(constant.DiffUpdaterGitUrl)
	if err != nil {
		return fmt.Errorf("download diff updater: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("download diff updater: server returned %s", response.Status)
	}

	archive, err := os.CreateTemp("", "launcher-diff-*.zip")
	if err != nil {
		return fmt.Errorf("create diff updater archive: %w", err)
	}
	archivePath := archive.Name()
	defer os.Remove(archivePath)
	_, copyErr := io.Copy(archive, response.Body)
	closeErr := archive.Close()
	if copyErr != nil {
		return fmt.Errorf("save diff updater archive: %w", copyErr)
	}
	if closeErr != nil {
		return fmt.Errorf("close diff updater archive: %w", closeErr)
	}
	if err := extractUpdaterArchive(archivePath, destination); err != nil {
		return fmt.Errorf("extract diff updater: %w", err)
	}
	return nil
}

func extractUpdaterArchive(archivePath, destination string) error {
	archive, err := zip.OpenReader(archivePath)
	if err != nil {
		return fmt.Errorf("open archive: %w", err)
	}
	defer archive.Close()

	destination, err = filepath.Abs(destination)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(destination, 0755); err != nil {
		return err
	}

	for _, entry := range archive.File {
		name := strings.ReplaceAll(entry.Name, "\\", "/")
		relativePath := filepath.Clean(filepath.FromSlash(name))
		if !filepath.IsLocal(relativePath) {
			return fmt.Errorf("unsafe archive path: %q", entry.Name)
		}
		path := filepath.Join(destination, relativePath)
		if entry.FileInfo().IsDir() {
			if err := os.MkdirAll(path, 0755); err != nil {
				return err
			}
			continue
		}
		if entry.Mode()&os.ModeSymlink != 0 {
			return fmt.Errorf("symbolic links are not allowed in updater archive: %q", entry.Name)
		}
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			return err
		}

		mode := entry.Mode().Perm()
		if mode == 0 {
			mode = 0644
		}
		output, err := os.OpenFile(path, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, mode)
		if err != nil {
			return err
		}
		input, err := entry.Open()
		if err != nil {
			_ = output.Close()
			return err
		}
		_, copyErr := io.Copy(output, input)
		inputErr := input.Close()
		outputErr := output.Close()
		if copyErr != nil {
			return copyErr
		}
		if inputErr != nil {
			return inputErr
		}
		if outputErr != nil {
			return outputErr
		}
	}
	return nil
}
