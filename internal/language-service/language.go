package languageService

import (
	assetMeta "sunbringer-launcher/pkg/language-patch/asset-meta"
	excelLanguage "sunbringer-launcher/pkg/language-patch/excel-language"
	"sunbringer-launcher/pkg/models"
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
)

type LanguageService struct{}

func isValidLang(lang string) bool {
	valid := []string{"en", "jp", "cn", "kr", "th"}
	return slices.Contains(valid, lang)
}

func supportsTextLanguage(rows []excelLanguage.LanguageRow, area, lang string) bool {
	for _, row := range rows {
		if row.Area != nil && *row.Area == area && row.Type == nil && slices.Contains(row.LanguageList, lang) {
			return true
		}
	}
	return false
}

func findLanguageData(index *assetMeta.DesignIndex) (assetMeta.DataEntry, assetMeta.FileEntry, error) {
	for _, target := range []int64{-5186779221241758859, -515329346} {
		dataEntry, fileEntry, err := index.FindDataAndFileByTarget(target)
		if err == nil {
			return dataEntry, fileEntry, nil
		}
	}
	return assetMeta.DataEntry{}, assetMeta.FileEntry{}, fmt.Errorf("language data entry not found in DesignData index")
}

func (l *LanguageService) GetLanguage(path string) (bool, string, string, string) {
	currentVersionGame, err := models.ParseBinaryVersion(filepath.Join(path, "BinaryVersion.bytes"))
	if err != nil {
		return false, "", "", fmt.Errorf("read game version: %w", err).Error()
	}

	typeVersionGame := "os"
	if strings.Contains(currentVersionGame.Name, "CN") {
		typeVersionGame = "cn"
	}

	assetPath := filepath.Join(path, "DesignData\\Windows")

	indexHash, err := assetMeta.GetIndexHash(assetPath)
	if err != nil {
		return false, "", "", fmt.Errorf("read DesignData index hash: %w", err).Error()
	}

	DesignIndex, err := assetMeta.DesignIndexFromBytes(assetPath, indexHash)
	if err != nil {
		return false, "", "", fmt.Errorf("parse DesignData index: %w", err).Error()
	}
	dataEntry, fileEntry, err := findLanguageData(DesignIndex)
	if err != nil {
		return false, "", "", fmt.Errorf("find language data in DesignData index: %w", err).Error()
	}
	allowedLanguage := excelLanguage.NewExcelLanguage(assetPath, &dataEntry, &fileEntry)
	languageRows, err := allowedLanguage.Parse()
	if err != nil {
		return false, "", "", fmt.Errorf("parse language data: %w", err).Error()
	}

	currentTextLang := ""
	currentVoiceLang := ""

	pairs := []struct {
		area string
		typ  *uint8
	}{
		{"os", nil},
		{"cn", func() *uint8 { v := uint8(1); return &v }()},
		{"os", func() *uint8 { v := uint8(1); return &v }()},
		{"cn", nil},
	}

	for _, p := range pairs {
		var found *excelLanguage.LanguageRow
		for i := range languageRows {
			if languageRows[i].Area != nil && *languageRows[i].Area == p.area {
				if (languageRows[i].Type == nil && p.typ == nil) ||
					(languageRows[i].Type != nil && p.typ != nil && *languageRows[i].Type == *p.typ) {
					found = &languageRows[i]
					break
				}
			}
		}
		if found == nil {
			continue
		}
		if found.DefaultLanguage != nil && found.Area != nil && *found.Area == typeVersionGame && found.Type == nil {
			currentTextLang = *found.DefaultLanguage
		}
		if found.DefaultLanguage != nil && found.Area != nil && *found.Area == typeVersionGame && found.Type != nil {
			currentVoiceLang = *found.DefaultLanguage
		}
	}

	if currentTextLang == "" || currentVoiceLang == "" || !isValidLang(currentTextLang) || !isValidLang(currentVoiceLang) {
		return false, "", "", "not found language"
	}

	return true, currentTextLang, currentVoiceLang, ""
}

func (l *LanguageService) SetLanguage(path string, _ string, voice string) (bool, string) {
	if !isValidLang(voice) || voice == "th" {
		return false, "unsupported voice language"
	}

	indexHash, err := assetMeta.GetIndexHash(path)
	if err != nil {
		return false, fmt.Errorf("read DesignData index hash: %w", err).Error()
	}

	DesignIndex, err := assetMeta.DesignIndexFromBytes(path, indexHash)
	if err != nil {
		return false, fmt.Errorf("parse DesignData index: %w", err).Error()
	}
	dataEntry, fileEntry, err := findLanguageData(DesignIndex)
	if err != nil {
		return false, err.Error()
	}
	allowedLanguage := excelLanguage.NewExcelLanguage(path, &dataEntry, &fileEntry)
	languageRows, err := allowedLanguage.Parse()
	if err != nil {
		return false, fmt.Errorf("parse language data: %w", err).Error()
	}

	pairs := []struct {
		area string
		typ  *uint8
		lang string
	}{
		{"cn", func() *uint8 { v := uint8(1); return &v }(), voice},
		{"os", func() *uint8 { v := uint8(1); return &v }(), voice},
	}

	voiceUpdated := false
	for _, p := range pairs {
		var found *excelLanguage.LanguageRow
		for i := range languageRows {
			if languageRows[i].Area != nil && *languageRows[i].Area == p.area {
				if (languageRows[i].Type == nil && p.typ == nil) ||
					(languageRows[i].Type != nil && p.typ != nil && *languageRows[i].Type == *p.typ) {
					found = &languageRows[i]
					break
				}
			}
		}
		if found == nil {
			continue
		}

		found.DefaultLanguage = &p.lang
		found.LanguageList = []string{p.lang}
		if p.typ != nil && *p.typ == 1 {
			voiceUpdated = true
		}
	}
	if !voiceUpdated {
		return false, "voice language row not found in game data"
	}

	data, err := allowedLanguage.Unmarshal(languageRows)
	if err != nil {
		return false, fmt.Errorf("serialize language data: %w", err).Error()
	}

	filePath := filepath.Join(path, fileEntry.FileByteName+".bytes")

	if dataEntry.Offset < 0 || dataEntry.Size <= 0 || int64(len(data)) > dataEntry.Size {
		return false, fmt.Sprintf("language data size mismatch: serialized %d bytes, allocated %d bytes", len(data), dataEntry.Size)
	}

	f, err := os.OpenFile(filePath, os.O_RDWR, 0644)
	if err != nil {
		return false, fmt.Errorf("open language data file: %w", err).Error()
	}
	defer f.Close()

	if _, err := f.WriteAt(data, dataEntry.Offset); err != nil {
		return false, fmt.Errorf("write language settings: %w", err).Error()
	}

	if int64(len(data)) < dataEntry.Size {
		remaining := int(dataEntry.Size - int64(len(data)))
		zeros := bytes.Repeat([]byte{0}, remaining)
		if _, err := f.WriteAt(zeros, dataEntry.Offset+int64(len(data))); err != nil {
			return false, fmt.Errorf("clear unused language data: %w", err).Error()
		}
	}
	return true, "success"
}
