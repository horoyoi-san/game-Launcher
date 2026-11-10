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

func (g *GitService) DownloadKafkaServerProgress() (bool, string) {
	if err := os.MkdirAll(constant.ServerStorageUrl, 0755); err != nil {
		return false, err.Error()
	}
	if err := ensureKafkaSource(); err != nil {
		return false, err.Error()
	}

	zigExecutable, err := filepath.Abs(constant.KafkaZigExecutable)
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
		if err := os.RemoveAll(constant.KafkaZigStorageDir); err != nil {
			return false, fmt.Errorf("replace existing Zig 0.17.0 compiler: %w", err).Error()
		}
	}

	archivePath := filepath.Join(constant.ServerStorageUrl, constant.KafkaZigArchiveFile)
	if err := g.downloadNAPAsset(constant.KafkaZigDownloadURL, archivePath, "download:server", 0, 100); err != nil {
		return false, err.Error()
	}
	return true, ""
}

func (g *GitService) BuildKafkaServer() (bool, string) {
	zigExecutable, err := filepath.Abs(constant.KafkaZigExecutable)
	if err != nil {
		return false, fmt.Errorf("resolve Zig 0.17.0 path: %w", err).Error()
	}
	if !regularFileExists(zigExecutable) {
		archivePath := filepath.Join(constant.ServerStorageUrl, constant.KafkaZigArchiveFile)
		if err := os.RemoveAll(constant.KafkaZigStorageDir); err != nil {
			return false, fmt.Errorf("clear incomplete Zig 0.17.0 installation: %w", err).Error()
		}
		if err := g.unzipParallel(archivePath, filepath.Dir(constant.KafkaZigStorageDir)); err != nil {
			return false, fmt.Errorf("extract Zig 0.17.0: %w", err).Error()
		}
		if err := os.Remove(archivePath); err != nil && !os.IsNotExist(err) {
			return false, fmt.Errorf("remove Zig 0.17.0 archive: %w", err).Error()
		}
	}
	if !regularFileExists(filepath.Join(constant.KafkaStorageDir, "build.zig")) {
		return false, fmt.Sprintf("Kafka source is missing build.zig: %s", constant.KafkaStorageDir)
	}
	versionCommand := exec.Command(zigExecutable, "version")
	hiddenexec.HideWindow(versionCommand)
	version, err := versionCommand.Output()
	if err != nil || strings.TrimSpace(string(version)) != "0.17.0" {
		return false, fmt.Sprintf("Zig 0.17.0 was not found at %s", zigExecutable)
	}
	build := exec.Command(zigExecutable, "build")
	hiddenexec.HideWindow(build)
	build.Dir = constant.KafkaStorageDir
	output, err := build.CombinedOutput()
	if err != nil {
		return false, fmt.Sprintf("build Kafka with Zig 0.17.0: %v\n%s", err, strings.TrimSpace(string(output)))
	}
	return true, ""
}

func ensureKafkaSource() error {
	gitPath, err := ensureGit()
	if err != nil {
		return fmt.Errorf("Git is required to download the Kafka source: %w", err)
	}
	repositoryDir := constant.KafkaStorageDir
	if regularFileExists(filepath.Join(repositoryDir, "build.zig")) {
		gitPull := gitCommand(gitPath, "-C", repositoryDir, "pull", "--ff-only", "--progress")
		if output, err := runGitWithProgress(gitPull, "Updating Kafka source"); err != nil {
			return fmt.Errorf("update Kafka source: %w\n%s", err, strings.TrimSpace(string(output)))
		}
		return nil
	}
	if _, err := os.Stat(repositoryDir); err == nil {
		return fmt.Errorf("Kafka folder exists but is not a valid checkout: %s", repositoryDir)
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("inspect Kafka folder %s: %w", repositoryDir, err)
	}
	stagingRoot, err := os.MkdirTemp(constant.ServerStorageUrl, "kafka-clone-*")
	if err != nil {
		return fmt.Errorf("create Kafka staging folder: %w", err)
	}
	defer os.RemoveAll(stagingRoot)
	stagingRepository := filepath.Join(stagingRoot, "kafka")
	clone := gitCommand(gitPath, "clone", "--progress", "--single-branch", constant.KafkaRepositoryURL, stagingRepository)
	output, err := runGitWithProgress(clone, "Downloading Kafka source")
	if err != nil {
		return fmt.Errorf("clone Kafka source: %w\n%s", err, strings.TrimSpace(string(output)))
	}
	if !regularFileExists(filepath.Join(stagingRepository, "build.zig")) {
		return fmt.Errorf("Kafka repository did not contain build.zig")
	}
	if err := os.Rename(stagingRepository, repositoryDir); err != nil {
		return fmt.Errorf("install Kafka source: %w", err)
	}
	return nil
}
