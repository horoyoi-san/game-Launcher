package gitService

import (
	"archive/zip"
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

const (
	minGitReleaseAPI = "https://api.github.com/repos/git-for-windows/git/releases/latest"
	minGitDirectory  = "./server/tools/mingit"
)

type gitRelease struct {
	Assets []struct {
		Name string `json:"name"`
		URL  string `json:"browser_download_url"`
	} `json:"assets"`
}

// ensureGit provides a private, portable Git runtime when the user has not
// installed Git system-wide. It requires no administrator privileges.
func ensureGit() (string, error) {
	if git, err := exec.LookPath("git"); err == nil {
		return git, nil
	}

	gitPath := filepath.Join(minGitDirectory, "cmd", "git.exe")
	if _, err := os.Stat(gitPath); err == nil {
		return gitPath, nil
	}
	if runtime.GOOS != "windows" || runtime.GOARCH != "amd64" {
		return "", fmt.Errorf("Git was not found on PATH, and automatic portable Git setup is currently supported on Windows x64 only")
	}

	client := &http.Client{Timeout: 2 * time.Minute}
	request, err := http.NewRequest(http.MethodGet, minGitReleaseAPI, nil)
	if err != nil {
		return "", fmt.Errorf("create Git download request: %w", err)
	}
	request.Header.Set("Accept", "application/vnd.github+json")
	request.Header.Set("User-Agent", "Sunbringer-Launcher")
	response, err := client.Do(request)
	if err != nil {
		return "", fmt.Errorf("find a portable Git release: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("find a portable Git release: GitHub returned %s", response.Status)
	}
	var release gitRelease
	if err := json.NewDecoder(io.LimitReader(response.Body, 4<<20)).Decode(&release); err != nil {
		return "", fmt.Errorf("read portable Git release metadata: %w", err)
	}
	var archiveURL string
	for _, asset := range release.Assets {
		if strings.HasPrefix(asset.Name, "MinGit-") && strings.HasSuffix(asset.Name, "-64-bit.zip") {
			archiveURL = asset.URL
			break
		}
	}
	if archiveURL == "" {
		return "", fmt.Errorf("the latest Git for Windows release does not include a MinGit x64 package")
	}

	if err := os.MkdirAll(filepath.Dir(minGitDirectory), 0755); err != nil {
		return "", fmt.Errorf("create portable Git directory: %w", err)
	}
	archive, err := os.CreateTemp(filepath.Dir(minGitDirectory), "mingit-*.zip")
	if err != nil {
		return "", fmt.Errorf("create portable Git archive: %w", err)
	}
	archivePath := archive.Name()
	defer os.Remove(archivePath)
	downloadRequest, err := http.NewRequest(http.MethodGet, archiveURL, nil)
	if err != nil {
		archive.Close()
		return "", fmt.Errorf("create portable Git download request: %w", err)
	}
	downloadRequest.Header.Set("User-Agent", "Sunbringer-Launcher")
	downloadResponse, err := client.Do(downloadRequest)
	if err != nil {
		archive.Close()
		return "", fmt.Errorf("download portable Git: %w", err)
	}
	if downloadResponse.StatusCode != http.StatusOK {
		downloadResponse.Body.Close()
		archive.Close()
		return "", fmt.Errorf("download portable Git: GitHub returned %s", downloadResponse.Status)
	}
	_, copyErr := io.Copy(archive, io.LimitReader(downloadResponse.Body, 300<<20))
	responseErr := downloadResponse.Body.Close()
	closeErr := archive.Close()
	if copyErr != nil {
		return "", fmt.Errorf("save portable Git: %w", copyErr)
	}
	if responseErr != nil {
		return "", fmt.Errorf("finish portable Git download: %w", responseErr)
	}
	if closeErr != nil {
		return "", fmt.Errorf("save portable Git: %w", closeErr)
	}

	stagingDir, err := os.MkdirTemp(filepath.Dir(minGitDirectory), "mingit-install-*")
	if err != nil {
		return "", fmt.Errorf("create portable Git staging directory: %w", err)
	}
	defer os.RemoveAll(stagingDir)
	if err := extractMinGit(archivePath, stagingDir); err != nil {
		return "", err
	}
	if _, err := os.Stat(filepath.Join(stagingDir, "cmd", "git.exe")); err != nil {
		return "", fmt.Errorf("portable Git archive is missing cmd/git.exe")
	}
	if err := os.RemoveAll(minGitDirectory); err != nil {
		return "", fmt.Errorf("replace incomplete portable Git setup: %w", err)
	}
	if err := os.Rename(stagingDir, minGitDirectory); err != nil {
		return "", fmt.Errorf("install portable Git: %w", err)
	}
	return gitPath, nil
}

func gitCommand(gitPath string, args ...string) *exec.Cmd {
	command := exec.Command(gitPath, args...)
	if filepath.IsAbs(gitPath) && strings.EqualFold(filepath.Base(filepath.Dir(gitPath)), "cmd") {
		root := filepath.Dir(filepath.Dir(gitPath))
		command.Env = append(os.Environ(), "PATH="+filepath.Join(root, "mingw64", "bin")+";"+filepath.Join(root, "usr", "bin")+";"+os.Getenv("PATH"))
	}
	return command
}

var gitProgressPattern = regexp.MustCompile(`(?i)(receiving objects|resolving deltas):\s*(\d+)%`)

func runGitWithProgress(command *exec.Cmd, action string) ([]byte, error) {
	stdout, err := command.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("read Git output: %w", err)
	}
	stderr, err := command.StderrPipe()
	if err != nil {
		return nil, fmt.Errorf("read Git progress: %w", err)
	}
	if err := command.Start(); err != nil {
		return nil, err
	}
	var stdoutOutput bytes.Buffer
	var stderrOutput bytes.Buffer
	stdoutDone := make(chan error, 1)
	go func() {
		_, copyErr := io.Copy(&stdoutOutput, stdout)
		stdoutDone <- copyErr
	}()
	application.Get().Event.Emit("download:server", map[string]interface{}{
		"percent": "0",
		"speed":   "",
		"message": action,
	})

	scanner := bufio.NewScanner(stderr)
	scanner.Buffer(make([]byte, 4096), 1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		stderrOutput.WriteString(line)
		stderrOutput.WriteByte('\n')
		match := gitProgressPattern.FindStringSubmatch(line)
		if len(match) != 3 {
			continue
		}
		phasePercent, parseErr := strconv.Atoi(match[2])
		if parseErr != nil {
			continue
		}
		percent := phasePercent * 90 / 100
		if strings.EqualFold(match[1], "resolving deltas") {
			percent = 90 + phasePercent/10
		}
		application.Get().Event.Emit("download:server", map[string]interface{}{
			"percent": fmt.Sprintf("%d", percent),
			"speed":   "",
			"message": action + " · " + strings.ToLower(match[1]),
		})
	}
	if err := scanner.Err(); err != nil {
		command.Process.Kill()
		_ = command.Wait()
		<-stdoutDone
		return append(stdoutOutput.Bytes(), stderrOutput.Bytes()...), fmt.Errorf("read Git progress: %w", err)
	}
	stdoutErr := <-stdoutDone
	waitErr := command.Wait()
	if stdoutErr != nil {
		return append(stdoutOutput.Bytes(), stderrOutput.Bytes()...), fmt.Errorf("read Git output: %w", stdoutErr)
	}
	if waitErr != nil {
		return append(stdoutOutput.Bytes(), stderrOutput.Bytes()...), waitErr
	}
	application.Get().Event.Emit("download:server", map[string]interface{}{
		"percent": "100",
		"speed":   "",
		"message": action + " · complete",
	})
	return append(stdoutOutput.Bytes(), stderrOutput.Bytes()...), nil
}

func extractMinGit(archivePath, destination string) error {
	reader, err := zip.OpenReader(archivePath)
	if err != nil {
		return fmt.Errorf("open portable Git archive: %w", err)
	}
	defer reader.Close()
	root, err := filepath.Abs(destination)
	if err != nil {
		return fmt.Errorf("resolve portable Git staging directory: %w", err)
	}
	for _, file := range reader.File {
		name := filepath.Clean(filepath.FromSlash(file.Name))
		if filepath.IsAbs(name) || name == "." || name == ".." || strings.HasPrefix(name, ".."+string(filepath.Separator)) {
			return fmt.Errorf("portable Git archive contains an unsafe path")
		}
		path := filepath.Join(root, name)
		if !strings.HasPrefix(path, root+string(filepath.Separator)) {
			return fmt.Errorf("portable Git archive contains an unsafe path")
		}
		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(path, 0755); err != nil {
				return fmt.Errorf("extract portable Git directory: %w", err)
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			return fmt.Errorf("create portable Git directory: %w", err)
		}
		source, err := file.Open()
		if err != nil {
			return fmt.Errorf("read portable Git archive: %w", err)
		}
		output, err := os.OpenFile(path, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0644)
		if err != nil {
			source.Close()
			return fmt.Errorf("extract portable Git file: %w", err)
		}
		_, copyErr := io.Copy(output, source)
		sourceErr := source.Close()
		outputErr := output.Close()
		if copyErr != nil {
			return fmt.Errorf("extract portable Git file: %w", copyErr)
		}
		if sourceErr != nil {
			return fmt.Errorf("read portable Git archive: %w", sourceErr)
		}
		if outputErr != nil {
			return fmt.Errorf("write portable Git file: %w", outputErr)
		}
	}
	return nil
}
