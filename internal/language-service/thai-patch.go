package languageService

import (
	"bytes"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const (
	betaPersistentContainer      = "79568e2a754e3eab8afe4b5bf96c27ab.bytes"
	betaPersistentContainerCopy  = "e303f4dc6c21f043021bb5b3b875b6c3.bytes"
	betaStreamingContainer       = "4703a1942cfa452f451ba0a2f826b764.bytes"
	betaStreamingContainerCopy   = "44b594f1fab938d6ed95d6a1154e03c0.bytes"
	betaPersistentDesignV        = "878d1fefee5f49221b003050cb4a2d2f"
	betaPersistentDesignVCopy    = "74b62fb914b36cccaa10d93ace9af2c0"
	betaStreamingDesignV         = "b5eefe4a429b498a8f5003f28a4b21c6"
	betaStreamingDesignVCopy     = "3ada95b84a1e0d96404ea5e7414ab353"
	betaPersistentContainerLimit = 26240102
	betaStreamingContainerLimit  = 73631
)

func (l *LanguageService) InstallThaiPatch(gameRoot, packageRoot string) (bool, string) {
	gameRoot, err := filepath.Abs(filepath.Clean(gameRoot))
	if err != nil {
		return false, fmt.Errorf("resolve game folder: %w", err).Error()
	}
	packageRoot, err = filepath.Abs(filepath.Clean(packageRoot))
	if err != nil {
		return false, fmt.Errorf("resolve patch package folder: %w", err).Error()
	}

	if _, err := os.Stat(filepath.Join(gameRoot, "StarRail.exe")); err != nil {
		return false, "selected folder does not contain StarRail.exe"
	}
	streamingAssets := filepath.Join(gameRoot, "StarRail_Data", "StreamingAssets")
	binaryVersion, err := os.ReadFile(filepath.Join(streamingAssets, "BinaryVersion.bytes"))
	if err != nil {
		return false, fmt.Errorf("read game version: %w", err).Error()
	}
	if !bytes.Contains(binaryVersion, []byte("BETAWin")) {
		return false, "this Thai patch package only supports Honkai: Star Rail Beta"
	}

	assets := filepath.Join(packageRoot, "assets")
	readAsset := func(relative string) ([]byte, error) {
		data, err := os.ReadFile(filepath.Join(assets, filepath.FromSlash(relative)))
		if err != nil {
			return nil, fmt.Errorf("read patch asset %s: %w", relative, err)
		}
		return data, nil
	}
	requireAsset := func(relative string) ([]byte, error) {
		data, err := readAsset(relative)
		if err != nil {
			return nil, err
		}
		if len(data) == 0 {
			return nil, fmt.Errorf("patch asset %s is empty", relative)
		}
		return data, nil
	}

	textMap, err := requireAsset("1_TextMap_th/1fb7b1dce8d66efe8e111bb07a3eef44.bytes")
	if err != nil {
		return false, err.Error()
	}
	persistentUI, err := requireAsset("2_UI_Persistent/fd5227547d65b8bb1238feb3e5820fa3.bytes")
	if err != nil {
		return false, err.Error()
	}
	streamingUI, err := requireAsset("3_UI_StreamingAssets/2ea44f7fabf315d35de1d7f3b4c07d89.bytes")
	if err != nil {
		return false, err.Error()
	}
	localePack, err := requireAsset("4_Locale_Pak/th.pak")
	if err != nil {
		return false, err.Error()
	}
	allowedLanguages, err := requireAsset("5_AllowedLanguage/allowed_language_140bytes.bin")
	if err != nil {
		return false, err.Error()
	}
	persistentDesign, err := requireAsset("prebuilt_designv/DesignV_" + betaPersistentDesignV + ".bytes")
	if err != nil {
		return false, err.Error()
	}
	streamingDesign, err := requireAsset("prebuilt_designv/DesignV_" + betaStreamingDesignV + ".bytes")
	if err != nil {
		return false, err.Error()
	}

	dataRoot := filepath.Join(gameRoot, "StarRail_Data")
	persistentDesignDir := filepath.Join(dataRoot, "Persistent", "DesignData", "Windows")
	streamingDesignDir := filepath.Join(streamingAssets, "DesignData", "Windows")
	persistentContainerPath := filepath.Join(persistentDesignDir, betaPersistentContainer)
	streamingContainerPath := filepath.Join(streamingDesignDir, betaStreamingContainer)
	persistentContainer, err := os.ReadFile(persistentContainerPath)
	if err != nil {
		return false, fmt.Errorf("read Beta language container: %w", err).Error()
	}
	streamingContainer, err := os.ReadFile(streamingContainerPath)
	if err != nil {
		return false, fmt.Errorf("read Beta title language container: %w", err).Error()
	}
	if len(persistentContainer) < betaPersistentContainerLimit || len(streamingContainer) < betaStreamingContainerLimit {
		return false, "Beta language containers do not match the supported patch layout"
	}

	persistentMaster, err := os.ReadFile(filepath.Join(persistentDesignDir, "M_DesignV.bytes"))
	if err != nil {
		return false, fmt.Errorf("read Persistent DesignV catalog: %w", err).Error()
	}
	streamingMaster, err := os.ReadFile(filepath.Join(streamingDesignDir, "M_DesignV.bytes"))
	if err != nil {
		return false, fmt.Errorf("read StreamingAssets DesignV catalog: %w", err).Error()
	}
	persistentMaster, err = updateMasterDesign(persistentMaster, betaPersistentDesignV, len(persistentDesign))
	if err != nil {
		return false, fmt.Errorf("prepare Persistent DesignV catalog: %w", err).Error()
	}
	streamingMaster, err = updateMasterDesign(streamingMaster, betaStreamingDesignV, len(streamingDesign))
	if err != nil {
		return false, fmt.Errorf("prepare StreamingAssets DesignV catalog: %w", err).Error()
	}

	persistentContainer = append(bytes.Clone(persistentContainer[:betaPersistentContainerLimit]), allowedLanguages...)
	streamingContainer = append(bytes.Clone(streamingContainer[:betaStreamingContainerLimit]), allowedLanguages...)

	updates := map[string][]byte{
		filepath.Join(dataRoot, "Persistent", "DesignData", "Windows", "th", "1fb7b1dce8d66efe8e111bb07a3eef44.bytes"):      textMap,
		filepath.Join(dataRoot, "StreamingAssets", "DesignData", "Windows", "th", "1fb7b1dce8d66efe8e111bb07a3eef44.bytes"): textMap,
		filepath.Join(persistentDesignDir, "fd5227547d65b8bb1238feb3e5820fa3.bytes"):                                        persistentUI,
		filepath.Join(streamingDesignDir, "2ea44f7fabf315d35de1d7f3b4c07d89.bytes"):                                         streamingUI,
		filepath.Join(dataRoot, "Plugins", "x86_64", "locales", "th.pak"):                                                   localePack,
		persistentContainerPath: persistentContainer,
		filepath.Join(persistentDesignDir, betaPersistentContainerCopy): persistentContainer,
		streamingContainerPath: streamingContainer,
		filepath.Join(streamingDesignDir, betaStreamingContainerCopy):                     streamingContainer,
		filepath.Join(persistentDesignDir, "DesignV_"+betaPersistentDesignV+".bytes"):     persistentDesign,
		filepath.Join(persistentDesignDir, "DesignV_"+betaPersistentDesignVCopy+".bytes"): persistentDesign,
		filepath.Join(streamingDesignDir, "DesignV_"+betaStreamingDesignV+".bytes"):       streamingDesign,
		filepath.Join(streamingDesignDir, "DesignV_"+betaStreamingDesignVCopy+".bytes"):   streamingDesign,
		filepath.Join(persistentDesignDir, "M_DesignV.bytes"):                             persistentMaster,
		filepath.Join(streamingDesignDir, "M_DesignV.bytes"):                              streamingMaster,
	}
	if archivePath := filepath.Join(streamingDesignDir, "M_Design_ArchiveV.bytes"); fileExists(archivePath) {
		updates[archivePath] = fmt.Appendf(nil, "%s,%d\n", betaStreamingDesignV, len(streamingDesign))
	}

	backupDir, err := backupAndApplyThaiPatch(gameRoot, updates)
	if err != nil {
		return false, fmt.Errorf("install Thai Beta patch: %w", err).Error()
	}
	return true, fmt.Sprintf("Thai patch installed for Beta Backup: %s", backupDir)
}

func updateMasterDesign(data []byte, hash string, size int) ([]byte, error) {
	if len(data) < 52 {
		return nil, fmt.Errorf("catalog is too short: %d bytes", len(data))
	}
	hashBytes, err := hex.DecodeString(hash)
	if err != nil || len(hashBytes) != 16 {
		return nil, fmt.Errorf("invalid DesignV hash %q", hash)
	}
	for i := 0; i < len(hashBytes); i += 4 {
		hashBytes[i], hashBytes[i+3] = hashBytes[i+3], hashBytes[i]
		hashBytes[i+1], hashBytes[i+2] = hashBytes[i+2], hashBytes[i+1]
	}

	updated := bytes.Clone(data)
	copy(updated[28:44], hashBytes)
	binary.LittleEndian.PutUint64(updated[44:52], uint64(size))
	return updated, nil
}

func backupAndApplyThaiPatch(gameRoot string, updates map[string][]byte) (string, error) {
	paths := make([]string, 0, len(updates))
	for path := range updates {
		relative, err := filepath.Rel(gameRoot, path)
		if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
			return "", fmt.Errorf("patch target is outside selected game folder: %s", path)
		}
		paths = append(paths, path)
	}
	sort.Strings(paths)

	backupDir, err := os.MkdirTemp(gameRoot, "Cyrene-Thai-Backup-")
	if err != nil {
		return "", fmt.Errorf("create backup folder: %w", err)
	}

	existed := make(map[string]bool, len(paths))
	for _, path := range paths {
		info, err := os.Stat(path)
		if err != nil && !os.IsNotExist(err) {
			return backupDir, fmt.Errorf("inspect existing game file %s: %w", path, err)
		}
		if os.IsNotExist(err) {
			continue
		}
		if !info.Mode().IsRegular() {
			return backupDir, fmt.Errorf("patch target is not a regular file: %s", path)
		}

		existed[path] = true
		relative, _ := filepath.Rel(gameRoot, path)
		backupPath := filepath.Join(backupDir, relative)
		if err := os.MkdirAll(filepath.Dir(backupPath), 0755); err != nil {
			return backupDir, fmt.Errorf("create backup path: %w", err)
		}
		if err := copyFile(path, backupPath); err != nil {
			return backupDir, fmt.Errorf("back up %s: %w", path, err)
		}
	}

	rollback := func() error {
		var rollbackErrors []error
		for _, path := range paths {
			if existed[path] {
				relative, _ := filepath.Rel(gameRoot, path)
				if err := copyFile(filepath.Join(backupDir, relative), path); err != nil {
					rollbackErrors = append(rollbackErrors, fmt.Errorf("restore %s: %w", path, err))
				}
			} else {
				if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
					rollbackErrors = append(rollbackErrors, fmt.Errorf("remove incomplete file %s: %w", path, err))
				}
			}
		}
		return errors.Join(rollbackErrors...)
	}

	for _, path := range paths {
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			rollbackErr := rollback()
			return backupDir, errors.Join(fmt.Errorf("create game folder %s: %w", filepath.Dir(path), err), rollbackErr)
		}
		if err := os.WriteFile(path, updates[path], 0644); err != nil {
			rollbackErr := rollback()
			return backupDir, errors.Join(fmt.Errorf("write %s: %w", path, err), rollbackErr)
		}
	}

	return backupDir, nil
}

func copyFile(source, destination string) error {
	input, err := os.Open(source)
	if err != nil {
		return err
	}
	defer input.Close()

	output, err := os.Create(destination)
	if err != nil {
		return err
	}
	if _, err := io.Copy(output, input); err != nil {
		output.Close()
		return err
	}
	if err := output.Close(); err != nil {
		return err
	}
	return nil
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.Mode().IsRegular()
}
