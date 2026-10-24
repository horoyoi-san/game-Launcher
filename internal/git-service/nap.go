package gitService

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sunbringer-launcher/pkg/constant"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func (g *GitService) DownloadNAPServerProgress() (bool, string) {
	if err := os.MkdirAll(constant.ServerStorageUrl, 0755); err != nil {
		return false, err.Error()
	}

	if err := ensureRemielleSource(); err != nil {
		return false, err.Error()
	}

	zigExecutable, err := filepath.Abs(constant.ZigExecutable)
	if err != nil {
		return false, fmt.Errorf("resolve Zig 0.16.0 path: %w", err).Error()
	}
	if regularFileExists(zigExecutable) {
		version, err := exec.Command(zigExecutable, "version").Output()
		if err == nil && strings.TrimSpace(string(version)) == "0.16.0" {
			return true, ""
		}
		if err := os.RemoveAll(constant.ZigStorageDir); err != nil {
			return false, fmt.Errorf("replace existing Zig compiler: %w", err).Error()
		}
	}

	archivePath := filepath.Join(constant.ServerStorageUrl, constant.ZigArchiveFile)
	if err := g.downloadNAPAsset(constant.ZigDownloadURL, archivePath, "download:server", 0, 100); err != nil {
		return false, err.Error()
	}
	return true, ""
}

func (g *GitService) ExtractNAPServer() (bool, string) {
	zigExecutable, err := filepath.Abs(constant.ZigExecutable)
	if err != nil {
		return false, fmt.Errorf("resolve Zig 0.16.0 path: %w", err).Error()
	}
	if !regularFileExists(zigExecutable) {
		archivePath := filepath.Join(constant.ServerStorageUrl, constant.ZigArchiveFile)
		if err := os.RemoveAll(constant.ZigStorageDir); err != nil {
			return false, fmt.Errorf("clear incomplete Zig installation: %w", err).Error()
		}
		if err := g.unzipParallel(archivePath, constant.ZigStorageDir); err != nil {
			return false, fmt.Errorf("extract Zig 0.16.0: %w", err).Error()
		}
		if err := os.Remove(archivePath); err != nil && !os.IsNotExist(err) {
			return false, fmt.Errorf("remove Zig archive: %w", err).Error()
		}
	}

	if !regularFileExists(filepath.Join(constant.RemielleStorageDir, "build.zig")) {
		return false, fmt.Sprintf("Remielle source is missing build.zig: %s", constant.RemielleStorageDir)
	}
	version, err := exec.Command(zigExecutable, "version").Output()
	if err != nil || strings.TrimSpace(string(version)) != "0.16.0" {
		return false, fmt.Sprintf("Zig 0.16.0 was not found at %s", zigExecutable)
	}

	build := exec.Command(zigExecutable, "build")
	build.Dir = constant.RemielleStorageDir
	output, err := build.CombinedOutput()
	if err != nil {
		return false, fmt.Sprintf("build Remielle with Zig 0.16.0: %v\n%s", err, strings.TrimSpace(string(output)))
	}
	return true, ""
}

func ensureRemielleSource() error {
	repositoryDir := constant.RemielleStorageDir
	if regularFileExists(filepath.Join(repositoryDir, "build.zig")) {
		gitPull := exec.Command("git", "-C", repositoryDir, "pull", "--ff-only", "origin", constant.RemielleBranch)
		if output, err := gitPull.CombinedOutput(); err != nil {
			return fmt.Errorf("update Remielle branch %s: %w\n%s", constant.RemielleBranch, err, strings.TrimSpace(string(output)))
		}
		return nil
	}

	if _, err := os.Stat(repositoryDir); err == nil {
		return fmt.Errorf("Remielle folder exists but is not a valid checkout: %s", repositoryDir)
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("inspect Remielle folder %s: %w", repositoryDir, err)
	}

	stagingRoot, err := os.MkdirTemp(constant.ServerStorageUrl, "remielle-clone-*")
	if err != nil {
		return fmt.Errorf("create Remielle staging folder: %w", err)
	}
	defer os.RemoveAll(stagingRoot)
	stagingRepository := filepath.Join(stagingRoot, "remielle")
	clone := exec.Command("git", "clone", "--branch", constant.RemielleBranch, "--single-branch", constant.RemielleRepositoryURL, stagingRepository)
	output, err := clone.CombinedOutput()
	if err != nil {
		return fmt.Errorf("clone Remielle branch %s: %w\n%s", constant.RemielleBranch, err, strings.TrimSpace(string(output)))
	}
	if !regularFileExists(filepath.Join(stagingRepository, "build.zig")) {
		return fmt.Errorf("Remielle branch %s did not contain build.zig", constant.RemielleBranch)
	}
	if err := os.Rename(stagingRepository, repositoryDir); err != nil {
		return fmt.Errorf("install Remielle source: %w", err)
	}
	return nil
}

func (g *GitService) DownloadNAPPatchProgress() (bool, string) {
	patchFiles := []struct {
		name string
		url  string
	}{
		{name: "Sunbringer.exe", url: constant.NAPPatchSunbringerURL},
		{name: "Roscaelifer.dll", url: constant.NAPPatchCovenantDLLURL},
	}

	for index, patchFile := range patchFiles {
		progressStart := float64(index) * 50
		if err := g.downloadNAPAsset(
			patchFile.url,
			filepath.Join(constant.NAPPatchStorageUrl, patchFile.name),
			"download:patch",
			progressStart,
			50,
		); err != nil {
			return false, fmt.Errorf("download %s: %w", patchFile.name, err).Error()
		}
	}
	return true, ""
}

func (g *GitService) InstallNAPPatch(gameDir string) (bool, string) {
	if strings.TrimSpace(gameDir) == "" {
		return false, "game directory is not selected"
	}
	absoluteGameDir, err := filepath.Abs(gameDir)
	if err != nil {
		return false, fmt.Errorf("resolve game directory: %w", err).Error()
	}
	info, err := os.Stat(absoluteGameDir)
	if err != nil {
		return false, fmt.Errorf("open game directory: %w", err).Error()
	}
	if !info.IsDir() {
		return false, "game path is not a directory"
	}

	patchFiles := []patchFile{
		{
			source:      filepath.Join(constant.NAPPatchStorageUrl, "Sunbringer.exe"),
			destination: filepath.Join(absoluteGameDir, "Sunbringer.exe"),
		},
		{
			source:      filepath.Join(constant.NAPPatchStorageUrl, "Roscaelifer.dll"),
			destination: filepath.Join(absoluteGameDir, "Roscaelifer.dll"),
		},
	}
	if err := installPatchFiles(absoluteGameDir, patchFiles); err != nil {
		return false, fmt.Errorf("install NAP patch: %w", err).Error()
	}
	return true, ""
}

func (g *GitService) downloadNAPAsset(
	assetURL string,
	destination string,
	eventName string,
	progressStart float64,
	progressScale float64,
) error {
	if !strings.HasPrefix(assetURL, "https://") {
		return fmt.Errorf("refusing non-HTTPS asset URL")
	}
	if err := os.MkdirAll(filepath.Dir(destination), 0755); err != nil {
		return fmt.Errorf("create download directory: %w", err)
	}

	request, err := http.NewRequest(http.MethodGet, assetURL, nil)
	if err != nil {
		return fmt.Errorf("create download request: %w", err)
	}
	client := &http.Client{
		Timeout: 20 * time.Minute,
		CheckRedirect: func(request *http.Request, _ []*http.Request) error {
			if request.URL.Scheme != "https" {
				return fmt.Errorf("refusing non-HTTPS asset redirect")
			}
			return nil
		},
	}
	response, err := client.Do(request)
	if err != nil {
		return fmt.Errorf("download asset: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("download asset: server returned %s", response.Status)
	}

	temporaryFile, err := os.CreateTemp(filepath.Dir(destination), filepath.Base(destination)+".tmp-*")
	if err != nil {
		return fmt.Errorf("create temporary download: %w", err)
	}
	temporaryPath := temporaryFile.Name()
	defer os.Remove(temporaryPath)

	buffer := make([]byte, 128*1024)
	var downloaded int64
	started := time.Now()
	for {
		count, readErr := response.Body.Read(buffer)
		if count > 0 {
			written, writeErr := temporaryFile.Write(buffer[:count])
			if writeErr != nil {
				temporaryFile.Close()
				return fmt.Errorf("write downloaded asset: %w", writeErr)
			}
			if written != count {
				temporaryFile.Close()
				return io.ErrShortWrite
			}
			downloaded += int64(written)
			if response.ContentLength > 0 {
				percent := progressStart + float64(downloaded)/float64(response.ContentLength)*progressScale
				speed := float64(downloaded) / max(time.Since(started).Seconds(), 0.001)
				application.Get().Event.Emit(eventName, map[string]interface{}{
					"percent": fmt.Sprintf("%.2f", min(percent, progressStart+progressScale)),
					"speed":   fmt.Sprintf("%s/s", HumanFormat(speed)),
				})
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			temporaryFile.Close()
			return fmt.Errorf("read downloaded asset: %w", readErr)
		}
	}
	if err := temporaryFile.Close(); err != nil {
		return fmt.Errorf("close downloaded asset: %w", err)
	}
	if response.ContentLength >= 0 && downloaded != response.ContentLength {
		return fmt.Errorf("incomplete download: received %d of %d bytes", downloaded, response.ContentLength)
	}
	if err := os.Remove(destination); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("replace existing asset: %w", err)
	}
	if err := os.Rename(temporaryPath, destination); err != nil {
		return fmt.Errorf("save downloaded asset: %w", err)
	}
	application.Get().Event.Emit(eventName, map[string]interface{}{
		"percent": fmt.Sprintf("%.2f", progressStart+progressScale),
		"speed":   "",
	})
	return nil
}

func regularFileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.Mode().IsRegular()
}

type patchFile struct {
	source      string
	destination string
}

type patchInstallEntry struct {
	patchFile
	stagedPath       string
	originalPath     string
	originalMoved    bool
	newFileInstalled bool
}

func installPatchFiles(gameDir string, patchFiles []patchFile) error {
	entries := make([]patchInstallEntry, 0, len(patchFiles))
	defer func() {
		for _, entry := range entries {
			if entry.stagedPath != "" {
				_ = os.Remove(entry.stagedPath)
			}
			if entry.originalPath != "" && !entry.originalMoved {
				_ = os.Remove(entry.originalPath)
			}
		}
	}()

	for _, patch := range patchFiles {
		if !regularFileExists(patch.source) {
			return fmt.Errorf("patch asset not found: %s", patch.source)
		}
		entry := patchInstallEntry{patchFile: patch}
		stagedFile, err := os.CreateTemp(gameDir, ".sunbringer-patch-stage-*")
		if err != nil {
			return fmt.Errorf("stage patch file: %w", err)
		}
		entry.stagedPath = stagedFile.Name()
		if err := copyFileContents(stagedFile, patch.source); err != nil {
			stagedFile.Close()
			entries = append(entries, entry)
			return err
		}
		if err := stagedFile.Close(); err != nil {
			entries = append(entries, entry)
			return fmt.Errorf("close staged patch file: %w", err)
		}
		if err := preserveOriginalPatchFile(patch.destination); err != nil {
			entries = append(entries, entry)
			return err
		}
		entries = append(entries, entry)
	}

	for index := range entries {
		entry := &entries[index]
		if info, err := os.Stat(entry.destination); err == nil {
			if !info.Mode().IsRegular() {
				return rollbackPatchFiles(entries, fmt.Errorf("patch destination is not a file: %s", entry.destination))
			}
			originalFile, err := os.CreateTemp(gameDir, ".sunbringer-patch-original-*")
			if err != nil {
				return rollbackPatchFiles(entries, fmt.Errorf("prepare patch rollback: %w", err))
			}
			entry.originalPath = originalFile.Name()
			if err := originalFile.Close(); err != nil {
				return rollbackPatchFiles(entries, fmt.Errorf("close patch rollback file: %w", err))
			}
			if err := os.Remove(entry.originalPath); err != nil {
				return rollbackPatchFiles(entries, fmt.Errorf("prepare patch rollback: %w", err))
			}
			if err := os.Rename(entry.destination, entry.originalPath); err != nil {
				return rollbackPatchFiles(entries, fmt.Errorf("move existing patch destination: %w", err))
			}
			entry.originalMoved = true
		} else if !os.IsNotExist(err) {
			return rollbackPatchFiles(entries, fmt.Errorf("inspect patch destination: %w", err))
		}

		if err := os.Rename(entry.stagedPath, entry.destination); err != nil {
			return rollbackPatchFiles(entries, fmt.Errorf("install patch file: %w", err))
		}
		entry.stagedPath = ""
		entry.newFileInstalled = true
	}

	for _, entry := range entries {
		if entry.originalMoved {
			if err := os.Remove(entry.originalPath); err != nil {
				return fmt.Errorf("remove temporary patch rollback file: %w", err)
			}
		}
	}
	return nil
}

func preserveOriginalPatchFile(destination string) error {
	info, err := os.Stat(destination)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("inspect existing patch destination: %w", err)
	}
	if !info.Mode().IsRegular() {
		return fmt.Errorf("patch destination is not a file: %s", destination)
	}

	backupPath := destination + ".sunbringer-backup"
	if backupInfo, err := os.Stat(backupPath); err == nil {
		if !backupInfo.Mode().IsRegular() {
			return fmt.Errorf("patch backup is not a file: %s", backupPath)
		}
		return nil
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("inspect patch backup: %w", err)
	}

	backupFile, err := os.CreateTemp(filepath.Dir(destination), ".sunbringer-patch-backup-*")
	if err != nil {
		return fmt.Errorf("create patch backup: %w", err)
	}
	temporaryBackupPath := backupFile.Name()
	defer os.Remove(temporaryBackupPath)
	if err := copyFileContents(backupFile, destination); err != nil {
		backupFile.Close()
		return fmt.Errorf("write patch backup: %w", err)
	}
	if err := backupFile.Close(); err != nil {
		return fmt.Errorf("close patch backup: %w", err)
	}
	if err := os.Rename(temporaryBackupPath, backupPath); err != nil {
		return fmt.Errorf("save patch backup: %w", err)
	}
	return nil
}

func copyFileContents(destination *os.File, sourcePath string) error {
	source, err := os.Open(sourcePath)
	if err != nil {
		return fmt.Errorf("open patch source: %w", err)
	}
	defer source.Close()
	if _, err := io.Copy(destination, source); err != nil {
		return fmt.Errorf("copy patch file: %w", err)
	}
	return nil
}

func rollbackPatchFiles(entries []patchInstallEntry, cause error) error {
	for index := len(entries) - 1; index >= 0; index-- {
		entry := &entries[index]
		if entry.newFileInstalled {
			if err := os.Remove(entry.destination); err != nil && !os.IsNotExist(err) {
				cause = fmt.Errorf("%w; remove partially installed file: %v", cause, err)
			}
		}
		if entry.originalMoved {
			if err := os.Rename(entry.originalPath, entry.destination); err != nil {
				cause = fmt.Errorf("%w; restore original patch file: %v", cause, err)
			} else {
				entry.originalMoved = false
			}
		}
	}
	return cause
}
