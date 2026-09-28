package diffService

import (
	"archive/zip"
	"os"
	"path/filepath"
	"testing"
)

func writeUpdaterZip(t *testing.T, archivePath string, entries map[string]string) {
	t.Helper()

	archiveFile, err := os.Create(archivePath)
	if err != nil {
		t.Fatal(err)
	}
	writer := zip.NewWriter(archiveFile)
	for name, content := range entries {
		entry, err := writer.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := entry.Write([]byte(content)); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	if err := archiveFile.Close(); err != nil {
		t.Fatal(err)
	}
}

func TestExtractUpdaterArchive(t *testing.T) {
	root := t.TempDir()
	archivePath := filepath.Join(root, "diff.zip")
	destination := filepath.Join(root, "launcher")
	want := "updater executable"
	writeUpdaterZip(t, archivePath, map[string]string{
		"Updater/HappyGenyuanImsactUpdate.exe": want,
		"Updater/Updater.runtimeconfig.json":   "{}",
	})

	if err := extractUpdaterArchive(archivePath, destination); err != nil {
		t.Fatalf("extractUpdaterArchive() error = %v", err)
	}

	got, err := os.ReadFile(filepath.Join(destination, filepath.FromSlash(diffUpdaterPath)))
	if err != nil {
		t.Fatalf("read extracted updater: %v", err)
	}
	if string(got) != want {
		t.Fatalf("updater contents = %q, want %q", got, want)
	}
}

func TestExtractUpdaterArchiveRejectsPathTraversal(t *testing.T) {
	root := t.TempDir()
	archivePath := filepath.Join(root, "malicious.zip")
	destination := filepath.Join(root, "launcher")
	writeUpdaterZip(t, archivePath, map[string]string{"../outside.txt": "bad"})

	if err := extractUpdaterArchive(archivePath, destination); err == nil {
		t.Fatal("extractUpdaterArchive() succeeded for path traversal")
	}
	if _, err := os.Stat(filepath.Join(root, "outside.txt")); !os.IsNotExist(err) {
		t.Fatalf("path traversal file status = %v, want not exists", err)
	}
}

func TestIsSupportedPatchArchive(t *testing.T) {
	for _, path := range []string{"patch.zip", "patch.ZIP", "patch.7z", "patch.7Z"} {
		if !isSupportedPatchArchive(path) {
			t.Errorf("isSupportedPatchArchive(%q) = false, want true", path)
		}
	}
	for _, path := range []string{"patch.rar", "patch.exe", "patch"} {
		if isSupportedPatchArchive(path) {
			t.Errorf("isSupportedPatchArchive(%q) = true, want false", path)
		}
	}
}
