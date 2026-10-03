package excelLanguage

import (
	assetMeta "Cyrene-launcher/pkg/language-patch/asset-meta"
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

type ExcelLanguage struct {
	AssetFolder    string
	ExcelDataEntry *assetMeta.DataEntry
	ExcelFileEntry *assetMeta.FileEntry
}

func NewExcelLanguage(assetFolder string, dataEntry *assetMeta.DataEntry, fileEntry *assetMeta.FileEntry) *ExcelLanguage {
	return &ExcelLanguage{
		AssetFolder:    assetFolder,
		ExcelDataEntry: dataEntry,
		ExcelFileEntry: fileEntry,
	}
}

func (a *ExcelLanguage) Unmarshal(rows []LanguageRow) ([]byte, error) {
	buf := new(bytes.Buffer)

	buf.WriteByte(0)
	if err := writeI8Varint(buf, int8(len(rows))); err != nil {
		return nil, err
	}

	for _, row := range rows {
		rowData, err := row.Unmarshal()
		if err != nil {
			return nil, err
		}
		if _, err := buf.Write(rowData); err != nil {
			return nil, err
		}
	}

	return buf.Bytes(), nil
}

func (a *ExcelLanguage) Parse() ([]LanguageRow, error) {
	if a.ExcelDataEntry.Offset < 0 || a.ExcelDataEntry.Size <= 0 || a.ExcelDataEntry.Size > int64(int(^uint(0)>>1)) {
		return nil, fmt.Errorf("invalid language data range: offset %d, size %d", a.ExcelDataEntry.Offset, a.ExcelDataEntry.Size)
	}

	excelPath := filepath.Join(a.AssetFolder, a.ExcelFileEntry.FileByteName+".bytes")

	f, err := os.Open(excelPath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	if _, err := f.Seek(int64(a.ExcelDataEntry.Offset), io.SeekStart); err != nil {
		return nil, err
	}

	buffer := make([]byte, int(a.ExcelDataEntry.Size))
	if _, err := io.ReadFull(f, buffer); err != nil {
		return nil, err
	}

	reader := bytes.NewReader(buffer)

	_, _ = reader.ReadByte() // skip first byte
	count, err := readI8Varint(reader)
	if err != nil {
		return nil, err
	}

	rows := make([]LanguageRow, 0, count)
	for i := 0; i < count; i++ {
		bitmask, err := reader.ReadByte()
		if err != nil {
			return nil, err
		}

		row := LanguageRow{}

		if bitmask&(1<<0) != 0 {
			s, err := readString(reader)
			if err != nil {
				return nil, err
			}
			row.Area = &s
		}
		if bitmask&(1<<1) != 0 {
			t, err := reader.ReadByte()
			if err != nil {
				return nil, err
			}
			row.Type = &t
		}
		if bitmask&(1<<2) != 0 {
			arr, err := readStringArray(reader)
			if err != nil {
				return nil, err
			}
			row.LanguageList = arr
		}
		if bitmask&(1<<3) != 0 {
			s, err := readString(reader)
			if err != nil {
				return nil, err
			}
			row.DefaultLanguage = &s
		}

		rows = append(rows, row)
	}

	return rows, nil
}
