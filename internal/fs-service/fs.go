package fsService

import (
	"SilwerWolf999-launcher/pkg/constant"
	"SilwerWolf999-launcher/pkg/sevenzip"
	"archive/zip"
	"bufio"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"golang.org/x/sys/windows"
)

type FSService struct{}
type ProgressWriter struct{}

func (f *FSService) PickFolder() (string, error) {
	dialog := application.Get().Dialog.OpenFile().
		CanChooseDirectories(true).
		CanCreateDirectories(true).
		ResolvesAliases(true)
	if runtime.GOOS == "darwin" {
		dialog.SetMessage("Select a file/directory")
	} else {
		dialog.SetTitle("Select a file/directory")
	}
	if path, err := dialog.PromptForSingleSelection(); err == nil {
		return path, nil
	}
	return "", nil
}

func (f *FSService) PickFile(filter string) (string, error) {
	dialog := application.Get().Dialog.OpenFile().
		CanChooseFiles(true).
		ResolvesAliases(true)
	if runtime.GOOS == "darwin" {
		dialog.SetMessage("Select a file/directory")
	} else {
		dialog.SetTitle("Select a file/directory")
	}
	if filter == "exe" {
		dialog.AddFilter("Executable Files (*.exe)", "*.exe")
	} else if filter == "zip" {
		dialog.AddFilter("ZIP archives (*.zip)", "*.zip")
	} else if filter == "patch" {
		dialog.AddFilter("Patch archives (*.zip;*.7z)", "*.zip;*.7z")
	}
	if path, err := dialog.PromptForSingleSelection(); err == nil {
		return path, nil
	}
	return "", nil
}

func (f *FSService) DirExists(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return info.IsDir()
}

func (f *FSService) FileExists(path string) bool {
	if info, err := os.Stat(path); err == nil {
		return info.Mode().IsRegular()
	}
	return false
}

func (f *FSService) GetDir(path string) string {
	return filepath.Dir(path)
}

func (f *FSService) Join(paths ...string) string {
	return filepath.Join(paths...)
}

func (f *FSService) RemoveFile(path string) error {
	return os.Remove(path)
}

func (f *FSService) StartApp(path string) (bool, string) {
	cmd := exec.Command(path)
	cmd.Dir = filepath.Dir(path)
	err := cmd.Start()
	if err != nil {
		return false, err.Error()
	}

	go func() {
		_ = cmd.Wait()
		application.Get().Event.Emit("game:exit")
	}()

	return true, ""
}

func (f *FSService) StartWithConsole(path string) (bool, string) {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return false, err.Error()
	}

	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		return false, "file not found: " + absPath
	}
	cmd := exec.Command(absPath)
	cmd.Dir = filepath.Dir(absPath)
	cmd.Stdin = nil
	cmd.Stdout = nil
	cmd.Stderr = nil

	cmd.SysProcAttr = &windows.SysProcAttr{
		CreationFlags: windows.CREATE_NEW_CONSOLE |
			windows.CREATE_BREAKAWAY_FROM_JOB,
		NoInheritHandles: true,
	}

	err = cmd.Start()

	if err != nil {
		return false, err.Error()
	}

	go func() {
		_ = cmd.Wait()
		if strings.HasSuffix(path, "launcher.exe") {
			application.Get().Event.Emit("game:exit")
		} else if strings.HasSuffix(path, "firefly-go_win.exe") {
			application.Get().Event.Emit("server:exit")
		} else if strings.HasSuffix(path, "firefly-go-proxy.exe") {
			application.Get().Event.Emit("proxy:exit")
		}
	}()
	return true, ""
}

func (f *FSService) OpenFolder(path string) (bool, string) {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return false, "failed to resolve absolute path: " + err.Error()
	}

	if !f.DirExists(absPath) {
		return false, "directory not found: " + absPath
	}

	if runtime.GOOS == "windows" {
		_ = exec.Command("explorer", absPath).Start()
		return true, ""
	}

	url := "file:///" + filepath.ToSlash(absPath)
	application.Get().Browser.OpenURL(url)

	return true, ""
}

func (f *FSService) FileExistsInZip(archivePath, fileInside string) (bool, string) {
	exists, err := sevenzip.IsFileIn7z(archivePath, fileInside)
	if err != nil {
		return false, err.Error()
	}
	return exists, ""
}

func (f *FSService) ensureSophonInstalled() (string, error) {

	exe, err := os.Executable()
	if err != nil {
		return "", err
	}

	baseDir := filepath.Dir(exe)
	sophonDir := filepath.Join(baseDir, constant.SophonStorageUrl)

	exePath := filepath.Join(sophonDir, "net9.0/Sophon.Downloader.exe")

	// ✅ 1. check folder exists
	if _, err := os.Stat(exePath); err == nil {
		return exePath, nil
	}

	fmt.Println("Sophon not found → downloading...")

	if err := downloadAndExtractSophon(sophonDir); err != nil {
		return "", err
	}

	if _, err := os.Stat(exePath); err != nil {
		return "", fmt.Errorf("Sophon install failed: expected executable at %s: %w", exePath, err)
	}

	return exePath, nil
}

func DownloadSophon() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	destination := filepath.Join(filepath.Dir(exe), constant.SophonStorageUrl)
	if err := downloadAndExtractSophon(destination); err != nil {
		return err
	}
	if _, err := os.Stat(filepath.Join(destination, "net9.0", "Sophon.Downloader.exe")); err != nil {
		return fmt.Errorf("Sophon executable not found after extraction: %w", err)
	}
	return nil
}

func downloadAndExtractSophon(destination string) error {
	if err := os.MkdirAll(destination, 0755); err != nil {
		return err
	}

	client := &http.Client{Timeout: 2 * time.Minute}
	response, err := client.Get(constant.SophonGitUrl)
	if err != nil {
		return fmt.Errorf("download Sophon: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("download Sophon: server returned %s", response.Status)
	}

	zipPath := filepath.Join(destination, constant.SophonZipFile)
	archive, err := os.Create(zipPath)
	if err != nil {
		return fmt.Errorf("create Sophon archive: %w", err)
	}
	_, copyErr := io.Copy(archive, response.Body)
	closeErr := archive.Close()
	if copyErr != nil {
		return fmt.Errorf("save Sophon archive: %w", copyErr)
	}
	if closeErr != nil {
		return fmt.Errorf("close Sophon archive: %w", closeErr)
	}

	if err := unzip(zipPath, destination); err != nil {
		return fmt.Errorf("extract Sophon archive: %w", err)
	}
	if err := os.Remove(zipPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remove Sophon archive: %w", err)
	}
	return nil
}

func (f *FSService) GetLauncherDir() (string, error) {
	exePath, err := os.Executable()
	if err != nil {
		return "", err
	}
	return filepath.Dir(exePath), nil
}

func (f *FSService) RunDownloader(gameID string, pkg string, version string, output string, region string, branch string, launcherID string) (bool, error) {
	launcherDir, err := f.GetLauncherDir()
	if err != nil {
		return false, err
	}

	if output == "" {
		return false, fmt.Errorf("output directory is required")
	}
	if !filepath.IsAbs(output) {
		output = filepath.Join(launcherDir, output)
	}
	output = filepath.Clean(output)
	if err := os.MkdirAll(output, 0755); err != nil {
		return false, err
	}

	exePath, err := f.ensureSophonInstalled()
	if err != nil {
		return false, err
	}

	if _, err := os.Stat(exePath); err != nil {
		return false, fmt.Errorf("Sophon executable not found: %w", err)
	}

	branchOption := "Main"
	if branch == "pre_download" {
		branchOption = "PreDownload"
	}

	cmd := exec.Command(
		exePath,
		"full",
		gameID,
		pkg,
		version,
		output,
		fmt.Sprintf("--region=%s", region),
		fmt.Sprintf("--branch=%s", branchOption),
		fmt.Sprintf("--launcherId=%s", launcherID),
	)

	cmd.Dir = filepath.Dir(exePath)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return false, err
	}
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return false, err
	}

	if err := cmd.Start(); err != nil {
		return false, err
	}

	if _, err := io.WriteString(stdin, "y\n"); err != nil {
		_ = stdin.Close()
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
		return false, err
	}
	if err := stdin.Close(); err != nil {
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
		return false, err
	}

	reader := bufio.NewReader(stdout)
	for {
		line, readErr := reader.ReadString('\r')
		if len(line) > 0 {
			application.Get().Event.Emit("download:progress", line)
		}
		if readErr != nil {
			if readErr != io.EOF {
				_ = cmd.Process.Kill()
				_ = cmd.Wait()
				return false, readErr
			}
			break
		}
	}

	err = cmd.Wait()
	if err != nil {
		return false, err
	}

	return true, nil
}

func (w *ProgressWriter) Write(p []byte) (n int, err error) {
	line := string(p)

	// ส่งไป Wails event
	// runtime.EventsEmit(app, "download:progress", line)

	println(line)

	return len(p), nil
}

func unzip(zipPath, dest string) error {
	archive, err := zip.OpenReader(zipPath)
	if err != nil {
		return fmt.Errorf("open zip archive %s: %w", zipPath, err)
	}
	defer archive.Close()

	destination, err := filepath.Abs(dest)
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
			return fmt.Errorf("zip entry has an unsafe path: %q", entry.Name)
		}
		path := filepath.Join(destination, relativePath)

		if entry.FileInfo().IsDir() {
			if err := os.MkdirAll(path, 0755); err != nil {
				return err
			}
			continue
		}
		if entry.Mode()&os.ModeSymlink != 0 {
			return fmt.Errorf("zip entry is a symbolic link: %q", entry.Name)
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
