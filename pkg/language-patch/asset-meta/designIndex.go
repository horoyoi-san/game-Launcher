package assetMeta

import (
	"bytes"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

type DesignIndex struct {
	UnkI64          int64
	FileCount       int32
	DesignDataCount int32
	FileList        []FileEntry
}

func (d *DesignIndex) FindDataAndFileByTarget(target int64) (DataEntry, FileEntry, error) {
	for _, file := range d.FileList {
		for _, entry := range file.DataEntries {
			if entry.NameHash == target {
				return entry, file, nil
			}
		}
	}
	return DataEntry{}, FileEntry{}, errors.New("not found")
}

func DesignIndexFromBytes(assetFolder string, indexHash string) (*DesignIndex, error) {
	path := filepath.Join(assetFolder, fmt.Sprintf("DesignV_%s.bytes", indexHash))
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var parseErrors []error
	var firstParsed *DesignIndex
	for _, version := range []indexVersion{indexV3, indexV2, indexV1} {
		index, err := parseDesignIndex(data, version)
		if err != nil {
			parseErrors = append(parseErrors, fmt.Errorf("v%d: %w", version, err))
			continue
		}
		if firstParsed == nil {
			firstParsed = index
		}
		if index.hasLanguageDataTarget() {
			return index, nil
		}
	}
	if firstParsed != nil {
		return firstParsed, nil
	}
	return nil, errors.Join(parseErrors...)
}

func (d *DesignIndex) hasLanguageDataTarget() bool {
	for _, target := range []int64{-5186779221241758859, -515329346} {
		if _, _, err := d.FindDataAndFileByTarget(target); err == nil {
			return true
		}
	}
	return false
}

func GetIndexHash(assetFolder string) (string, error) {
	path := filepath.Join(assetFolder, "M_DesignV.bytes")

	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	if _, err = f.Seek(0x1C, 0); err != nil {
		return "", err
	}

	var storedHash [0x10]byte
	if _, err := io.ReadFull(f, storedHash[:]); err != nil {
		return "", err
	}

	hash := make([]byte, len(storedHash))
	for i := 0; i < 4; i++ {
		for j := 0; j < 4; j++ {
			hash[i*4+j] = storedHash[i*4+3-j]
		}
	}
	return hex.EncodeToString(hash), nil
}

type indexVersion int

const (
	indexV1 indexVersion = 1
	indexV2 indexVersion = 2
	indexV3 indexVersion = 3
)

func parseDesignIndex(data []byte, version indexVersion) (*DesignIndex, error) {
	r := bytes.NewReader(data)

	var header [8]byte
	if _, err := io.ReadFull(r, header[:]); err != nil {
		return nil, err
	}

	var fileCount uint32
	if err := binary.Read(r, binary.BigEndian, &fileCount); err != nil {
		return nil, err
	}
	if fileCount > uint32(^uint32(0)>>1) {
		return nil, fmt.Errorf("file count %d exceeds supported range", fileCount)
	}
	var designDataCount uint32
	if err := binary.Read(r, binary.LittleEndian, &designDataCount); err != nil {
		return nil, err
	}
	if designDataCount > uint32(^uint32(0)>>1) {
		return nil, fmt.Errorf("design data count %d exceeds supported range", designDataCount)
	}

	// Each file record has a fixed minimum size. Reject implausible counts
	// before allocating from data read off disk.
	minRecordSize := uint64(4 + 16 + 8 + 4 + 3)
	if version == indexV3 {
		minRecordSize += 4
	}
	if version == indexV1 {
		minRecordSize -= 2
	}
	if uint64(fileCount) > uint64(r.Len())/minRecordSize {
		return nil, fmt.Errorf("invalid file count %d", fileCount)
	}

	index := &DesignIndex{
		UnkI64:          int64(binary.LittleEndian.Uint64(header[:])),
		FileCount:       int32(fileCount),
		DesignDataCount: int32(designDataCount),
		FileList:        make([]FileEntry, 0, fileCount),
	}

	for i := uint32(0); i < fileCount; i++ {
		entry, err := parseFileEntry(r, version)
		if err != nil {
			return nil, fmt.Errorf("file entry %d: %w", i, err)
		}
		index.FileList = append(index.FileList, entry)
	}
	return index, nil
}

func parseFileEntry(r *bytes.Reader, version indexVersion) (FileEntry, error) {
	var entry FileEntry
	if err := binary.Read(r, binary.BigEndian, &entry.NameHash); err != nil {
		return entry, err
	}
	if version == indexV3 {
		var extra uint32
		if err := binary.Read(r, binary.BigEndian, &extra); err != nil {
			return entry, err
		}
	}

	var fileHash [16]byte
	if _, err := io.ReadFull(r, fileHash[:]); err != nil {
		return entry, err
	}
	entry.FileByteName = hex.EncodeToString(fileHash[:])

	var fileSize uint64
	if err := binary.Read(r, binary.BigEndian, &fileSize); err != nil {
		return entry, err
	}
	entry.Size = int64(fileSize)

	var dataCount uint32
	if err := binary.Read(r, binary.BigEndian, &dataCount); err != nil {
		return entry, err
	}
	if dataCount > uint32(^uint32(0)>>1) {
		return entry, fmt.Errorf("data entry count %d exceeds supported range", dataCount)
	}
	entrySize := uint64(12)
	if version == indexV3 {
		entrySize = 16
	}
	if uint64(dataCount) > uint64(r.Len())/entrySize {
		return entry, fmt.Errorf("invalid data entry count %d", dataCount)
	}
	entry.DataCount = int32(dataCount)
	entry.DataEntries = make([]DataEntry, 0, dataCount)
	for i := uint32(0); i < dataCount; i++ {
		var dataEntry DataEntry
		if version == indexV3 {
			if err := binary.Read(r, binary.BigEndian, &dataEntry.NameHash); err != nil {
				return entry, err
			}
		} else {
			var nameHash int32
			if err := binary.Read(r, binary.BigEndian, &nameHash); err != nil {
				return entry, err
			}
			dataEntry.NameHash = int64(nameHash)
		}
		var size, offset int32
		if err := binary.Read(r, binary.BigEndian, &size); err != nil {
			return entry, err
		}
		if err := binary.Read(r, binary.BigEndian, &offset); err != nil {
			return entry, err
		}
		dataEntry.Size = int64(size)
		dataEntry.Offset = int64(offset)
		entry.DataEntries = append(entry.DataEntries, dataEntry)
	}

	paddingSize := 3
	if version == indexV1 {
		paddingSize = 1
	}
	var padding [3]byte
	if _, err := io.ReadFull(r, padding[:paddingSize]); err != nil {
		return entry, err
	}
	entry.Unk = padding[0]
	return entry, nil
}
