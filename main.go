package main

import (
	"embed"
	_ "embed"

	appService "sunbringer-launcher/internal/app-service"
	diffService "sunbringer-launcher/internal/diff-service"
	fsService "sunbringer-launcher/internal/fs-service"
	gitService "sunbringer-launcher/internal/git-service"
	languageService "sunbringer-launcher/internal/language-service"

	"sunbringer-launcher/pkg/constant"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed all:assets
var tools embed.FS

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func extractFile(embedPath, outPath string) error {
	data, err := tools.ReadFile(embedPath)
	if err != nil {
		return fmt.Errorf("can't read file embed %s: %w", embedPath, err)
	}

	if err := os.MkdirAll(filepath.Dir(outPath), 0755); err != nil {
		return fmt.Errorf("can't create directory %s: %w", filepath.Dir(outPath), err)
	}

	return os.WriteFile(outPath, data, 0755)
}

func main() {
	// Extract required files
	for outPath, embedPath := range constant.RequiredFiles {
		if !fileExists(outPath.String()) {
			err := extractFile(embedPath, outPath.String())
			if err != nil {
				fmt.Println("can't copy file:", err)
			}
		}
	}

	// Remove old executable
	exePath, err := os.Executable()
	if err == nil {
		dir := filepath.Dir(exePath)
		base := filepath.Base(exePath)
		oldPath := filepath.Join(dir, "."+base+".old")

		fmt.Println("Old executable path:", oldPath)
		os.Remove(oldPath)
	}
	// Create application
	app := application.New(application.Options{
		Name:        "sunbringer-launcher",
		Description: "Sunbringer Launcher - Horoyoi-san",
		Services: []application.Service{
			application.NewService(&fsService.FSService{}),
			application.NewService(&languageService.LanguageService{}),
			application.NewService(&gitService.GitService{}),
			application.NewService(&diffService.DiffService{}),
			application.NewService(&appService.AppService{}),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	// Create window
	window := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title: "Sunbringer Launcher - Horoyoi-san",
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(0, 0, 0),
		Width:            1280,
		Height:           720,
		URL:              "/",
		DevToolsEnabled:  true,
		Frameless:        true,
		DisableResize:    true,
	})

	iconBytes, _ := tools.ReadFile("assets/appicon.png")
	systemTray := app.SystemTray.New()
	systemTray.SetIcon(iconBytes)
	systemTray.SetTooltip("Sunbringer Launcher")

	// Attach the window to the system tray
	menu := application.NewMenu()
	menu.Add("Open").OnClick(func(ctx *application.Context) {
		window.Show()
	})
	menu.Add("Quit").OnClick(func(ctx *application.Context) {
		app.Quit()
	})

	systemTray.SetMenu(menu)

	window.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		app.Event.Emit("window:close")
		e.Cancel()
	})

	err = app.Run()
	if err != nil {
		log.Fatal(err)
	}
}
