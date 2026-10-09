package gitService

import (
	"Cyrene-launcher/pkg/constant"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func (g *GitService) DownloadHKRPGServerProgress() (bool, string) {
	err := g.downloadHKRPGAsset(
		constant.HKRPGServerDownloadURL,
		filepath.Join(constant.ServerStorageUrl, constant.HKRPGServerArchiveFile),
		"download:server",
		0,
		100,
	)
	if err != nil {
		return false, err.Error()
	}
	return true, ""
}

func (g *GitService) ExtractHKRPGServer() (bool, string) {
	archivePath := filepath.Join(constant.ServerStorageUrl, constant.HKRPGServerArchiveFile)
	if err := g.unzipParallel(archivePath, constant.ServerStorageUrl); err != nil {
		return false, fmt.Errorf("extract HKRPG server: %w", err).Error()
	}

	for _, name := range []string{constant.HKRPGServerExecutable, constant.HKRPGSDKServerExecutable} {
		if !regularFileExists(filepath.Join(constant.ServerStorageUrl, name)) {
			return false, fmt.Sprintf("server archive did not contain %s", name)
		}
	}
	if err := os.Remove(archivePath); err != nil && !os.IsNotExist(err) {
		return false, fmt.Errorf("remove server archive: %w", err).Error()
	}
	return true, ""
}

func (g *GitService) DownloadHKRPGProxyProgress() (bool, string) {
	err := g.downloadHKRPGAsset(
		constant.HKRPGProxyDownloadURL,
		filepath.Join(constant.ProxyStorageUrl, constant.HKRPGProxyArchiveFile),
		"download:proxy",
		0,
		100,
	)
	if err != nil {
		return false, err.Error()
	}
	return true, ""
}

func (g *GitService) ExtractHKRPGProxy() (bool, string) {
	archivePath := filepath.Join(constant.ProxyStorageUrl, constant.HKRPGProxyArchiveFile)
	if err := os.MkdirAll(constant.ProxyStorageUrl, 0755); err != nil {
		return false, fmt.Errorf("create proxy directory: %w", err).Error()
	}
	if err := g.startProxyExtractor(archivePath); err != nil {
		return false, fmt.Errorf("extract proxy archive: %w", err).Error()
	}
	if !regularFileExists(filepath.Join(constant.ProxyStorageUrl, "Proxy.exe")) {
		return false, "proxy archive did not contain Proxy.exe"
	}
	if err := os.Remove(archivePath); err != nil && !os.IsNotExist(err) {
		return false, fmt.Errorf("remove proxy archive: %w", err).Error()
	}
	return true, ""
}

func (g *GitService) DownloadHKRPGPatchProgress() (bool, string) {
	patchFiles := []struct {
		name string
		url  string
	}{
		{name: "launcher.exe", url: constant.HKRPGPatchLauncherURL},
		{name: "hkrpg.dll", url: constant.HKRPGPatchDLLURL},
	}

	for index, patchFile := range patchFiles {
		progressStart := float64(index) * 50
		if err := g.downloadHKRPGAsset(
			patchFile.url,
			filepath.Join(constant.HKRPGPatchStorageUrl, patchFile.name),
			"download:patch",
			progressStart,
			50,
		); err != nil {
			return false, fmt.Errorf("download %s: %w", patchFile.name, err).Error()
		}
	}
	return true, ""
}

func (g *GitService) InstallHKRPGPatch(gameDir string) (bool, string) {
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
			source:      filepath.Join(constant.HKRPGPatchStorageUrl, "launcher.exe"),
			destination: filepath.Join(absoluteGameDir, "launcher.exe"),
		},
		{
			source:      filepath.Join(constant.HKRPGPatchStorageUrl, "hkrpg.dll"),
			destination: filepath.Join(absoluteGameDir, "hkrpg.dll"),
		},
	}
	if err := installPatchFiles(absoluteGameDir, patchFiles); err != nil {
		return false, fmt.Errorf("install HKRPG patch: %w", err).Error()
	}
	return true, ""
}

func (g *GitService) downloadHKRPGAsset(
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
		stagedFile, err := os.CreateTemp(gameDir, ".cyrene-patch-stage-*")
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
			originalFile, err := os.CreateTemp(gameDir, ".cyrene-patch-original-*")
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

	backupPath := destination + ".cyrene-backup"
	if backupInfo, err := os.Stat(backupPath); err == nil {
		if !backupInfo.Mode().IsRegular() {
			return fmt.Errorf("patch backup is not a file: %s", backupPath)
		}
		return nil
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("inspect patch backup: %w", err)
	}

	backupFile, err := os.CreateTemp(filepath.Dir(destination), ".cyrene-patch-backup-*")
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

func (g *GitService) startProxyExtractor(archivePath string) error {
	command := exec.Command(constant.Tool7zaExe.String(), "x", archivePath, "-o"+constant.ProxyStorageUrl, "-y")
	output, err := command.CombinedOutput()
	if err != nil {
		return fmt.Errorf("7-Zip extraction failed: %w: %s", err, strings.TrimSpace(string(output)))
	}
	return nil
}
