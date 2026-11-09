package fsService

import (
	"SilwerWolf999-launcher/pkg/sevenzip"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

	"SilwerWolf999-launcher/internal/sophon"
	"github.com/wailsapp/wails/v3/pkg/application"
	"golang.org/x/sys/windows"
)

type FSService struct {
	downloadMu     sync.Mutex
	downloadCancel context.CancelFunc
	downloadResume chan struct{}
}

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

func (f *FSService) GetLauncherDir() (string, error) {
	exePath, err := os.Executable()
	if err != nil {
		return "", err
	}
	return filepath.Dir(exePath), nil
}

func (f *FSService) RunDownloader(gameID string, pkg string, version string, output string, region string, branch string, launcherID string) (bool, error) {
	f.downloadMu.Lock()
	if f.downloadCancel != nil {
		f.downloadMu.Unlock()
		return false, fmt.Errorf("a download is already running")
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	f.downloadCancel = cancel
	f.downloadResume = nil
	f.downloadMu.Unlock()
	defer func() {
		f.downloadMu.Lock()
		f.downloadCancel = nil
		f.downloadResume = nil
		f.downloadMu.Unlock()
	}()

	if output == "" {
		return false, fmt.Errorf("output directory is required")
	}
	if !filepath.IsAbs(output) {
		launcherDir, err := f.GetLauncherDir()
		if err != nil {
			return false, err
		}
		output = filepath.Join(launcherDir, output)
	}
	application.Get().Event.Emit("download:started")

	config, ok := sophonRegionEndpoints[strings.ToUpper(region)]
	if !ok {
		return false, fmt.Errorf("unsupported Sophon region: %s", region)
	}
	controls := sophon.Controls{
		Wait: func(ctx context.Context) error {
			for {
				f.downloadMu.Lock()
				resume := f.downloadResume
				f.downloadMu.Unlock()
				if resume == nil {
					return ctx.Err()
				}
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-resume:
				}
			}
		},
	}
	err := sophon.Download(ctx, sophon.Request{
		Config: sophon.BuildConfig{
			BranchesURL: config.url,
			BuildURL:    config.buildURL,
			PlatformApp: config.platformApp,
		},
		GameID:   gameID,
		Package:  pkg,
		Version:  version,
		Output:   output,
		Region:   strings.ToUpper(region),
		Branch:   branch,
		Launcher: launcherID,
	}, controls, func(progress sophon.Progress) {
		application.Get().Event.Emit("download:progress", progress)
	})
	if err != nil {
		if ctx.Err() != nil {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func (f *FSService) PauseDownloader() (bool, error) {
	f.downloadMu.Lock()
	defer f.downloadMu.Unlock()
	if f.downloadCancel == nil {
		return false, fmt.Errorf("no active download to pause")
	}
	if f.downloadResume != nil {
		return true, nil
	}
	f.downloadResume = make(chan struct{})
	return true, nil
}

func (f *FSService) ResumeDownloader() (bool, error) {
	f.downloadMu.Lock()
	defer f.downloadMu.Unlock()
	if f.downloadCancel == nil {
		return false, fmt.Errorf("no active download to resume")
	}
	if f.downloadResume == nil {
		return true, nil
	}
	close(f.downloadResume)
	f.downloadResume = nil
	return true, nil
}

func (f *FSService) CancelDownloader() (bool, error) {
	f.downloadMu.Lock()
	defer f.downloadMu.Unlock()
	if f.downloadCancel == nil {
		return false, fmt.Errorf("no active download to cancel")
	}
	f.downloadCancel()
	return true, nil
}
