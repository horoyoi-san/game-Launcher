package assetMeta

import (
	"bytes"
	"encoding/binary"
	"os"
	"path/filepath"
	"testing"
)

func TestParseDesignIndexVersions(t *testing.T) {
	tests := []struct {
		name    string
		version indexVersion
		target  int64
	}{
		{name: "v1", version: indexV1, target: -515329346},
		{name: "v2", version: indexV2, target: -515329346},
		{name: "v3", version: indexV3, target: -5186779221241758859},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data := makeTestIndex(tt.version, tt.target)
			index, err := parseDesignIndex(data, tt.version)
			if err != nil {
				t.Fatalf("parseDesignIndex() error = %v", err)
			}

			got, file, err := index.FindDataAndFileByTarget(tt.target)
			if err != nil {
				t.Fatalf("FindDataAndFileByTarget() error = %v", err)
			}
			if got.Size != 32 || got.Offset != 8 {
				t.Fatalf("unexpected data entry: %+v", got)
			}
			if file.FileByteName != "0102030405060708090a0b0c0d0e0f10" {
				t.Fatalf("unexpected file hash: %q", file.FileByteName)
			}

			dir := t.TempDir()
			indexPath := filepath.Join(dir, "DesignV_test.bytes")
			if err := os.WriteFile(indexPath, data, 0600); err != nil {
				t.Fatalf("write test index: %v", err)
			}
			index, err = DesignIndexFromBytes(dir, "test")
			if err != nil {
				t.Fatalf("DesignIndexFromBytes() error = %v", err)
			}
			if _, _, err := index.FindDataAndFileByTarget(tt.target); err != nil {
				t.Fatalf("autodetected index is missing target: %v", err)
			}
		})
	}
}

func makeTestIndex(version indexVersion, target int64) []byte {
	var data bytes.Buffer
	data.Write(make([]byte, 8))
	_ = binary.Write(&data, binary.BigEndian, uint32(1))
	_ = binary.Write(&data, binary.LittleEndian, uint32(1))

	_ = binary.Write(&data, binary.BigEndian, int32(7))
	if version == indexV3 {
		_ = binary.Write(&data, binary.BigEndian, uint32(9))
	}
	data.Write([]byte{
		1, 2, 3, 4, 5, 6, 7, 8,
		9, 10, 11, 12, 13, 14, 15, 16,
	})
	_ = binary.Write(&data, binary.BigEndian, uint64(64))
	_ = binary.Write(&data, binary.BigEndian, uint32(1))
	if version == indexV3 {
		_ = binary.Write(&data, binary.BigEndian, target)
	} else {
		_ = binary.Write(&data, binary.BigEndian, int32(target))
	}
	_ = binary.Write(&data, binary.BigEndian, int32(32))
	_ = binary.Write(&data, binary.BigEndian, int32(8))
	if version == indexV1 {
		data.WriteByte(0)
	} else {
		data.Write([]byte{0, 0, 0})
	}
	return data.Bytes()
}

func TestParseDesignIndexRejectsTruncatedInput(t *testing.T) {
	if _, err := parseDesignIndex([]byte{1, 2, 3}, indexV1); err == nil {
		t.Fatal("expected an error for truncated index data")
	}
}
