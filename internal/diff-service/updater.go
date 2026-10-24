package diffService

import (
	"archive/zip"
	"bufio"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sunbringer-launcher/pkg/constant"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type DiffService struct{}

const diffUpdaterPath = "Updater/HappyGenyuanImsactUpdate.exe"
const ziftExecutablePath = "bin/zift.exe"

var ziftPercentPattern = regexp.MustCompile(`(?i)(\d+(?:\.\d+)?)\s*%`)
var ziftANSIPattern = regexp.MustCompile(`\x1b\[[0-?]*[ -/]*[@-~]`)

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
	if strings.EqualFold(filepath.Ext(patchPath), ".ziff") {
		return applyZiff(gamePath, patchPath)
	}
	if !isSupportedPatchArchive(patchPath) {
		return false, "select a .zip, .7z, or .ziff patch file"
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
		if cwdPath, cwdErr := filepath.Abs(filepath.FromSlash(diffUpdaterPath)); cwdErr == nil {
			if _, statErr := os.Stat(cwdPath); statErr == nil {
				updaterPath = cwdPath
			}
		}
	}
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

func applyZiff(gamePath, patchPath string) (bool, string) {
	launcherPath, err := os.Executable()
	if err != nil {
		return false, fmt.Sprintf("locate launcher directory: %v", err)
	}
	launcherDir := filepath.Dir(launcherPath)
	ziftPath := filepath.Join(launcherDir, filepath.FromSlash(ziftExecutablePath))
	if _, err := os.Stat(ziftPath); err != nil {
		if cwdPath, cwdErr := filepath.Abs(filepath.FromSlash(ziftExecutablePath)); cwdErr == nil {
			if _, statErr := os.Stat(cwdPath); statErr == nil {
				ziftPath = cwdPath
			}
		}
	}
	if _, err := os.Stat(ziftPath); err != nil {
		return false, fmt.Sprintf("Zift executable not found at %s: %v", ziftPath, err)
	}
	if info, err := os.Stat(patchPath); err != nil || !info.Mode().IsRegular() {
		if err != nil {
			return false, fmt.Sprintf("patch file is unavailable: %v", err)
		}
		return false, "selected patch is not a file"
	}
	cmd := exec.Command(ziftPath, "-a", "-y", patchPath, gamePath)
	cmd.Dir = launcherDir
	outputReader, outputWriter := io.Pipe()
	cmd.Stdout = outputWriter
	cmd.Stderr = outputWriter
	application.Get().Event.Emit("diff:ziff-progress", map[string]interface{}{
		"message": "Starting Zift…",
		"percent": -1.0,
	})
	outputDone := make(chan string, 1)
	go func() { outputDone <- collectZiftOutput(outputReader) }()
	if err := cmd.Start(); err != nil {
		_ = outputWriter.Close()
		message := <-outputDone
		if message != "" {
			return false, fmt.Sprintf("run Zift: %v\n%s", err, message)
		}
		return false, fmt.Sprintf("run Zift: %v", err)
	}
	err = cmd.Wait()
	_ = outputWriter.Close()
	message := strings.TrimSpace(<-outputDone)
	if err != nil {
		if message == "" {
			return false, fmt.Sprintf("run Zift: %v", err)
		}
		return false, fmt.Sprintf("Zift failed: %v\n%s", err, message)
	}
	if message == "" {
		message = "Ziff patch applied successfully"
	}
	return true, message
}

func collectZiftOutput(reader io.Reader) string {
	buffered := bufio.NewReader(reader)
	var output strings.Builder
	var line strings.Builder
	emitLine := func() {
		text := strings.TrimSpace(ziftANSIPattern.ReplaceAllString(line.String(), ""))
		line.Reset()
		if text == "" {
			return
		}
		output.WriteString(text)
		output.WriteByte('\n')
		progress := -1.0
		if match := ziftPercentPattern.FindStringSubmatch(text); len(match) > 1 {
			if value, err := strconv.ParseFloat(match[1], 64); err == nil && value >= 0 && value <= 100 {
				progress = value
			}
		}
		application.Get().Event.Emit("diff:ziff-progress", map[string]interface{}{
			"message": text,
			"percent": progress,
		})
	}

	for {
		value, err := buffered.ReadByte()
		if err != nil {
			if line.Len() > 0 {
				emitLine()
			}
			break
		}
		if value == '\r' || value == '\n' {
			emitLine()
			continue
		}
		line.WriteByte(value)
	}
	return output.String()
}

// ApplyDiffZiffCopy applies a Ziff delta to a staged copy of the source game,
// then swaps the completed copy into an empty destination directory.
func (h *DiffService) ApplyDiffZiffCopy(sourcePath, patchPath, outputPath string) (bool, string) {
	sourcePath, err := filepath.Abs(sourcePath)
	if err != nil {
		return false, fmt.Sprintf("resolve source game folder: %v", err)
	}
	if info, err := os.Stat(sourcePath); err != nil || !info.IsDir() {
		if err != nil {
			return false, fmt.Sprintf("source game folder is unavailable: %v", err)
		}
		return false, "source game path is not a folder"
	}
	patchPath, err = filepath.Abs(patchPath)
	if err != nil {
		return false, fmt.Sprintf("resolve Ziff patch path: %v", err)
	}
	if !strings.EqualFold(filepath.Ext(patchPath), ".ziff") {
		return false, "select a .ziff patch file"
	}
	if info, err := os.Stat(patchPath); err != nil || !info.Mode().IsRegular() {
		if err != nil {
			return false, fmt.Sprintf("Ziff patch file is unavailable: %v", err)
		}
		return false, "selected Ziff patch is not a file"
	}
	outputPath, err = filepath.Abs(outputPath)
	if err != nil {
		return false, fmt.Sprintf("resolve output folder: %v", err)
	}
	// filepath.Rel rejects paths on different Windows volumes. Those paths are
	// necessarily separate trees, so only compare relative paths on one volume.
	if strings.EqualFold(filepath.VolumeName(sourcePath), filepath.VolumeName(outputPath)) {
		relativeOutput, err := filepath.Rel(sourcePath, outputPath)
		if err != nil {
			return false, fmt.Sprintf("compare source and output folders: %v", err)
		}
		if relativeOutput == "." || (relativeOutput != ".." && !strings.HasPrefix(relativeOutput, ".."+string(filepath.Separator))) {
			return false, "output folder must be outside the source game folder"
		}
	}
	outputInfo, err := os.Stat(outputPath)
	if err != nil {
		return false, fmt.Sprintf("select an existing empty output folder: %v", err)
	}
	if !outputInfo.IsDir() {
		return false, "output path is not a folder"
	}
	outputEntries, err := os.ReadDir(outputPath)
	if err != nil {
		return false, fmt.Sprintf("read output folder: %v", err)
	}
	if len(outputEntries) != 0 {
		return false, "output folder must be empty; choose a new empty folder to protect existing files"
	}

	parent := filepath.Dir(outputPath)
	stagingPath, err := os.MkdirTemp(parent, ".sunbringer-ziff-copy-")
	if err != nil {
		return false, fmt.Sprintf("prepare separate game copy: %v", err)
	}
	defer os.RemoveAll(stagingPath)
	if err := copyDirectoryContents(sourcePath, stagingPath); err != nil {
		return false, fmt.Sprintf("copy source game to staging folder: %v", err)
	}
	if ok, message := applyZiff(stagingPath, patchPath); !ok {
		return false, message
	}

	backupPath, err := os.MkdirTemp(parent, ".sunbringer-ziff-empty-")
	if err != nil {
		return false, fmt.Sprintf("prepare output folder swap: %v", err)
	}
	if err := os.Remove(backupPath); err != nil {
		return false, fmt.Sprintf("prepare output folder swap: %v", err)
	}
	if err := os.Rename(outputPath, backupPath); err != nil {
		return false, fmt.Sprintf("reserve empty output folder: %v", err)
	}
	if err := os.Rename(stagingPath, outputPath); err != nil {
		_ = os.Rename(backupPath, outputPath)
		return false, fmt.Sprintf("install updated game copy: %v", err)
	}
	if err := os.Remove(backupPath); err != nil {
		return true, fmt.Sprintf("Ziff patch applied to separate game copy, but could not remove empty staging folder %s: %v", backupPath, err)
	}
	return true, "Ziff patch applied to a separate game copy; the original game folder was not changed"
}

func copyDirectoryContents(sourcePath, destinationPath string) error {
	return filepath.WalkDir(sourcePath, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if path == sourcePath {
			return nil
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return fmt.Errorf("symbolic links are not supported in game copy: %s", path)
		}
		relative, err := filepath.Rel(sourcePath, path)
		if err != nil {
			return err
		}
		target := filepath.Join(destinationPath, relative)
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return os.MkdirAll(target, info.Mode().Perm())
		}
		if !info.Mode().IsRegular() {
			return fmt.Errorf("unsupported file type in game copy: %s", path)
		}
		if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			return err
		}
		input, err := os.Open(path)
		if err != nil {
			return err
		}
		output, err := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, info.Mode().Perm())
		if err != nil {
			_ = input.Close()
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
		return outputErr
	})
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
