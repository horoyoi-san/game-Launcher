package diffService

import (
	"Cyrene-launcher/pkg/constant"
	"Cyrene-launcher/pkg/hpatchz"
	"Cyrene-launcher/pkg/models"
	"Cyrene-launcher/pkg/sevenzip"
	"Cyrene-launcher/pkg/verifier"
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type DiffService struct{}

func (h *DiffService) CheckTypeHDiff(patchPath string) (bool, string, string) {
	if ok, err := sevenzip.IsFileIn7z(patchPath, "hdifffiles.txt"); err == nil && ok {
		return true, "hdifffiles.txt", ""
	}
	if ok, err := sevenzip.IsFileIn7z(patchPath, "hdifffiles.json"); err == nil && ok {
		return true, "hdifffiles.json", ""
	}
	if ok, err := sevenzip.IsFileIn7z(patchPath, "hdiffmap.json"); err == nil && ok {
		return true, "hdiffmap.json", ""
	}
	if ok, err := sevenzip.IsFileIn7z(patchPath, "manifest"); err == nil && ok {
		return true, "manifest", ""
	}

	return false, "", "not found hdifffiles.txt or hdiffmap.json"
}

func (h *DiffService) VersionValidate(gamePath, patchPath string) (bool, string) {
	oldBinPath := filepath.Join(gamePath, "StarRail_Data\\StreamingAssets\\BinaryVersion.bytes")
	if _, err := os.Stat(oldBinPath); err != nil {
		errorPayload := map[string]interface{}{
			"code":    "GAME_BINARY_NOT_FOUND",
			"title":   "ไม่พบไฟล์ระบุเวอร์ชันของเกม",
			"stage":   "Version Validate",
			"file":    oldBinPath,
			"message": err.Error(),
			"reason":  "ไม่พบไฟล์ StarRail_Data\\StreamingAssets\\BinaryVersion.bytes ในโฟลเดอร์เกมที่เลือก",
			"suggestions": []string{
				"ตรวจสอบว่าเลือกโฟลเดอร์เกมที่ถูกต้อง (โฟลเดอร์หลักที่มี StarRail_Data)",
			},
		}
		jsonBytes, _ := json.Marshal(errorPayload)
		return false, string(jsonBytes)
	}
	if _, err := os.Stat(patchPath); err != nil {
		errorPayload := map[string]interface{}{
			"code":    "PATCH_FILE_NOT_FOUND",
			"title":   "ไม่พบไฟล์แพตช์ที่ระบุ",
			"stage":   "Version Validate",
			"message": err.Error(),
			"reason":  "ไฟล์แพตช์ที่เลือกอาจถูกย้าย ลบ หรือไม่มีสิทธิ์เข้าถึง",
			"suggestions": []string{
				"ตรวจสอบว่าไฟล์แพตช์ยังคงอยู่ในตำแหน่งเดิมและไม่ได้ถูกโปรแกรมอื่นล็อกไว้",
			},
		}
		jsonBytes, _ := json.Marshal(errorPayload)
		return false, string(jsonBytes)
	}

	if _, err := os.Stat(constant.TempUrl); os.IsNotExist(err) {
		if err := os.MkdirAll(constant.TempUrl, os.ModePerm); err != nil {
			return false, err.Error()
		}
	}

	okFull, errFull := sevenzip.IsFileIn7z(patchPath, "StarRail_Data\\StreamingAssets\\BinaryVersion.bytes")
	okDiff, errDiff := sevenzip.IsFileIn7z(patchPath, "StarRail_Data\\StreamingAssets\\BinaryVersion.bytes.hdiff")

	if (errFull != nil && errDiff != nil) || (!okFull && !okDiff) {
		errorPayload := map[string]interface{}{
			"code":    "BINARY_VERSION_NOT_FOUND_IN_PATCH",
			"title":   "ไม่พบข้อมูลเวอร์ชันในไฟล์แพตช์",
			"stage":   "Version Validate",
			"message": "BinaryVersion file not found in patch",
			"reason":  "ไม่พบไฟล์ BinaryVersion.bytes หรือ BinaryVersion.bytes.hdiff ในแพตช์",
			"suggestions": []string{
				"ตรวจสอบว่าไฟล์ที่เลือกเป็นแพตช์อัปเดตของเกมที่ถูกต้อง (.7z, .zip, .rar)",
			},
		}
		jsonBytes, _ := json.Marshal(errorPayload)
		return false, string(jsonBytes)
	}

	var tempBinFile string

	if okFull {
		if err := sevenzip.ExtractAFileFromZip(patchPath, "StarRail_Data\\StreamingAssets\\BinaryVersion.bytes", constant.TempUrl); err != nil {
			return false, err.Error()
		}
		tempBinFile = filepath.Join(constant.TempUrl, "BinaryVersion.bytes")
	} else {
		if err := sevenzip.ExtractAFileFromZip(patchPath, "StarRail_Data\\StreamingAssets\\BinaryVersion.bytes.hdiff", constant.TempUrl); err != nil {
			return false, err.Error()
		}

		patchBinFile := filepath.Join(constant.TempUrl, "BinaryVersion.bytes.hdiff")
		sourceBinFile := oldBinPath
		tempBinFile = filepath.Join(constant.TempUrl, "BinaryVersion.bytes")

		if err := hpatchz.ApplyPatch(sourceBinFile, patchBinFile, tempBinFile); err != nil {
			os.Remove(patchBinFile)
			return false, err.Error()
		}
		os.Remove(patchBinFile)
	}

	okFullPkg, err1 := sevenzip.IsFileIn7z(patchPath, "pkg_version")
	okDiffPkg, err2 := sevenzip.IsFileIn7z(patchPath, "pkg_version.hdiff")
	if err1 != nil && err2 != nil {
		return false, err1.Error()
	}
	if okFullPkg {
		if err := sevenzip.ExtractAFileFromZip(patchPath, "pkg_version", constant.TempUrl); err != nil {
			return false, err.Error()
		}
	}
	if okDiffPkg {
		if err := sevenzip.ExtractAFileFromZip(patchPath, "pkg_version.hdiff", constant.TempUrl); err != nil {
			return false, err.Error()
		}
		patchPkgFile := filepath.Join(constant.TempUrl, "pkg_version.hdiff")
		sourcePkgFile := filepath.Join(gamePath, "pkg_version")
		tempPkgFile := filepath.Join(constant.TempUrl, "pkg_version")
		if err := hpatchz.ApplyPatch(sourcePkgFile, patchPkgFile, tempPkgFile); err != nil {
			os.Remove(patchPkgFile)
			os.Remove(tempPkgFile)
			return false, err.Error()
		}
		os.Remove(patchPkgFile)
	}

	tempPkgFile := filepath.Join(constant.TempUrl, "pkg_version")
	pkgDataList, err := models.LoadPkgVersion(tempPkgFile)
	if err != nil {
		os.Remove(tempPkgFile)
		return false, err.Error()
	}
	os.Remove(tempPkgFile)

	// MD5 check BinaryVersion
	flags := false
	for _, pkgData := range pkgDataList {
		if filepath.ToSlash(pkgData.RemoteFile) == "StarRail_Data/StreamingAssets/BinaryVersion.bytes" {
			flags = true

			md5, err := verifier.FileMD5(tempBinFile)
			if err != nil {
				os.Remove(tempBinFile)
				return false, err.Error()
			}

			info, err := os.Stat(tempBinFile)
			if err != nil {
				os.Remove(tempBinFile)
				return false, err.Error()
			}

			if md5 != pkgData.MD5 {
				currentGameVer := "ไม่ทราบเวอร์ชัน"
				if binVer, err := models.ParseBinaryVersion(oldBinPath); err == nil && binVer != nil {
					currentGameVer = binVer.String()
				}

				errorPayload := map[string]interface{}{
					"code":               "VERSION_MD5_MISMATCH",
					"title":              "เวอร์ชันเกมไม่ตรงกับไฟล์แพตช์ (Version Mismatch)",
					"stage":              "Version Validate",
					"file":               "StarRail_Data/StreamingAssets/BinaryVersion.bytes",
					"currentGameVersion": currentGameVer,
					"expectedMd5":        pkgData.MD5,
					"actualMd5":          md5,
					"fileSize":           info.Size(),
					"message":            fmt.Sprintf("md5 mismatch for %s: expected %s, got %s, size=%d bytes", tempBinFile, pkgData.MD5, md5, info.Size()),
					"reason":             "ไฟล์อัปเดต (Patch) นี้ไม่ได้สร้างขึ้นสำหรับเวอร์ชันเกมปัจจุบันที่ติดตั้งในเครื่องของคุณ หรือไฟล์เกมเดิมมีการดัดแปลง/เสียหาย",
					"suggestions": []string{
						"ตรวจสอบว่าไฟล์ Patch อัปเดตจากเวอร์ชันใดไปยังเวอร์ชันใด (เวอร์ชันปัจจุบันในเครื่อง: " + currentGameVer + ")",
						"ตรวจสอบว่าเลือกโฟลเดอร์เกมที่ถูกต้องในขั้นตอนที่ 1",
						"หากไฟล์เกมเดิมมีปัญหา แนะนำให้ทำการตรวจสอบความสมบูรณ์ของไฟล์เกมเดิมก่อนเริ่มอัปเดต",
					},
				}

				jsonBytes, err := json.Marshal(errorPayload)
				os.Remove(tempBinFile)
				if err == nil {
					return false, string(jsonBytes)
				}
				return false, fmt.Sprintf("md5 mismatch for %s: expected %s, got %s, size=%d bytes", tempBinFile, pkgData.MD5, md5, info.Size())
			}
			break
		}
	}

	if !flags {
		os.Remove(tempBinFile)
		return false, "BinaryVersion file not found in patch"
	}
	_, err = models.ParseBinaryVersion(tempBinFile)
	if err != nil {
		os.Remove(tempBinFile)
		return false, err.Error()
	}

	os.Remove(tempBinFile)
	return true, "validated"
}

func (h *DiffService) HDiffPatchData(gamePath string) (bool, string) {
	hdiffMapPath := filepath.Join(gamePath, "hdiffmap.json")
	hdiffFilesPath := filepath.Join(gamePath, "hdifffiles.txt")
	hdifffilesJsonPath := filepath.Join(gamePath, "hdifffiles.json")

	var jsonData struct {
		DiffMap []*models.HDiffData `json:"diff_map"`
	}

	if _, err := os.Stat(hdiffMapPath); err == nil {
		data, err := os.ReadFile(hdiffMapPath)
		if err != nil {
			return false, err.Error()
		}

		var jsonDataDiffMap struct {
			DiffMap []*models.DiffMapType `json:"diff_map"`
		}
		if err := json.Unmarshal(data, &jsonDataDiffMap); err != nil {
			return false, err.Error()
		}
		for _, entry := range jsonDataDiffMap.DiffMap {
			jsonData.DiffMap = append(jsonData.DiffMap, entry.ToHDiffData())
		}
	} else if _, err := os.Stat(hdifffilesJsonPath); err == nil {
		data, err := os.ReadFile(hdifffilesJsonPath)
		if err != nil {
			return false, err.Error()
		}
		var hdiffJson []*models.HDiffData
		if err := json.Unmarshal(data, &hdiffJson); err != nil {
			return false, err.Error()
		}
		jsonData.DiffMap = append(jsonData.DiffMap, hdiffJson...)
	} else if _, err := os.Stat(hdiffFilesPath); err == nil {
		files, err := models.LoadHDiffFiles(hdiffFilesPath)
		if err != nil {
			return false, err.Error()
		}
		for _, entry := range files {
			jsonData.DiffMap = append(jsonData.DiffMap, entry.ToHDiffData())
		}
	} else {
		return false, "no hdiff entries map exist"
	}

	application.Get().Event.Emit("diff:stage", map[string]string{"stage": "Patching HDiff"})

	for i, entry := range jsonData.DiffMap {
		application.Get().Event.Emit(
			"diff:progress", map[string]int{
				"progress":    i,
				"maxProgress": len(jsonData.DiffMap),
			})

		sourceFile := filepath.Join(gamePath, entry.SourceFileName)
		patchFile := filepath.Join(gamePath, entry.PatchFileName)
		targetFile := filepath.Join(gamePath, entry.TargetFileName)

		if _, err := os.Stat(patchFile); os.IsNotExist(err) {
			continue
		}

		if entry.SourceFileName == "" {
			hpatchz.ApplyPatchEmpty(patchFile, targetFile)
			os.Remove(patchFile)
			continue
		}

		if _, err := os.Stat(sourceFile); os.IsNotExist(err) {
			continue
		}

		hpatchz.ApplyPatch(sourceFile, patchFile, targetFile)
		if entry.SourceFileName != entry.TargetFileName {
			os.Remove(sourceFile)
		}
		os.Remove(patchFile)
	}

	os.Remove(filepath.Join(gamePath, "hdiffmap.json"))
	os.Remove(filepath.Join(gamePath, "hdifffiles.txt"))
	os.Remove(filepath.Join(gamePath, "hdifffiles.json"))
	return true, "patching completed"
}

func (h *DiffService) DeleteFiles(gamePath string) (bool, string) {
	var deleteFiles []string

	file, err := os.Open(filepath.Join(gamePath, "deletefiles.txt"))
	if err != nil {
		return false, ""
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" {
			deleteFiles = append(deleteFiles, line)
		}
	}

	if err := scanner.Err(); err != nil {
		file.Close()
		return false, "no delete files exist"
	}

	file.Close()

	for i, file := range deleteFiles {
		os.Remove(filepath.Join(gamePath, file))
		application.Get().Event.Emit("diff:progress", map[string]int{"progress": i, "maxProgress": len(deleteFiles)})
	}
	os.Remove(filepath.Join(gamePath, "deletefiles.txt"))
	return true, ""
}
