package main

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestResetWebViewProfileClearsAllDataOnce(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("WebView2 cache cleanup is Windows-specific")
	}

	appData := t.TempDir()
	t.Setenv("APPDATA", appData)

	appDirectory := filepath.Join(appData, "sunbringer-launcher.exe")
	profilePath := filepath.Join(appDirectory, "EBWebView")
	storedDataPaths := []string{
		filepath.Join(profilePath, "Default", "Service Worker", "CacheStorage"),
		filepath.Join(profilePath, "Default", "Cache", "Cache_Data"),
		filepath.Join(profilePath, "Default", "Local Storage", "leveldb"),
	}
	for _, path := range storedDataPaths {
		if err := os.MkdirAll(path, 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(path, "stored-file"), []byte("data"), 0600); err != nil {
			t.Fatal(err)
		}
	}

	executablePath := filepath.Join("bin", "sunbringer-launcher.exe")
	if err := resetWebViewProfile(executablePath); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(profilePath); !os.IsNotExist(err) {
		t.Fatalf("expected full WebView profile to be removed, got err %v", err)
	}

	recreatedData := filepath.Join(profilePath, "Default", "Local Storage", "leveldb", "new-data")
	if err := os.MkdirAll(filepath.Dir(recreatedData), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(recreatedData, []byte("new"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := resetWebViewProfile(executablePath); err != nil {
		t.Fatal(err)
	}
	if data, err := os.ReadFile(recreatedData); err != nil || string(data) != "new" {
		t.Errorf("expected profile data to be retained after the one-time reset, got data %q and err %v", data, err)
	}
}
