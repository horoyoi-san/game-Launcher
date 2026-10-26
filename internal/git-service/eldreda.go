package gitService

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sunbringer-launcher/pkg/constant"
)

func (g *GitService) DownloadEldredaServerProgress() (bool, string) {
	if err := os.MkdirAll(constant.ServerStorageUrl, 0755); err != nil {
		return false, err.Error()
	}
	if err := ensureEldredaSource(); err != nil {
		return false, err.Error()
	}

	zigExecutable, err := filepath.Abs(constant.EldredaZigExecutable)
	if err != nil {
		return false, fmt.Errorf("resolve Zig 0.17.0 path: %w", err).Error()
	}
	if regularFileExists(zigExecutable) {
		version, err := exec.Command(zigExecutable, "version").Output()
		if err == nil && strings.TrimSpace(string(version)) == "0.17.0" {
			return true, ""
		}
		if err := os.RemoveAll(constant.EldredaZigStorageDir); err != nil {
			return false, fmt.Errorf("replace existing Zig 0.17.0 compiler: %w", err).Error()
		}
	}

	archivePath := filepath.Join(constant.ServerStorageUrl, constant.EldredaZigArchiveFile)
	if err := g.downloadNAPAsset(constant.EldredaZigDownloadURL, archivePath, "download:server", 0, 100); err != nil {
		return false, err.Error()
	}
	return true, ""
}

func (g *GitService) BuildEldredaServer() (bool, string) {
	zigExecutable, err := filepath.Abs(constant.EldredaZigExecutable)
	if err != nil {
		return false, fmt.Errorf("resolve Zig 0.17.0 path: %w", err).Error()
	}
	if !regularFileExists(zigExecutable) {
		archivePath := filepath.Join(constant.ServerStorageUrl, constant.EldredaZigArchiveFile)
		if err := os.RemoveAll(constant.EldredaZigStorageDir); err != nil {
			return false, fmt.Errorf("clear incomplete Zig 0.17.0 installation: %w", err).Error()
		}
		if err := g.unzipParallel(archivePath, filepath.Dir(constant.EldredaZigStorageDir)); err != nil {
			return false, fmt.Errorf("extract Zig 0.17.0: %w", err).Error()
		}
		if err := os.Remove(archivePath); err != nil && !os.IsNotExist(err) {
			return false, fmt.Errorf("remove Zig 0.17.0 archive: %w", err).Error()
		}
	}
	if !regularFileExists(filepath.Join(constant.EldredaStorageDir, "build.zig")) {
		return false, fmt.Sprintf("Eldreda source is missing build.zig: %s", constant.EldredaStorageDir)
	}
	version, err := exec.Command(zigExecutable, "version").Output()
	if err != nil || strings.TrimSpace(string(version)) != "0.17.0" {
		return false, fmt.Sprintf("Zig 0.17.0 was not found at %s", zigExecutable)
	}
	build := exec.Command(zigExecutable, "build")
	build.Dir = constant.EldredaStorageDir
	output, err := build.CombinedOutput()
	if err != nil {
		return false, fmt.Sprintf("build Eldreda with Zig 0.17.0: %v\n%s", err, strings.TrimSpace(string(output)))
	}
	return true, ""
}

func ensureEldredaSource() error {
	gitPath, err := ensureGit()
	if err != nil {
		return fmt.Errorf("Git is required to download the Eldreda source: %w", err)
	}
	repositoryDir := constant.EldredaStorageDir
	if regularFileExists(filepath.Join(repositoryDir, "build.zig")) {
		gitPull := gitCommand(gitPath, "-C", repositoryDir, "pull", "--ff-only", "--progress")
		if output, err := runGitWithProgress(gitPull, "Updating Eldreda source"); err != nil {
			return fmt.Errorf("update Eldreda source: %w\n%s", err, strings.TrimSpace(string(output)))
		}
		return nil
	}
	if _, err := os.Stat(repositoryDir); err == nil {
		return fmt.Errorf("Eldreda folder exists but is not a valid checkout: %s", repositoryDir)
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("inspect Eldreda folder %s: %w", repositoryDir, err)
	}
	stagingRoot, err := os.MkdirTemp(constant.ServerStorageUrl, "eldreda-clone-*")
	if err != nil {
		return fmt.Errorf("create Eldreda staging folder: %w", err)
	}
	defer os.RemoveAll(stagingRoot)
	stagingRepository := filepath.Join(stagingRoot, "eldreda")
	clone := gitCommand(gitPath, "clone", "--progress", "--single-branch", constant.EldredaRepositoryURL, stagingRepository)
	output, err := runGitWithProgress(clone, "Downloading Eldreda source")
	if err != nil {
		return fmt.Errorf("clone Eldreda source: %w\n%s", err, strings.TrimSpace(string(output)))
	}
	if !regularFileExists(filepath.Join(stagingRepository, "build.zig")) {
		return fmt.Errorf("Eldreda repository did not contain build.zig")
	}
	if err := os.Rename(stagingRepository, repositoryDir); err != nil {
		return fmt.Errorf("install Eldreda source: %w", err)
	}
	return nil
}
