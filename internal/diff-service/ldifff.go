package diffService

import (
	"Cyrene-launcher/pkg/Cyrene"
	"Cyrene-launcher/pkg/Cyrene/pb"
	"Cyrene-launcher/pkg/hpatchz"
	"Cyrene-launcher/pkg/models"
	"Cyrene-launcher/pkg/verifier"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func (h *DiffService) LDiffPatchData(gamePath string) (bool, string) {
	entries, err := os.ReadDir(gamePath)
	if err != nil {
		return false, err.Error()
	}
	ldiffPath := filepath.Join(gamePath, "ldiff")

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if !entry.Type().IsRegular() {
			continue
		}

		name := entry.Name()
		if strings.HasPrefix(name, "manifest") {
			manifestName := entry.Name()
			manifestPath := filepath.Join(gamePath, manifestName)

			manifest, err := Cyrene.LoadManifestProto(manifestPath)
			if err != nil {
				continue
			}

			ldiffEntries, err := os.ReadDir(ldiffPath)
			if err != nil {
				return false, err.Error()
			}
			application.Get().Event.Emit("diff:stage", map[string]string{"stage": "Processing LDiff"})
			for i, ldiffEntry := range ldiffEntries {
				assetName := ldiffEntry.Name()
				var matchingAssets []struct {
					AssetName string
					AssetSize int64
					Asset     *pb.AssetManifest
				}

				application.Get().Event.Emit(
					"diff:progress", map[string]int{
						"progress":    i,
						"maxProgress": len(ldiffEntries),
					})

				var wg sync.WaitGroup
				var mu sync.Mutex

				for _, assetGroup := range manifest.Assets {
					assetGroup := assetGroup
					wg.Go(func() {
						if data := assetGroup.AssetData; data != nil {
							for _, asset := range data.Assets {
								if asset.ChunkFileName == assetName {
									mu.Lock()
									matchingAssets = append(matchingAssets, struct {
										AssetName string
										AssetSize int64
										Asset     *pb.AssetManifest
									}{assetGroup.AssetName, assetGroup.AssetSize, asset})
									mu.Unlock()
								}
							}
						}
					})
				}

				wg.Wait()

				for _, ma := range matchingAssets {
					if err := Cyrene.LDiffFile(ma.Asset, ma.AssetName, ma.AssetSize, ldiffPath, gamePath); err != nil {
						return false, err.Error()
					}
				}
			}

			diffMapNames := make([]string, len(ldiffEntries))
			for i, e := range ldiffEntries {
				diffMapNames[i] = e.Name()
			}

			diffMapList, err := MakeDiffMap(manifest, diffMapNames)
			if err != nil {
				return false, err.Error()
			}
			application.Get().Event.Emit("diff:stage", map[string]string{"stage": "Patching HDiff"})
			for i, entry := range diffMapList {
				application.Get().Event.Emit(
					"diff:progress", map[string]int{
						"progress":    i,
						"maxProgress": len(diffMapList),
					})
				sourceFile := filepath.Join(gamePath, entry.SourceFileName)
				patchFile := filepath.Join(gamePath, entry.PatchFileName)
				targetFile := filepath.Join(gamePath, entry.TargetFileName)

				if _, err := os.Stat(patchFile); os.IsNotExist(err) {
					return false, fmt.Sprintf("required diff file is missing: %s", entry.PatchFileName)
				}

				if entry.SourceFileName == "" {
					if err := hpatchz.ApplyPatchEmpty(patchFile, targetFile); err != nil {
						return false, err.Error()
					}
					if err := verifyPatchTarget(targetFile, entry.TargetFileMD5, entry.TargetFileSize); err != nil {
						return false, err.Error()
					}
					os.Remove(patchFile)
					continue
				}

				if _, err := os.Stat(sourceFile); os.IsNotExist(err) {
					return false, fmt.Sprintf("required source game file is missing: %s", entry.SourceFileName)
				}
				if entry.SourceFileMD5 != "" {
					sourceMD5, err := verifier.FileMD5(sourceFile)
					if err != nil {
						return false, err.Error()
					}
					if !strings.EqualFold(sourceMD5, entry.SourceFileMD5) {
						return false, fmt.Sprintf("source game file MD5 mismatch for %s: expected %s, got %s", entry.SourceFileName, entry.SourceFileMD5, sourceMD5)
					}
				}

				if err := hpatchz.ApplyPatch(sourceFile, patchFile, targetFile); err != nil {
					return false, err.Error()
				}
				if err := verifyPatchTarget(targetFile, entry.TargetFileMD5, entry.TargetFileSize); err != nil {
					return false, err.Error()
				}
				if entry.SourceFileName != entry.TargetFileName {
					os.Remove(sourceFile)
				}
				os.Remove(patchFile)
			}

		}
	}
	os.RemoveAll(ldiffPath)
	return true, "patching completed"
}

func MakeDiffMap(manifest *pb.ManifestProto, chunkNames []string) ([]*models.HDiffData, error) {
	var hdiffFiles []*models.HDiffData

	for _, asset := range manifest.Assets {
		assetName := asset.AssetName
		assetSize := asset.AssetSize

		if asset.AssetData != nil {
			for _, chunk := range asset.AssetData.Assets {
				matched := false
				for _, name := range chunkNames {
					if name == chunk.ChunkFileName {
						matched = true
						break
					}
				}
				if !matched {
					continue
				}

				if chunk.OriginalFileSize != 0 || chunk.HdiffFileSize != assetSize {
					hdiffFiles = append(hdiffFiles, &models.HDiffData{
						SourceFileName: chunk.OriginalFilePath,
						SourceFileMD5:  chunk.OriginalFileMd5,
						SourceFileSize: chunk.OriginalFileSize,
						TargetFileName: assetName,
						TargetFileMD5:  asset.AssetHashMd5,
						TargetFileSize: assetSize,
						PatchFileName:  fmt.Sprintf("%s.hdiff", assetName),
					})
				}
			}
		}
	}

	return hdiffFiles, nil
}
