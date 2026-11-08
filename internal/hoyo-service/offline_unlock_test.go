package hoyoService

import (
	"errors"
	"net"
	"os"
	"path/filepath"
	"testing"
)

func TestAppendAvatarToPlayerSavePreservesOtherFields(t *testing.T) {
	basicSave := appendVarintField(nil, 1, 12)
	weaponSave := appendVarintField(nil, 1, 7)
	existingAvatar := appendVarintField(nil, 1, 1011)
	avatarSave := appendLengthDelimitedField(nil, avatarSaveItemField, existingAvatar)
	playerSave := appendLengthDelimitedField(nil, 1, basicSave)
	playerSave = appendLengthDelimitedField(playerSave, playerSaveAvatarField, avatarSave)
	playerSave = appendLengthDelimitedField(playerSave, 3, weaponSave)

	if fields, err := parseProtobufFields(playerSave); err != nil {
		t.Fatalf("constructed player save is invalid (%x): %v", playerSave, err)
	} else if nested, err := parseProtobufFields(playerSave[fields[1].payloadFrom:fields[1].payloadTo]); err != nil {
		t.Fatalf("constructed avatar save is invalid (%x): %v", playerSave[fields[1].payloadFrom:fields[1].payloadTo], err)
	} else if _, err := parseProtobufFields(playerSave[fields[1].payloadFrom+nested[0].payloadFrom : fields[1].payloadFrom+nested[0].payloadTo]); err != nil {
		t.Fatalf("constructed avatar item is invalid: %v", err)
	}

	updated, added, err := appendAvatarToPlayerSave(playerSave, 1041)
	if err != nil {
		t.Fatal(err)
	}
	if !added {
		t.Fatal("expected character to be added")
	}

	rootFields, err := parseProtobufFields(updated)
	if err != nil {
		t.Fatal(err)
	}
	if got := updated[rootFields[0].payloadFrom:rootFields[0].payloadTo]; string(got) != string(basicSave) {
		t.Errorf("basic save changed: got %v, want %v", got, basicSave)
	}
	if got := updated[rootFields[2].payloadFrom:rootFields[2].payloadTo]; string(got) != string(weaponSave) {
		t.Errorf("weapon save changed: got %v, want %v", got, weaponSave)
	}

	avatarFields, err := parseProtobufFields(updated[rootFields[1].payloadFrom:rootFields[1].payloadTo])
	if err != nil {
		t.Fatal(err)
	}
	if len(avatarFields) != 2 {
		t.Fatalf("avatar entry count = %d, want 2", len(avatarFields))
	}
	newItem := updated[rootFields[1].payloadFrom+avatarFields[1].payloadFrom : rootFields[1].payloadFrom+avatarFields[1].payloadTo]
	itemFields, err := parseProtobufFields(newItem)
	if err != nil {
		t.Fatal(err)
	}
	if itemFields[0].number != avatarItemIDField || itemFields[0].value != 1041 {
		t.Fatalf("new avatar ID field = (%d, %d), want (1, 1041)", itemFields[0].number, itemFields[0].value)
	}
	if len(itemFields) != 27 {
		t.Fatalf("new avatar field count = %d, want 27", len(itemFields))
	}
}

func TestAppendAvatarToPlayerSaveIsIdempotent(t *testing.T) {
	item := appendVarintField(nil, avatarItemIDField, 1041)
	avatarSave := appendLengthDelimitedField(nil, avatarSaveItemField, item)
	playerSave := appendLengthDelimitedField(nil, playerSaveAvatarField, avatarSave)

	updated, added, err := appendAvatarToPlayerSave(playerSave, 1041)
	if err != nil {
		t.Fatal(err)
	}
	if added {
		t.Fatal("expected existing character not to be added again")
	}
	if string(updated) != string(playerSave) {
		t.Fatal("save changed when character was already present")
	}
}

func TestAppendAvatarToPlayerSaveWithoutAvatarBlock(t *testing.T) {
	playerSave := appendVarintField(nil, 1, 12)
	updated, added, err := appendAvatarToPlayerSave(playerSave, 1011)
	if err != nil {
		t.Fatal(err)
	}
	if !added {
		t.Fatal("expected avatar block to be added")
	}
	fields, err := parseProtobufFields(updated)
	if err != nil {
		t.Fatal(err)
	}
	if len(fields) != 2 || fields[1].number != playerSaveAvatarField {
		t.Fatalf("player save fields = %+v, want basic and avatar", fields)
	}
}

func TestAppendAvatarToPlayerSaveRejectsMalformedData(t *testing.T) {
	for _, data := range [][]byte{nil, {0x12, 0x05, 0x01}} {
		if _, _, err := appendAvatarToPlayerSave(data, 1011); err == nil {
			t.Errorf("appendAvatarToPlayerSave(%v) expected an error", data)
		}
	}
}

func TestAppendAndEquipDisksPreservesExistingSaveData(t *testing.T) {
	avatarSave := appendLengthDelimitedField(nil, avatarSaveItemField, encodeDefaultAvatar(1011))
	existingEquip := appendVarintField(nil, 1, 7)
	existingEquip = appendVarintField(existingEquip, 2, 33001)
	equipSave := appendLengthDelimitedField(nil, equipSaveItemField, existingEquip)
	playerSave := appendLengthDelimitedField(nil, 1, appendVarintField(nil, 1, 12))
	playerSave = appendLengthDelimitedField(playerSave, playerSaveAvatarField, avatarSave)
	playerSave = appendLengthDelimitedField(playerSave, 3, appendVarintField(nil, 1, 5))
	playerSave = appendLengthDelimitedField(playerSave, playerSaveEquipField, equipSave)

	disks := []diskLoadoutItem{
		{setID: 33000, rank: 4, slot: 1, mainStat: 11103, subStatIDs: []uint32{12103, 13103, 23203, 20103}, subRolls: []uint32{1, 0, 0, 0}},
		{setID: 33100, rank: 3, slot: 4, mainStat: 21103, subStatIDs: []uint32{11103, 12103, 13103, 23203}, subRolls: []uint32{0, 0, 0, 0}},
	}
	updated, err := appendAndEquipDisks(playerSave, 1011, disks)
	if err != nil {
		t.Fatal(err)
	}
	rootFields, err := parseProtobufFields(updated)
	if err != nil {
		t.Fatal(err)
	}
	if rootFields[0].number != 1 || rootFields[2].number != 3 {
		t.Fatal("unrelated player save fields changed order")
	}
	updatedAvatar, err := findAvatarItem(updated, 1011)
	if err != nil {
		t.Fatal(err)
	}
	avatarItemFields, err := parseProtobufFields(updatedAvatar)
	if err != nil {
		t.Fatal(err)
	}
	var equipmentUIDs []uint64
	for _, field := range avatarItemFields {
		if field.number == avatarEquipmentField {
			equipmentUIDs = append(equipmentUIDs, field.value)
		}
	}
	if len(equipmentUIDs) != 6 || equipmentUIDs[0] != equipmentUIDBase+8 || equipmentUIDs[3] != equipmentUIDBase+9 {
		t.Fatalf("equipment UIDs = %v, want slot 1 UID %d and slot 4 UID %d", equipmentUIDs, equipmentUIDBase+8, equipmentUIDBase+9)
	}
	if equipmentUIDs[1] != 0 || equipmentUIDs[2] != 0 || equipmentUIDs[4] != 0 || equipmentUIDs[5] != 0 {
		t.Fatalf("unassigned slots changed: %v", equipmentUIDs)
	}

	var savedEquip []protobufField
	var updatedEquipSave []byte
	for _, field := range rootFields {
		if field.number != playerSaveEquipField {
			continue
		}
		updatedEquipSave = updated[field.payloadFrom:field.payloadTo]
		savedEquip, err = parseProtobufFields(updatedEquipSave)
		if err != nil {
			t.Fatal(err)
		}
	}
	if len(savedEquip) != 3 {
		t.Fatalf("equipment item count = %d, want existing item plus two new discs", len(savedEquip))
	}
	firstDisc := updatedEquipSave[savedEquip[1].payloadFrom:savedEquip[1].payloadTo]
	firstDiscFields, err := parseProtobufFields(firstDisc)
	if err != nil {
		t.Fatal(err)
	}
	if firstDiscFields[0].value != 8 || firstDiscFields[1].value != 33041 || firstDiscFields[2].value != 15 || firstDiscFields[3].value != 5 {
		t.Fatalf("unexpected saved disc fields: %+v", firstDiscFields[:4])
	}
	firstProperty, err := parseProtobufFields(firstDisc[firstDiscFields[4].payloadFrom:firstDiscFields[4].payloadTo])
	if err != nil {
		t.Fatal(err)
	}
	if firstProperty[0].value != 11103 || firstProperty[1].value != 549 || firstProperty[2].value != 0 {
		t.Fatalf("unexpected main stat property: %+v", firstProperty)
	}
}

func TestEquipDiskSetSaveCreatesBackupAndUnlocksCharacter(t *testing.T) {
	listener, err := net.ListenPacket("udp4", controlAddress)
	if err != nil {
		t.Skipf("Remielle control port is unavailable for test: %v", err)
	}
	if err := listener.Close(); err != nil {
		t.Fatal(err)
	}

	serverDir := t.TempDir()
	savePath := savePlayerPath(serverDir, 666)
	if err := os.MkdirAll(filepath.Dir(savePath), 0o700); err != nil {
		t.Fatal(err)
	}
	original := appendLengthDelimitedField(nil, 1, appendVarintField(nil, 1, 12))
	if err := os.WriteFile(savePath, original, 0o600); err != nil {
		t.Fatal(err)
	}

	backupPath, err := equipDiskSetSave(serverDir, 666, 1011, []diskLoadoutItem{
		{setID: 33000, rank: 4, slot: 1, mainStat: 11103, subStatIDs: []uint32{12103, 13103, 23203, 20103}, subRolls: []uint32{0, 0, 0, 0}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if backup, err := os.ReadFile(backupPath); err != nil || string(backup) != string(original) {
		t.Fatalf("backup = %v, err = %v; want original save %v", backup, err, original)
	}
	updated, err := os.ReadFile(savePath)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := findAvatarItem(updated, 1011); err != nil {
		t.Fatalf("new Agent is missing from save: %v", err)
	}
}

func findAvatarItem(playerSave []byte, avatarID uint32) ([]byte, error) {
	rootFields, err := parseProtobufFields(playerSave)
	if err != nil {
		return nil, err
	}
	for _, rootField := range rootFields {
		if rootField.number != playerSaveAvatarField || rootField.wireType != 2 {
			continue
		}
		avatarSave := playerSave[rootField.payloadFrom:rootField.payloadTo]
		avatarFields, err := parseProtobufFields(avatarSave)
		if err != nil {
			return nil, err
		}
		for _, avatarField := range avatarFields {
			if avatarField.number != avatarSaveItemField || avatarField.wireType != 2 {
				continue
			}
			item := avatarSave[avatarField.payloadFrom:avatarField.payloadTo]
			itemFields, err := parseProtobufFields(item)
			if err != nil {
				return nil, err
			}
			for _, field := range itemFields {
				if field.number == avatarItemIDField && field.wireType == 0 && field.value == uint64(avatarID) {
					return item, nil
				}
			}
		}
	}
	return nil, errors.New("character not found")
}

func TestUnlockCharacterSaveCreatesBackupAndUpdatesFile(t *testing.T) {
	listener, err := net.ListenPacket("udp4", controlAddress)
	if err != nil {
		t.Skipf("Remielle control port is unavailable for test: %v", err)
	}
	if err := listener.Close(); err != nil {
		t.Fatal(err)
	}

	serverDir := t.TempDir()
	savePath := savePlayerPath(serverDir, 666)
	if err := os.MkdirAll(filepath.Dir(savePath), 0o700); err != nil {
		t.Fatal(err)
	}
	original := appendVarintField(nil, 1, 12)
	if err := os.WriteFile(savePath, original, 0o600); err != nil {
		t.Fatal(err)
	}

	backupPath, added, err := unlockCharacterSave(serverDir, 666, 1011)
	if err != nil {
		t.Fatal(err)
	}
	if !added {
		t.Fatal("expected character to be added")
	}
	if backup, err := os.ReadFile(backupPath); err != nil || string(backup) != string(original) {
		t.Fatalf("backup = %v, err = %v; want original save %v", backup, err, original)
	}
	updated, err := os.ReadFile(savePath)
	if err != nil {
		t.Fatal(err)
	}
	if _, added, err := appendAvatarToPlayerSave(updated, 1011); err != nil || added {
		t.Fatalf("updated save does not contain unlocked character: added=%t err=%v", added, err)
	}
}

func TestEnsureRemielleStoppedRejectsOccupiedPort(t *testing.T) {
	listener, err := net.ListenPacket("udp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()

	if err := ensureRemielleStopped(listener.LocalAddr().String()); err == nil {
		t.Fatal("expected an error while the control port is occupied")
	}
}
