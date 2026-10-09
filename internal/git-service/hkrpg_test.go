package gitService

import (
	"os"
	"path/filepath"
	"testing"
)

func TestInstallPatchFilesBacksUpOriginalsAndKeepsFirstBackup(t *testing.T) {
	gameDir := t.TempDir()
	patchDir := t.TempDir()
	patchFiles := []patchFile{
		{source: filepath.Join(patchDir, "launcher.exe"), destination: filepath.Join(gameDir, "launcher.exe")},
		{source: filepath.Join(patchDir, "hkrpg.dll"), destination: filepath.Join(gameDir, "hkrpg.dll")},
	}
	originalContents := []string{"original launcher", "original dll"}
	patchContents := []string{"patched launcher", "patched dll"}

	for index, patch := range patchFiles {
		if err := os.WriteFile(patch.source, []byte(patchContents[index]), 0600); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(patch.destination, []byte(originalContents[index]), 0600); err != nil {
			t.Fatal(err)
		}
	}

	if err := installPatchFiles(gameDir, patchFiles); err != nil {
		t.Fatalf("installPatchFiles() error = %v", err)
	}

	for index, patch := range patchFiles {
		assertFileContents(t, patch.destination, patchContents[index])
		assertFileContents(t, patch.destination+".cyrene-backup", originalContents[index])
	}

	if err := installPatchFiles(gameDir, patchFiles); err != nil {
		t.Fatalf("installPatchFiles() on repeat error = %v", err)
	}
	for index, patch := range patchFiles {
		assertFileContents(t, patch.destination, patchContents[index])
		assertFileContents(t, patch.destination+".cyrene-backup", originalContents[index])
	}
}

func TestInstallPatchFilesRestoresOriginalsAfterStagingFailure(t *testing.T) {
	gameDir := t.TempDir()
	patchDir := t.TempDir()
	firstSource := filepath.Join(patchDir, "launcher.exe")
	firstDestination := filepath.Join(gameDir, "launcher.exe")
	if err := os.WriteFile(firstSource, []byte("patched launcher"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(firstDestination, []byte("original launcher"), 0600); err != nil {
		t.Fatal(err)
	}

	err := installPatchFiles(gameDir, []patchFile{
		{source: firstSource, destination: firstDestination},
		{source: filepath.Join(patchDir, "missing.dll"), destination: filepath.Join(gameDir, "hkrpg.dll")},
	})
	if err == nil {
		t.Fatal("installPatchFiles() expected an error for a missing patch asset")
	}
	assertFileContents(t, firstDestination, "original launcher")
}

func assertFileContents(t *testing.T, path, want string) {
	t.Helper()
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	if string(got) != want {
		t.Errorf("contents of %s = %q, want %q", path, got, want)
	}
}
