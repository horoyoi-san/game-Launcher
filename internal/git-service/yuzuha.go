package gitService

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sunbringer-launcher/pkg/constant"
	"sunbringer-launcher/pkg/hiddenexec"
)

func (g *GitService) DownloadYuzuhaServerProgress() (bool, string) {
	if err := os.MkdirAll(constant.ServerStorageUrl, 0755); err != nil {
		return false, err.Error()
	}
	if err := ensureYuzuhaSource(); err != nil {
		return false, err.Error()
	}

	zigExecutable, err := filepath.Abs(constant.YuzuhaZigExecutable)
	if err != nil {
		return false, fmt.Errorf("resolve Zig 0.17.0 path: %w", err).Error()
	}
	if regularFileExists(zigExecutable) {
		versionCommand := exec.Command(zigExecutable, "version")
		hiddenexec.HideWindow(versionCommand)
		version, err := versionCommand.Output()
		if err == nil && strings.TrimSpace(string(version)) == "0.17.0" {
			return true, ""
		}
		if err := os.RemoveAll(constant.YuzuhaZigStorageDir); err != nil {
			return false, fmt.Errorf("replace existing Zig 0.17.0 compiler: %w", err).Error()
		}
	}

	archivePath := filepath.Join(constant.ServerStorageUrl, constant.YuzuhaZigArchiveFile)
	if err := g.downloadNAPAsset(constant.YuzuhaZigDownloadURL, archivePath, "download:server", 0, 100); err != nil {
		return false, err.Error()
	}
	return true, ""
}

func (g *GitService) BuildYuzuhaServer() (bool, string) {
	zigExecutable, err := filepath.Abs(constant.YuzuhaZigExecutable)
	if err != nil {
		return false, fmt.Errorf("resolve Zig 0.17.0 path: %w", err).Error()
	}
	if !regularFileExists(zigExecutable) {
		archivePath := filepath.Join(constant.ServerStorageUrl, constant.YuzuhaZigArchiveFile)
		if err := os.RemoveAll(constant.YuzuhaZigStorageDir); err != nil {
			return false, fmt.Errorf("clear incomplete Zig 0.17.0 installation: %w", err).Error()
		}
		if err := g.unzipParallel(archivePath, filepath.Dir(constant.YuzuhaZigStorageDir)); err != nil {
			return false, fmt.Errorf("extract Zig 0.17.0: %w", err).Error()
		}
		if err := os.Remove(archivePath); err != nil && !os.IsNotExist(err) {
			return false, fmt.Errorf("remove Zig 0.17.0 archive: %w", err).Error()
		}
	}
	if !regularFileExists(filepath.Join(constant.YuzuhaStorageDir, "build.zig")) {
		return false, fmt.Sprintf("Yuzuha source is missing build.zig: %s", constant.YuzuhaStorageDir)
	}
	versionCommand := exec.Command(zigExecutable, "version")
	hiddenexec.HideWindow(versionCommand)
	version, err := versionCommand.Output()
	if err != nil || strings.TrimSpace(string(version)) != "0.17.0" {
		return false, fmt.Sprintf("Zig 0.17.0 was not found at %s", zigExecutable)
	}
	build := exec.Command(zigExecutable, "build")
	hiddenexec.HideWindow(build)
	build.Dir = constant.YuzuhaStorageDir
	output, err := build.CombinedOutput()
	if err != nil {
		return false, fmt.Sprintf("build Yuzuha with Zig 0.17.0: %v\n%s", err, strings.TrimSpace(string(output)))
	}
	return true, ""
}

func ensureYuzuhaSource() error {
	gitPath, err := ensureGit()
	if err != nil {
		return fmt.Errorf("Git is required to download the Yuzuha source: %w", err)
	}
	repositoryDir := constant.YuzuhaStorageDir
	if regularFileExists(filepath.Join(repositoryDir, "build.zig")) {
		gitPull := gitCommand(gitPath, "-C", repositoryDir, "pull", "--ff-only", "--progress")
		if output, err := runGitWithProgress(gitPull, "Updating Yuzuha source"); err != nil {
			return fmt.Errorf("update Yuzuha source: %w\n%s", err, strings.TrimSpace(string(output)))
		}
		return nil
	}
	if _, err := os.Stat(repositoryDir); err == nil {
		return fmt.Errorf("Yuzuha folder exists but is not a valid checkout: %s", repositoryDir)
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("inspect Yuzuha folder %s: %w", repositoryDir, err)
	}
	stagingRoot, err := os.MkdirTemp(constant.ServerStorageUrl, "yuzuha-clone-*")
	if err != nil {
		return fmt.Errorf("create Yuzuha staging folder: %w", err)
	}
	defer os.RemoveAll(stagingRoot)
	stagingRepository := filepath.Join(stagingRoot, "yuzuha")
	clone := gitCommand(gitPath, "clone", "--progress", "--single-branch", constant.YuzuhaRepositoryURL, stagingRepository)
	output, err := runGitWithProgress(clone, "Downloading Yuzuha source")
	if err != nil {
		return fmt.Errorf("clone Yuzuha source: %w\n%s", err, strings.TrimSpace(string(output)))
	}
	if !regularFileExists(filepath.Join(stagingRepository, "build.zig")) {
		return fmt.Errorf("Yuzuha repository did not contain build.zig")
	}
	if err := os.Rename(stagingRepository, repositoryDir); err != nil {
		return fmt.Errorf("install Yuzuha source: %w", err)
	}
	return nil
}
