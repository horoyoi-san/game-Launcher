package fsService

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGameSelectionPersists(t *testing.T) {
	configDir := t.TempDir()
	t.Setenv("APPDATA", configDir)

	service := &FSService{}
	gamePath := `C:\Games\Honkai Star Rail\StarRail.exe`
	gameDir := `C:\Games\Honkai Star Rail`

	if err := service.SaveGameSelection(gamePath, gameDir); err != nil {
		t.Fatalf("SaveGameSelection() error = %v", err)
	}

	restartedService := &FSService{}
	gotGamePath, gotGameDir, err := restartedService.GetSavedGameSelection()
	if err != nil {
		t.Fatalf("GetSavedGameSelection() error = %v", err)
	}
	if gotGamePath != gamePath || gotGameDir != gameDir {
		t.Fatalf("GetSavedGameSelection() = (%q, %q), want (%q, %q)", gotGamePath, gotGameDir, gamePath, gameDir)
	}

	updatedGamePath := `D:\Games\Honkai Star Rail\StarRail.exe`
	updatedGameDir := `D:\Games\Honkai Star Rail`
	if err := service.SaveGameSelection(updatedGamePath, updatedGameDir); err != nil {
		t.Fatalf("SaveGameSelection() update error = %v", err)
	}

	gotGamePath, gotGameDir, err = restartedService.GetSavedGameSelection()
	if err != nil {
		t.Fatalf("GetSavedGameSelection() after update error = %v", err)
	}
	if gotGamePath != updatedGamePath || gotGameDir != updatedGameDir {
		t.Fatalf("GetSavedGameSelection() after update = (%q, %q), want (%q, %q)", gotGamePath, gotGameDir, updatedGamePath, updatedGameDir)
	}

	if _, err := os.Stat(filepath.Join(configDir, "Cyrene-launcher", "game-selection.json")); err != nil {
		t.Fatalf("saved selection file not found: %v", err)
	}
}

func TestGetSavedGameSelectionWithoutSavedFile(t *testing.T) {
	t.Setenv("APPDATA", t.TempDir())

	gamePath, gameDir, err := (&FSService{}).GetSavedGameSelection()
	if err != nil {
		t.Fatalf("GetSavedGameSelection() error = %v", err)
	}
	if gamePath != "" || gameDir != "" {
		t.Fatalf("GetSavedGameSelection() = (%q, %q), want empty selection", gamePath, gameDir)
	}
}
