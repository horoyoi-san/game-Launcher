package fsService

import (
	"Cyrene-launcher/pkg/constant"
	"Cyrene-launcher/pkg/sevenzip"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
	"golang.org/x/sys/windows"
)

type FSService struct{}

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

	if strings.HasSuffix(path, "StarRail.exe") {
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
		case "launcher.exe":
			application.Get().Event.Emit("game:exit")
		case "firefly-go_win.exe", constant.HKRPGServerExecutable, constant.HKRPGSDKServerExecutable:
			application.Get().Event.Emit("server:exit")
		case "firefly-go-proxy.exe", "proxy.exe":
			application.Get().Event.Emit("proxy:exit")
		}
	}()
	return true, ""
}

func (f *FSService) StartHKRPGServer() (bool, string) {
	serverExecutables := []string{
		filepath.Join(constant.ServerStorageUrl, constant.HKRPGSDKServerExecutable),
		filepath.Join(constant.ServerStorageUrl, constant.HKRPGServerExecutable),
	}
	commands := make([]*exec.Cmd, 0, len(serverExecutables))
	for _, executable := range serverExecutables {
		command, _, err := startConsoleProcess(executable)
		if err != nil {
			stopStartedProcesses(commands)
			return false, fmt.Errorf("prepare server process %s: %w", executable, err).Error()
		}
		if err := command.Start(); err != nil {
			stopStartedProcesses(commands)
			return false, fmt.Errorf("start server process %s: %w", executable, err).Error()
		}
		commands = append(commands, command)
	}

	go func() {
		var waitGroup sync.WaitGroup
		for _, command := range commands {
			waitGroup.Go(func() {
				_ = command.Wait()
			})
		}
		waitGroup.Wait()
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

func stopStartedProcesses(commands []*exec.Cmd) {
	for _, command := range commands {
		if command.Process != nil {
			_ = command.Process.Kill()
			_ = command.Wait()
		}
	}
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
