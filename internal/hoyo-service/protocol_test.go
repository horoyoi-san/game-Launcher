package hoyoService

import (
	"encoding/binary"
	"strings"
	"testing"
)

func TestBuildCreateWeaponPacket(t *testing.T) {
	packet, err := buildCreateWeaponPacket(1, 14160, 60, 5, 0x12345678)
	if err != nil {
		t.Fatal(err)
	}
	if len(packet) != 20 {
		t.Fatalf("packet length = %d, want 20", len(packet))
	}
	if packet[0] != 0 || packet[1] != 0 || binary.LittleEndian.Uint16(packet[2:4]) != createWeaponTag {
		t.Fatalf("invalid client header: %v", packet[:8])
	}
	if binary.LittleEndian.Uint32(packet[4:8]) != 0x12345678 {
		t.Fatal("request ID was not preserved")
	}
	if binary.LittleEndian.Uint32(packet[8:12]) != 1 || binary.LittleEndian.Uint32(packet[12:16]) != 1 {
		t.Fatalf("invalid create-weapon operation: %v", packet[8:16])
	}
	if binary.LittleEndian.Uint16(packet[16:18]) != 14160 {
		t.Fatalf("weapon ID = %d, want 14160", binary.LittleEndian.Uint16(packet[16:18]))
	}
	if got := binary.LittleEndian.Uint16(packet[18:20]); got != 2940 {
		t.Fatalf("weapon metadata = %d, want 2940", got)
	}
}

func TestBuildPlayerKickPacket(t *testing.T) {
	packet, err := buildPlayerKickPacket(123, 0x12345678)
	if err != nil {
		t.Fatal(err)
	}
	if len(packet) != 16 {
		t.Fatalf("packet length = %d, want 16", len(packet))
	}
	if binary.LittleEndian.Uint16(packet[2:4]) != playerKickTag {
		t.Fatalf("operation tag = %d, want %d", binary.LittleEndian.Uint16(packet[2:4]), playerKickTag)
	}
	if binary.LittleEndian.Uint32(packet[4:8]) != 0x12345678 {
		t.Fatal("request ID was not preserved")
	}
	if binary.LittleEndian.Uint32(packet[8:12]) != 123 {
		t.Fatalf("player UID = %d, want 123", binary.LittleEndian.Uint32(packet[8:12]))
	}
	if binary.LittleEndian.Uint32(packet[12:16]) != 0 {
		t.Fatalf("kick reason = %d, want 0", binary.LittleEndian.Uint32(packet[12:16]))
	}
}

func TestBuildCreateDiskPacket(t *testing.T) {
	packet, err := buildCreateDiskPacket(
		1, 33000, 4, 6, 12102,
		[]uint32{11103, 12103, 13103, 23203},
		[]uint32{1, 0, 1, 0},
		77,
	)
	if err != nil {
		t.Fatal(err)
	}
	if len(packet) != 40 {
		t.Fatalf("packet length = %d, want 40", len(packet))
	}
	if binary.LittleEndian.Uint16(packet[2:4]) != createEquipTag {
		t.Fatalf("operation tag = %d, want %d", binary.LittleEndian.Uint16(packet[2:4]), createEquipTag)
	}
	if binary.LittleEndian.Uint32(packet[16:20]) != 12102|750<<16 {
		t.Fatalf("main-stat property = %#x", binary.LittleEndian.Uint32(packet[16:20]))
	}
	if binary.LittleEndian.Uint32(packet[20:24]) != 11103|112<<16|2<<28 {
		t.Fatalf("first substat property = %#x", binary.LittleEndian.Uint32(packet[20:24]))
	}
	if binary.LittleEndian.Uint16(packet[36:38]) != 33046 {
		t.Fatalf("disk ID = %d, want 33046", binary.LittleEndian.Uint16(packet[36:38]))
	}
	if binary.LittleEndian.Uint16(packet[38:40]) != 95 {
		t.Fatalf("disk metadata = %d, want 95", binary.LittleEndian.Uint16(packet[38:40]))
	}
}

func TestBuildDefaultBDiskPacket(t *testing.T) {
	packet, err := buildCreateDiskPacket(
		67, 32800, 2, 1, 11103,
		[]uint32{11102, 12103, 12102, 13103},
		[]uint32{0, 0, 0, 0},
		77,
	)
	if err != nil {
		t.Fatalf("default B-Rank disk should be valid: %v", err)
	}
	if got := binary.LittleEndian.Uint16(packet[36:38]); got != 32821 {
		t.Errorf("default disk ID = %d, want 32821", got)
	}
	if got := binary.LittleEndian.Uint16(packet[38:40]); got != 89 {
		t.Errorf("default disk metadata = %d, want 89", got)
	}
}

func TestBuildCreateDiskPacketRejectsInvalidStats(t *testing.T) {
	tests := []struct {
		name       string
		mainStat   uint32
		subStats   []uint32
		subRolls   []uint32
		wantSubstr string
	}{
		{
			name:       "main stat does not match slot",
			mainStat:   12102,
			subStats:   []uint32{11103, 12103, 13103, 23203},
			subRolls:   []uint32{0, 0, 0, 0},
			wantSubstr: "not available",
		},
		{
			name:       "duplicate substat",
			mainStat:   11103,
			subStats:   []uint32{12103, 12103, 13103, 23203},
			subRolls:   []uint32{0, 0, 0, 0},
			wantSubstr: "unique",
		},
		{
			name:       "substat roll count exceeds protocol limit",
			mainStat:   11103,
			subStats:   []uint32{12103, 13103, 23203, 20103},
			subRolls:   []uint32{15, 0, 0, 0},
			wantSubstr: "between 0 and 14",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := buildCreateDiskPacket(1, 33000, 2, 1, test.mainStat, test.subStats, test.subRolls, 1)
			if err == nil || !strings.Contains(err.Error(), test.wantSubstr) {
				t.Fatalf("error = %v, want text %q", err, test.wantSubstr)
			}
		})
	}
}

func TestBuildCreateDiskPacketAllowsOverLimitRolls(t *testing.T) {
	_, err := buildCreateDiskPacket(
		1, 33000, 4, 6, 12102,
		[]uint32{11103, 12103, 13103, 23203},
		[]uint32{5, 1, 0, 0},
		1,
	)
	if err != nil {
		t.Fatalf("buildCreateDiskPacket() error = %v, want over-limit rolls accepted", err)
	}
}

func TestBuildModAvatarPacket(t *testing.T) {
	packet, err := buildModAvatarPacket(1, 1011, 5, uint64(2)|uint64(12)<<32, 99)
	if err != nil {
		t.Fatal(err)
	}
	if len(packet) != 32 {
		t.Fatalf("packet length = %d, want 32", len(packet))
	}
	if binary.LittleEndian.Uint64(packet[8:16]) != uint64(2)|uint64(12)<<32 {
		t.Fatalf("value = %#x", binary.LittleEndian.Uint64(packet[8:16]))
	}
	if binary.LittleEndian.Uint32(packet[16:20]) != 1 || binary.LittleEndian.Uint32(packet[20:24]) != 1011 || packet[24] != 5 {
		t.Fatalf("invalid avatar operation: %v", packet[16:])
	}
}

func TestBuildModAvatarAwakeningPacket(t *testing.T) {
	const awakeningID = 104105
	packet, err := buildModAvatarPacket(1, 1041, modAvatarFieldAwakening, awakeningID, 99)
	if err != nil {
		t.Fatal(err)
	}
	if got := packet[24]; got != modAvatarFieldAwakening {
		t.Fatalf("field = %d, want %d", got, modAvatarFieldAwakening)
	}
	if got := binary.LittleEndian.Uint64(packet[8:16]); got != awakeningID {
		t.Fatalf("awakening ID = %d, want %d", got, awakeningID)
	}
}

func TestBuildModAvatarSkinPacket(t *testing.T) {
	const skinID = 3110110
	packet, err := buildModAvatarPacket(1, 1011, modAvatarFieldSkin, skinID, 99)
	if err != nil {
		t.Fatal(err)
	}
	if got := packet[24]; got != modAvatarFieldSkin {
		t.Fatalf("field = %d, want %d", got, modAvatarFieldSkin)
	}
	if got := binary.LittleEndian.Uint64(packet[8:16]); got != skinID {
		t.Fatalf("skin ID = %d, want %d", got, skinID)
	}
}

func TestValidateControlResponse(t *testing.T) {
	ack := make([]byte, 8)
	ack[0], ack[1] = 0, 0
	binary.LittleEndian.PutUint16(ack[2:4], ackTag)
	binary.LittleEndian.PutUint32(ack[4:8], 123)
	if err := validateControlResponse(ack, 123); err != nil {
		t.Fatalf("valid ACK returned error: %v", err)
	}

	nak := make([]byte, 16)
	nak[0], nak[1] = 0, 0
	binary.LittleEndian.PutUint16(nak[2:4], nakTag)
	binary.LittleEndian.PutUint32(nak[4:8], 123)
	binary.LittleEndian.PutUint32(nak[8:12], 5)
	if err := validateControlResponse(nak, 123); err == nil || !strings.Contains(err.Error(), "UID or character was not found") || !strings.Contains(err.Error(), "online") {
		t.Fatalf("expected player-not-found error, got %v", err)
	}
}
