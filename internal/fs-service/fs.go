package fsService

import (
	"Cyrene-launcher/pkg/sevenzip"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

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
