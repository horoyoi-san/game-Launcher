package assetMeta

import (
	"encoding/binary"
	"io"
)

type DataEntry struct {
	NameHash int64
	Size     int64
	Offset   int64
}

func DataEntryFromBytes(r io.Reader) (*DataEntry, error) {
	var d DataEntry
	var nameHash, size, offset int32

	if err := binary.Read(r, binary.BigEndian, &nameHash); err != nil {
		return nil, err
	}
	if err := binary.Read(r, binary.BigEndian, &size); err != nil {
		return nil, err
	}
	if err := binary.Read(r, binary.BigEndian, &offset); err != nil {
		return nil, err
	}
	d.NameHash = int64(nameHash)
	d.Size = int64(size)
	d.Offset = int64(offset)

	return &d, nil
}
