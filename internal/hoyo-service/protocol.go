package hoyoService

import (
	"crypto/rand"
	"encoding/binary"
	"errors"
	"fmt"
	"net"
	"time"
)

const (
	controlAddress   = "127.0.0.1:15810"
	protocolVersion  = 0
	operationVersion = 0
	ackTag           = 0
	nakTag           = 1

	modAvatarMetaTag = 2
	createWeaponTag  = 3
	createEquipTag   = 4
)

func newControlHeader(tag uint16, userdata uint32) []byte {
	packet := make([]byte, 8)
	packet[0] = protocolVersion
	packet[1] = operationVersion
	binary.LittleEndian.PutUint16(packet[2:4], tag)
	binary.LittleEndian.PutUint32(packet[4:8], userdata)
	return packet
}

func randomUserdata() (uint32, error) {
	var bytes [4]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return 0, fmt.Errorf("could not create request ID: %w", err)
	}
	return binary.LittleEndian.Uint32(bytes[:]), nil
}

func buildCreateWeaponPacket(playerUID, weaponID, level, refinement uint32, userdata uint32) ([]byte, error) {
	if !containsID(weaponIDs, weaponID) {
		return nil, fmt.Errorf("unknown weapon ID %d", weaponID)
	}
	if playerUID == 0 {
		return nil, errors.New("player UID must be greater than zero")
	}
	if level < 1 || level > 60 {
		return nil, errors.New("weapon level must be between 1 and 60")
	}
	if refinement < 1 || refinement > 5 {
		return nil, errors.New("weapon refinement must be between 1 and 5")
	}

	rank := weaponID/1000 - 10
	if rank < 2 || rank > 4 {
		return nil, fmt.Errorf("weapon %d has an unsupported rank", weaponID)
	}

	packet := newControlHeader(createWeaponTag, userdata)
	packet = append(packet, make([]byte, 8)...)
	binary.LittleEndian.PutUint32(packet[8:12], playerUID)
	binary.LittleEndian.PutUint32(packet[12:16], 1)

	packet = append(packet, make([]byte, 4)...)
	binary.LittleEndian.PutUint16(packet[16:18], uint16(weaponID))
	meta := uint16(level) | uint16((level-1)/10)<<6 | uint16(refinement)<<9
	binary.LittleEndian.PutUint16(packet[18:20], meta)
	return packet, nil
}

type diskProperty struct {
	statID uint32
	rolls  uint32
}

func buildCreateDiskPacket(
	playerUID, setID, rank, slot, mainStat uint32,
	subStatIDs, subRolls []uint32,
	userdata uint32,
) ([]byte, error) {
	if playerUID == 0 {
		return nil, errors.New("player UID must be greater than zero")
	}
	if !containsID(diskSetIDs, setID) {
		return nil, fmt.Errorf("unknown disk set ID %d", setID)
	}
	if rank < 2 || rank > 4 {
		return nil, errors.New("disk rank must be between 2 and 4")
	}
	if slot < 1 || slot > 6 {
		return nil, errors.New("disk slot must be between 1 and 6")
	}
	if len(subStatIDs) != 4 || len(subRolls) != 4 {
		return nil, errors.New("exactly four disk substats and roll counts are required")
	}

	main, ok := diskStats[mainStat]
	if !ok || !main.allowedMainSlots[slot] {
		return nil, fmt.Errorf("main stat %d is not available in disk slot %d", mainStat, slot)
	}

	usedStats := map[uint32]bool{mainStat: true}
	var subs [4]diskProperty
	for i, statID := range subStatIDs {
		definition, exists := diskStats[statID]
		if !exists || definition.subValue == 0 {
			return nil, fmt.Errorf("stat %d cannot be used as a disk substat", statID)
		}
		if usedStats[statID] {
			return nil, fmt.Errorf("disk stats must be unique (duplicate stat %d)", statID)
		}
		if subRolls[i] > 14 {
			return nil, errors.New("each substat roll count must be between 0 and 14")
		}
		usedStats[statID] = true
		subs[i] = diskProperty{statID: statID, rolls: subRolls[i]}
	}

	diskID := setID + 10*rank + slot
	packet := newControlHeader(createEquipTag, userdata)
	packet = append(packet, make([]byte, 8)...)
	binary.LittleEndian.PutUint32(packet[8:12], playerUID)
	binary.LittleEndian.PutUint32(packet[12:16], 1)

	packet = append(packet, make([]byte, 24)...)
	mainValue := main.mainValue / 3 * (rank - 1)
	mainEncoded := mainStat | mainValue<<16
	binary.LittleEndian.PutUint32(packet[16:20], mainEncoded)
	for i, property := range subs {
		definition := diskStats[property.statID]
		addValue := property.rolls + 1
		encoded := property.statID | uint32(definition.subValue)<<16 | addValue<<28
		binary.LittleEndian.PutUint32(packet[20+i*4:24+i*4], encoded)
	}
	binary.LittleEndian.PutUint16(packet[36:38], uint16(diskID))
	level := uint16(9 + 3*(rank-2))
	binary.LittleEndian.PutUint16(packet[38:40], level|uint16(5)<<4)
	return packet, nil
}

func buildModAvatarPacket(playerUID, avatarID uint32, field uint8, value uint64, userdata uint32) ([]byte, error) {
	if playerUID == 0 {
		return nil, errors.New("player UID must be greater than zero")
	}
	if !containsID(characterIDs, avatarID) {
		return nil, fmt.Errorf("unknown character ID %d", avatarID)
	}

	packet := newControlHeader(modAvatarMetaTag, userdata)
	packet = append(packet, make([]byte, 24)...)
	binary.LittleEndian.PutUint64(packet[8:16], value)
	binary.LittleEndian.PutUint32(packet[16:20], playerUID)
	binary.LittleEndian.PutUint32(packet[20:24], avatarID)
	packet[24] = field
	return packet, nil
}

func sendControlPacket(packet []byte) error {
	conn, err := net.DialTimeout("udp4", controlAddress, 3*time.Second)
	if err != nil {
		return fmt.Errorf("could not connect to Remielle control interface at %s: %w", controlAddress, err)
	}
	defer conn.Close()

	if err := conn.SetDeadline(time.Now().Add(3 * time.Second)); err != nil {
		return fmt.Errorf("could not set control request timeout: %w", err)
	}
	if _, err := conn.Write(packet); err != nil {
		return fmt.Errorf("could not send control request: %w", err)
	}

	response := make([]byte, 16)
	length, err := conn.Read(response)
	if err != nil {
		if timeoutErr, ok := err.(net.Error); ok && timeoutErr.Timeout() {
			return fmt.Errorf("no response from Remielle at %s; verify the server is running and its control interface is enabled", controlAddress)
		}
		return fmt.Errorf("could not receive Remielle response: %w", err)
	}
	return validateControlResponse(response[:length], binary.LittleEndian.Uint32(packet[4:8]))
}

func validateControlResponse(response []byte, userdata uint32) error {
	if len(response) < 8 {
		return errors.New("Remielle returned an incomplete control response")
	}
	if response[0] != protocolVersion {
		return fmt.Errorf("Remielle protocol version mismatch: %d", response[0])
	}
	if response[1] != 0 {
		return fmt.Errorf("Remielle event version mismatch: %d", response[1])
	}
	if binary.LittleEndian.Uint32(response[4:8]) != userdata {
		return errors.New("Remielle response request ID did not match")
	}

	switch tag := binary.LittleEndian.Uint16(response[2:4]); tag {
	case ackTag:
		if len(response) != 8 {
			return fmt.Errorf("Remielle ACK has invalid length %d", len(response))
		}
		return nil
	case nakTag:
		if len(response) != 16 {
			return fmt.Errorf("Remielle NAK has invalid length %d", len(response))
		}
		reason := binary.LittleEndian.Uint32(response[8:12])
		extra := binary.LittleEndian.Uint32(response[12:16])
		switch reason {
		case 1:
			return errors.New("Remielle rejected the request: protocol version mismatch")
		case 2:
			return fmt.Errorf("Remielle rejected the request: operation version mismatch (server version %d)", extra)
		case 3:
			return errors.New("Remielle rejected the request: unknown operation")
		case 4:
			return errors.New("Remielle rejected the request: invalid parameter")
		case 5:
			return errors.New("Remielle rejected the request: player UID or character was not found; verify the UID matches the server configuration and is online")
		case 6:
			return fmt.Errorf("Remielle rejected the request: inventory is full (%d spaces left)", extra)
		default:
			return fmt.Errorf("Remielle rejected the request with error %d (extra: %d)", reason, extra)
		}
	default:
		return fmt.Errorf("Remielle returned unknown event tag %d", tag)
	}
}
