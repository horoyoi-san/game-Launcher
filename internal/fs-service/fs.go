package fsService

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sunbringer-launcher/pkg/constant"
	"sunbringer-launcher/pkg/sevenzip"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"golang.org/x/sys/windows"
)

type FSService struct{}

const napOffsetsFile = `D:\Horoyoisan\PS\nap\CNBetaWin3.3.4\offsets.zon`
const napUIDCustomFile = `D:\Horoyoisan\PS\nap\CNBetaWin3.3.4\uid_custom.txt`
const thaumielOffsetsURL = "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/sunbringer-launcher/offsets.zon"

func (f *FSService) FetchUpstreamOffsetsFile() (string, error) {
	client := &http.Client{Timeout: 20 * time.Second}
	response, err := client.Get(thaumielOffsetsURL)
	if err != nil {
		return "", fmt.Errorf("fetch upstream offsets.zon: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("fetch upstream offsets.zon: server returned %s", response.Status)
	}
	content, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if err != nil {
		return "", fmt.Errorf("read upstream offsets.zon: %w", err)
	}
	if len(content) == 0 {
		return "", fmt.Errorf("upstream offsets.zon is empty")
	}
	return string(content), nil
}

func (f *FSService) ReadOffsetsFile() (string, error) {
	content, err := os.ReadFile(napOffsetsFile)
	if err != nil {
		return "", fmt.Errorf("read offsets.zon at %s: %w", napOffsetsFile, err)
	}
	return string(content), nil
}

func (f *FSService) WriteOffsetsFile(content string) error {
	info, err := os.Stat(napOffsetsFile)
	if err != nil {
		return fmt.Errorf("locate offsets.zon at %s: %w", napOffsetsFile, err)
	}
	if !info.Mode().IsRegular() {
		return fmt.Errorf("offsets.zon is not a regular file: %s", napOffsetsFile)
	}
	if err := os.WriteFile(napOffsetsFile, []byte(content), info.Mode().Perm()); err != nil {
		return fmt.Errorf("save offsets.zon at %s: %w", napOffsetsFile, err)
	}
	return nil
}

func (f *FSService) ReadUIDCustomFile() (string, error) {
	content, err := os.ReadFile(napUIDCustomFile)
	if err != nil {
		return "", fmt.Errorf("read uid_custom.txt at %s: %w", napUIDCustomFile, err)
	}
	return string(content), nil
}

func (f *FSService) WriteUIDCustomFile(content string) error {
	info, err := os.Stat(napUIDCustomFile)
	if err != nil {
		return fmt.Errorf("locate uid_custom.txt at %s: %w", napUIDCustomFile, err)
	}
	if !info.Mode().IsRegular() {
		return fmt.Errorf("uid_custom.txt is not a regular file: %s", napUIDCustomFile)
	}
	if err := os.WriteFile(napUIDCustomFile, []byte(content), info.Mode().Perm()); err != nil {
		return fmt.Errorf("save uid_custom.txt at %s: %w", napUIDCustomFile, err)
	}
	return nil
}

func (f *FSService) PickFolder() (string, error) {
	dialog := application.Get().Dialog.OpenFile().
		CanChooseDirectories(true).
		CanChooseFiles(false).
		ResolvesAliases(true)
	if runtime.GOOS == "darwin" {
		dialog.SetMessage("Select the game folder")
	} else {
		dialog.SetTitle("Select the game folder")
	}
	return dialog.PromptForSingleSelection()
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
	err := cmd.Start()
	if err != nil {
		return false, err.Error()
	}

	if strings.HasSuffix(path, "ZenlessZoneZeroBeta.exe") {
		go func() {
			_ = cmd.Wait()
			application.Get().Event.Emit("game:exit")
		}()
	}

	return true, ""
}

func (f *FSService) StartWithConsole(path string) (bool, string) {
	cmd, absPath, err := startConsoleProcess(path)
	if err != nil {
		return false, err.Error()
	}

	if err := cmd.Start(); err != nil {
		return false, err.Error()
	}

	go func() {
		_ = cmd.Wait()
		switch strings.ToLower(filepath.Base(absPath)) {
		case "launcher.exe", "sunbringer.exe":
			application.Get().Event.Emit("game:exit")
		case "firefly-go_win.exe", constant.NAPServerExecutable, constant.NAPSDKServerExecutable:
			application.Get().Event.Emit("server:exit")
		}
	}()
	return true, ""
}

func (f *FSService) StartNAPServer() (bool, string) {
	command, _, err := startConsoleProcess(constant.ZigExecutable)
	if err != nil {
		return false, fmt.Errorf("prepare Remielle server command: %w", err).Error()
	}
	serverDir, err := filepath.Abs(constant.RemielleStorageDir)
	if err != nil {
		return false, fmt.Errorf("resolve Remielle source folder: %w", err).Error()
	}
	command.Dir = serverDir
	command.Args = append(command.Args, "build", "serve-all")
	if err := command.Start(); err != nil {
		return false, fmt.Errorf("start Remielle with zig build serve-all: %w", err).Error()
	}
	go func() {
		_ = command.Wait()
		application.Get().Event.Emit("server:exit")
	}()
	return true, ""
}

func startConsoleProcess(path string) (*exec.Cmd, string, error) {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return nil, "", err
	}

	info, err := os.Stat(absPath)
	if err != nil {
		return nil, "", fmt.Errorf("file not found: %s: %w", absPath, err)
	}
	if !info.Mode().IsRegular() {
		return nil, "", fmt.Errorf("not a file: %s", absPath)
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
	return cmd, absPath, nil
}

func (f *FSService) OpenFolder(path string) (bool, string) {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return false, "failed to resolve absolute path: " + err.Error()
	}

	if !f.DirExists(absPath) {
		return false, "directory not found: " + absPath
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
