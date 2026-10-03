package languageService

import (
	"bytes"
	"encoding/binary"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestUpdateMasterDesign(t *testing.T) {
	data := make([]byte, 66)
	hash := "878d1fefee5f49221b003050cb4a2d2f"

	updated, err := updateMasterDesign(data, hash, 1234)
	if err != nil {
		t.Fatalf("updateMasterDesign() error = %v", err)
	}

	expectedHash, _ := hex.DecodeString(hash)
	for i := 0; i < len(expectedHash); i += 4 {
		expectedHash[i], expectedHash[i+3] = expectedHash[i+3], expectedHash[i]
		expectedHash[i+1], expectedHash[i+2] = expectedHash[i+2], expectedHash[i+1]
	}
	if !bytes.Equal(updated[28:44], expectedHash) {
		t.Fatalf("unexpected hash bytes: %x", updated[28:44])
	}
	if got := binary.LittleEndian.Uint64(updated[44:52]); got != 1234 {
		t.Fatalf("unexpected catalog size: %d", got)
	}
}

func TestBackupAndApplyThaiPatch(t *testing.T) {
	root := t.TempDir()
	existing := filepath.Join(root, "StarRail_Data", "existing.bytes")
	if err := os.MkdirAll(filepath.Dir(existing), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(existing, []byte("before"), 0644); err != nil {
		t.Fatal(err)
	}
	created := filepath.Join(root, "StarRail_Data", "new.bytes")

	backupDir, err := backupAndApplyThaiPatch(root, map[string][]byte{
		existing: []byte("after"),
		created:  []byte("new"),
	})
	if err != nil {
		t.Fatalf("backupAndApplyThaiPatch() error = %v", err)
	}
	if got, _ := os.ReadFile(existing); string(got) != "after" {
		t.Fatalf("updated file contents = %q, want after", got)
	}
	if got, _ := os.ReadFile(filepath.Join(backupDir, "StarRail_Data", "existing.bytes")); string(got) != "before" {
		t.Fatalf("backup contents = %q, want before", got)
	}
	if got, _ := os.ReadFile(created); string(got) != "new" {
		t.Fatalf("new file contents = %q, want new", got)
	}
}

func TestInstallThaiPatchForBeta451(t *testing.T) {
	root := t.TempDir()
	gameRoot := filepath.Join(root, "game")
	packageRoot := filepath.Join(root, "package")
	dataRoot := filepath.Join(gameRoot, "StarRail_Data")
	streamingAssets := filepath.Join(dataRoot, "StreamingAssets")
	persistentDesignDir := filepath.Join(dataRoot, "Persistent", "DesignData", "Windows")
	streamingDesignDir := filepath.Join(streamingAssets, "DesignData", "Windows")

	for _, dir := range []string{
		persistentDesignDir,
		streamingDesignDir,
		filepath.Join(packageRoot, "assets"),
	} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(gameRoot, "StarRail.exe"), []byte("exe"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(streamingAssets, "BinaryVersion.bytes"), []byte("BETAWin"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(streamingAssets, "DesignData", "Windows", "M_Design_ArchiveV.bytes"), []byte("old archive"), 0644); err != nil {
		t.Fatal(err)
	}

	packageAssets := map[string][]byte{
		"1_TextMap_th/1fb7b1dce8d66efe8e111bb07a3eef44.bytes":         []byte("thai text"),
		"2_UI_Persistent/fd5227547d65b8bb1238feb3e5820fa3.bytes":      []byte("persistent UI"),
		"3_UI_StreamingAssets/2ea44f7fabf315d35de1d7f3b4c07d89.bytes": []byte("streaming UI"),
		"4_Locale_Pak/th.pak":                                          []byte("thai locale"),
		"5_AllowedLanguage/allowed_language_140bytes.bin":              bytes.Repeat([]byte{1}, 140),
		"prebuilt_designv/DesignV_" + betaPersistentDesignV + ".bytes": bytes.Repeat([]byte{2}, 128),
		"prebuilt_designv/DesignV_" + betaStreamingDesignV + ".bytes":  bytes.Repeat([]byte{3}, 64),
	}
	for relative, content := range packageAssets {
		path := filepath.Join(packageRoot, "assets", filepath.FromSlash(relative))
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, content, 0644); err != nil {
			t.Fatal(err)
		}
	}

	if err := os.WriteFile(filepath.Join(persistentDesignDir, betaPersistentContainer), bytes.Repeat([]byte{4}, betaPersistentContainerLimit), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(streamingDesignDir, betaStreamingContainer), bytes.Repeat([]byte{5}, betaStreamingContainerLimit), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(persistentDesignDir, "M_DesignV.bytes"), make([]byte, 66), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(streamingDesignDir, "M_DesignV.bytes"), make([]byte, 66), 0644); err != nil {
		t.Fatal(err)
	}

	ok, result := (&LanguageService{}).InstallThaiPatch(gameRoot, packageRoot)
	if !ok {
		t.Fatalf("InstallThaiPatch() failed: %s", result)
	}
	if !bytes.Contains([]byte(result), []byte("Cyrene-Thai-Backup-")) {
		t.Fatalf("install result does not include backup path: %s", result)
	}

	patchedPersistent, err := os.ReadFile(filepath.Join(persistentDesignDir, betaPersistentContainer))
	if err != nil {
		t.Fatal(err)
	}
	if len(patchedPersistent) != betaPersistentContainerLimit+140 || !bytes.Equal(patchedPersistent[len(patchedPersistent)-140:], packageAssets["5_AllowedLanguage/allowed_language_140bytes.bin"]) {
		t.Fatal("Persistent language container was not patched with the Thai language table")
	}
	patchedStreaming, err := os.ReadFile(filepath.Join(streamingDesignDir, betaStreamingContainer))
	if err != nil {
		t.Fatal(err)
	}
	if len(patchedStreaming) != betaStreamingContainerLimit+140 || !bytes.Equal(patchedStreaming[len(patchedStreaming)-140:], packageAssets["5_AllowedLanguage/allowed_language_140bytes.bin"]) {
		t.Fatal("StreamingAssets language container was not patched with the Thai language table")
	}

	if _, err := os.Stat(filepath.Join(dataRoot, "Persistent", "DesignData", "Windows", "th", "1fb7b1dce8d66efe8e111bb07a3eef44.bytes")); err != nil {
		t.Fatalf("Thai TextMap was not installed: %v", err)
	}
}

func TestInstallThaiPatchRejectsNonBetaVersion(t *testing.T) {
	root := t.TempDir()
	gameRoot := filepath.Join(root, "game")
	streamingAssets := filepath.Join(gameRoot, "StarRail_Data", "StreamingAssets")
	if err := os.MkdirAll(streamingAssets, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(gameRoot, "StarRail.exe"), []byte("exe"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(streamingAssets, "BinaryVersion.bytes"), []byte("BETAWin"), 0644); err != nil {
		t.Fatal(err)
	}

	ok, message := (&LanguageService{}).InstallThaiPatch(gameRoot, filepath.Join(root, "missing"))
	if ok || !strings.Contains(message, "only supports Honkai: Star Rail Beta") {
		t.Fatalf("InstallThaiPatch() = (%t, %q), expected Beta version rejection", ok, message)
	}
}
