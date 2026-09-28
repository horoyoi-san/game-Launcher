package fsService

import (
	"archive/zip"
	"os"
	"path/filepath"
	"testing"
)

func writeZip(t *testing.T, archivePath string, entries map[string]string) {
	t.Helper()

	archive, err := os.Create(archivePath)
	if err != nil {
		t.Fatal(err)
	}

	writer := zip.NewWriter(archive)
	for name, contents := range entries {
		file, err := writer.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := file.Write([]byte(contents)); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	if err := archive.Close(); err != nil {
		t.Fatal(err)
	}
}

func TestUnzipExtractsNestedSophonExecutable(t *testing.T) {
	root := t.TempDir()
	archivePath := filepath.Join(root, "Sophon.Downloader.zip")
	destination := filepath.Join(root, "Sophon")
	entryPath := filepath.Join("net9.0", "Sophon.Downloader.exe")
	want := "test executable"
	writeZip(t, archivePath, map[string]string{filepath.ToSlash(entryPath): want})

	if err := unzip(archivePath, destination); err != nil {
		t.Fatalf("unzip() error = %v", err)
	}

	got, err := os.ReadFile(filepath.Join(destination, entryPath))
	if err != nil {
		t.Fatalf("read extracted executable: %v", err)
	}
	if string(got) != want {
		t.Fatalf("extracted contents = %q, want %q", got, want)
	}
}

func TestUnzipRejectsPathTraversal(t *testing.T) {
	root := t.TempDir()
	archivePath := filepath.Join(root, "malicious.zip")
	destination := filepath.Join(root, "Sophon")
	writeZip(t, archivePath, map[string]string{"../outside.txt": "bad"})

	if err := unzip(archivePath, destination); err == nil {
		t.Fatal("unzip() succeeded for a path-traversal entry")
	}
	if _, err := os.Stat(filepath.Join(root, "outside.txt")); !os.IsNotExist(err) {
		t.Fatalf("path-traversal file status = %v, want not exists", err)
	}
}
