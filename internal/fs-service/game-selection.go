package fsService

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"golang.org/x/sys/windows"
)

type gameSelection struct {
	GamePath string `json:"gamePath"`
	GameDir  string `json:"gameDir"`
}

func gameSelectionPath() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("resolve user config directory: %w", err)
	}

	return filepath.Join(configDir, "Cyrene-launcher", "game-selection.json"), nil
}

func (f *FSService) GetSavedGameSelection() (string, string, error) {
	path, err := gameSelectionPath()
	if err != nil {
		return "", "", err
	}

	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return "", "", nil
	}
	if err != nil {
		return "", "", fmt.Errorf("read saved game selection: %w", err)
	}

	var selection gameSelection
	if err := json.Unmarshal(data, &selection); err != nil {
		return "", "", fmt.Errorf("parse saved game selection: %w", err)
	}

	return selection.GamePath, selection.GameDir, nil
}

func (f *FSService) SaveGameSelection(gamePath, gameDir string) error {
	path, err := gameSelectionPath()
	if err != nil {
		return err
	}

	data, err := json.Marshal(gameSelection{GamePath: gamePath, GameDir: gameDir})
	if err != nil {
		return fmt.Errorf("encode game selection: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return fmt.Errorf("create game selection directory: %w", err)
	}

	tempPath := path + ".tmp"
	if err := os.WriteFile(tempPath, data, 0600); err != nil {
		return fmt.Errorf("write game selection: %w", err)
	}

	tempPathPtr, err := windows.UTF16PtrFromString(tempPath)
	if err != nil {
		_ = os.Remove(tempPath)
		return fmt.Errorf("encode temporary game selection path: %w", err)
	}
	pathPtr, err := windows.UTF16PtrFromString(path)
	if err != nil {
		_ = os.Remove(tempPath)
		return fmt.Errorf("encode game selection path: %w", err)
	}
	if err := windows.MoveFileEx(tempPathPtr, pathPtr, windows.MOVEFILE_REPLACE_EXISTING|windows.MOVEFILE_WRITE_THROUGH); err != nil {
		_ = os.Remove(tempPath)
		return fmt.Errorf("replace saved game selection: %w", err)
	}

	return nil
}
