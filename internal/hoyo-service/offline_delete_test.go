package hoyoService

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDeleteCharacterFromPlayerSaveRemovesOnlyEquippedItems(t *testing.T) {
	const (
		targetAvatarID = uint64(1011)
		otherAvatarID  = uint64(1041)
		sharedWeaponID = uint64(2)
		targetWeaponID = uint64(3)
		sharedDiskID   = uint64(2)
		targetDiskID   = uint64(3)
	)

	targetAvatar := appendVarintField(nil, avatarItemIDField, targetAvatarID)
	targetAvatar = appendVarintField(targetAvatar, avatarWeaponUIDField, targetWeaponID)
	targetAvatar = appendVarintField(targetAvatar, avatarEquipmentField, sharedDiskID)
	targetAvatar = appendVarintField(targetAvatar, avatarEquipmentField, targetDiskID)
	otherAvatar := appendVarintField(nil, avatarItemIDField, otherAvatarID)
	otherAvatar = appendVarintField(otherAvatar, avatarWeaponUIDField, sharedWeaponID)
	otherAvatar = appendVarintField(otherAvatar, avatarEquipmentField, sharedDiskID)
	avatarSave := appendLengthDelimitedField(nil, avatarSaveItemField, targetAvatar)
	avatarSave = appendLengthDelimitedField(avatarSave, avatarSaveItemField, otherAvatar)

	weaponSave := appendLengthDelimitedField(nil, 1, appendVarintField(nil, 1, sharedWeaponID))
	weaponSave = appendLengthDelimitedField(weaponSave, 1, appendVarintField(nil, 1, targetWeaponID))
	equipSave := appendLengthDelimitedField(nil, equipSaveItemField, appendVarintField(nil, 1, sharedDiskID))
	equipSave = appendLengthDelimitedField(equipSave, equipSaveItemField, appendVarintField(nil, 1, targetDiskID))
	team := appendVarintField(nil, 1, 1)
	team = appendVarintField(team, quickTeamAvatarIDField, targetAvatarID)
	team = appendVarintField(team, quickTeamAvatarIDField, otherAvatarID)
	quickTeams := appendLengthDelimitedField(nil, quickTeamItemField, team)
	basicSave := appendVarintField(nil, 3, targetAvatarID)

	playerSave := appendLengthDelimitedField(nil, playerSaveBasicField, basicSave)
	playerSave = appendLengthDelimitedField(playerSave, playerSaveAvatarField, avatarSave)
	playerSave = appendLengthDelimitedField(playerSave, playerSaveWeaponField, weaponSave)
	playerSave = appendLengthDelimitedField(playerSave, playerSaveEquipField, equipSave)
	playerSave = appendLengthDelimitedField(playerSave, playerSaveQuickTeamField, quickTeams)

	updated, removedDisks, removedWeapons, err := deleteCharacterFromPlayerSave(playerSave, uint32(targetAvatarID))
	if err != nil {
		t.Fatal(err)
	}
	if removedDisks != 1 || removedWeapons != 1 {
		t.Fatalf("removed %d discs and %d weapons, want one of each", removedDisks, removedWeapons)
	}

	rootFields, err := parseProtobufFields(updated)
	if err != nil {
		t.Fatal(err)
	}
	avatarFieldIndex, _ := uniqueLengthDelimitedFieldIndex(rootFields, playerSaveAvatarField)
	remainingAvatars, err := parseProtobufFields(updated[rootFields[avatarFieldIndex].payloadFrom:rootFields[avatarFieldIndex].payloadTo])
	if err != nil {
		t.Fatal(err)
	}
	if len(remainingAvatars) != 1 {
		t.Fatalf("remaining avatar entries = %d, want 1", len(remainingAvatars))
	}
	remainingAvatar := updated[rootFields[avatarFieldIndex].payloadFrom+remainingAvatars[0].payloadFrom : rootFields[avatarFieldIndex].payloadFrom+remainingAvatars[0].payloadTo]
	remainingAvatarID, _, _, err := readAvatarSaveEquipment(remainingAvatar)
	if err != nil || remainingAvatarID != otherAvatarID {
		t.Fatalf("remaining avatar ID = %d, err = %v; want %d", remainingAvatarID, err, otherAvatarID)
	}

	if got := countInventoryUID(t, updated, playerSaveWeaponField, 1, sharedWeaponID); got != 1 {
		t.Errorf("shared W-Engine count = %d, want 1", got)
	}
	if got := countInventoryUID(t, updated, playerSaveWeaponField, 1, targetWeaponID); got != 0 {
		t.Errorf("target W-Engine count = %d, want 0", got)
	}
	if got := countInventoryUID(t, updated, playerSaveEquipField, equipSaveItemField, sharedDiskID); got != 1 {
		t.Errorf("shared Drive Disc count = %d, want 1", got)
	}
	if got := countInventoryUID(t, updated, playerSaveEquipField, equipSaveItemField, targetDiskID); got != 0 {
		t.Errorf("target Drive Disc count = %d, want 0", got)
	}

	basicIndex, _ := uniqueLengthDelimitedFieldIndex(rootFields, playerSaveBasicField)
	basicFields, err := parseProtobufFields(updated[rootFields[basicIndex].payloadFrom:rootFields[basicIndex].payloadTo])
	if err != nil {
		t.Fatal(err)
	}
	if len(basicFields) != 1 || basicFields[0].number != 3 || basicFields[0].value != otherAvatarID {
		t.Errorf("basic avatar references = %+v, want control avatar %d", basicFields, otherAvatarID)
	}

	quickTeamIndex, _ := uniqueLengthDelimitedFieldIndex(rootFields, playerSaveQuickTeamField)
	teamFields, err := parseProtobufFields(updated[rootFields[quickTeamIndex].payloadFrom:rootFields[quickTeamIndex].payloadTo])
	if err != nil {
		t.Fatal(err)
	}
	if len(teamFields) != 1 {
		t.Fatalf("quick team count = %d, want 1", len(teamFields))
	}
	remainingTeam := updated[rootFields[quickTeamIndex].payloadFrom+teamFields[0].payloadFrom : rootFields[quickTeamIndex].payloadFrom+teamFields[0].payloadTo]
	remainingTeamFields, err := parseProtobufFields(remainingTeam)
	if err != nil {
		t.Fatal(err)
	}
	if len(remainingTeamFields) != 2 || remainingTeamFields[1].number != quickTeamAvatarIDField || remainingTeamFields[1].value != otherAvatarID {
		t.Errorf("quick team fields = %+v, want the name and only avatar %d", remainingTeamFields, otherAvatarID)
	}
}

func TestDeleteAllCharactersSaveKeepsSelectedCharacterAndBackup(t *testing.T) {
	const playerUID = uint32(666)
	serverDir := t.TempDir()
	savePath := savePlayerPath(serverDir, playerUID)
	if err := os.MkdirAll(filepath.Dir(savePath), 0o700); err != nil {
		t.Fatal(err)
	}

	makeAvatar := func(id, weaponUID, diskUID uint64) []byte {
		avatar := appendVarintField(nil, avatarItemIDField, id)
		if weaponUID != 0 {
			avatar = appendVarintField(avatar, avatarWeaponUIDField, weaponUID)
		}
		if diskUID != 0 {
			avatar = appendVarintField(avatar, avatarEquipmentField, equipmentUIDBase+diskUID)
		}
		return avatar
	}
	avatarSave := appendLengthDelimitedField(nil, avatarSaveItemField, makeAvatar(1011, 7, 8))
	avatarSave = appendLengthDelimitedField(avatarSave, avatarSaveItemField, makeAvatar(1021, 9, 8))
	avatarSave = appendLengthDelimitedField(avatarSave, avatarSaveItemField, makeAvatar(1041, 10, 20))

	makeWeapon := func(uid uint64) []byte {
		item := appendVarintField(nil, 1, uid)
		item = appendVarintField(item, 2, 14160)
		item = appendVarintField(item, 3, 60)
		item = appendVarintField(item, 4, 5)
		item = appendVarintField(item, 5, 3)
		return item
	}
	weaponSave := appendLengthDelimitedField(nil, 1, makeWeapon(7))
	weaponSave = appendLengthDelimitedField(weaponSave, 1, makeWeapon(9))
	weaponSave = appendLengthDelimitedField(weaponSave, 1, makeWeapon(10))

	makeDisk := func(uid, id uint64) []byte {
		item := appendVarintField(nil, 1, uid)
		item = appendVarintField(item, 2, id)
		item = appendVarintField(item, 3, 15)
		item = appendVarintField(item, 4, 5)
		return item
	}
	diskSave := appendLengthDelimitedField(nil, equipSaveItemField, makeDisk(8, 33041))
	diskSave = appendLengthDelimitedField(diskSave, equipSaveItemField, makeDisk(20, 33042))
	basicSave := appendVarintField(nil, 3, 1011)

	original := appendLengthDelimitedField(nil, playerSaveBasicField, basicSave)
	original = appendLengthDelimitedField(original, playerSaveAvatarField, avatarSave)
	original = appendLengthDelimitedField(original, playerSaveWeaponField, weaponSave)
	original = appendLengthDelimitedField(original, playerSaveEquipField, diskSave)
	if err := os.WriteFile(savePath, original, 0o600); err != nil {
		t.Fatal(err)
	}

	backupPath, removedCharacters, removedDisks, removedWeapons, err := deleteAllCharactersSave(serverDir, playerUID, 1041)
	if err != nil {
		t.Fatal(err)
	}
	if removedCharacters != 2 || removedDisks != 1 || removedWeapons != 2 {
		t.Fatalf("removed %d characters, %d discs, and %d W-Engines; want 2, 1, and 2",
			removedCharacters, removedDisks, removedWeapons)
	}
	backup, err := os.ReadFile(backupPath)
	if err != nil {
		t.Fatalf("could not read backup: %v", err)
	}
	if string(backup) != string(original) {
		t.Fatal("backup does not contain the original save")
	}
	updated, err := os.ReadFile(savePath)
	if err != nil {
		t.Fatal(err)
	}
	rootFields, err := parseProtobufFields(updated)
	if err != nil {
		t.Fatal(err)
	}
	avatarSaveIndex, err := uniqueLengthDelimitedFieldIndex(rootFields, playerSaveAvatarField)
	if err != nil {
		t.Fatal(err)
	}
	avatarSaveFields, err := parseProtobufFields(updated[rootFields[avatarSaveIndex].payloadFrom:rootFields[avatarSaveIndex].payloadTo])
	if err != nil {
		t.Fatal(err)
	}
	if len(avatarSaveFields) != 1 {
		t.Fatalf("remaining characters = %d, want 1", len(avatarSaveFields))
	}
	avatarStart := rootFields[avatarSaveIndex].payloadFrom + avatarSaveFields[0].payloadFrom
	avatarEnd := rootFields[avatarSaveIndex].payloadFrom + avatarSaveFields[0].payloadTo
	avatarID, weaponUID, diskUIDs, err := readAvatarSaveEquipment(updated[avatarStart:avatarEnd])
	if err != nil || avatarID != 1041 || weaponUID != 10 || len(diskUIDs) != 1 || diskUIDs[0] != equipmentUIDBase+20 {
		t.Fatalf("remaining character data = id %d, weapon %d, discs %v, err %v", avatarID, weaponUID, diskUIDs, err)
	}
	if got := countInventoryUID(t, updated, playerSaveWeaponField, 1, 7); got != 0 {
		t.Errorf("deleted character's W-Engine remains %d times", got)
	}
	if got := countInventoryUID(t, updated, playerSaveWeaponField, 1, 9); got != 0 {
		t.Errorf("W-Engine shared only among deleted characters remains %d times", got)
	}
	if got := countInventoryUID(t, updated, playerSaveWeaponField, 1, 10); got != 1 {
		t.Errorf("kept character's W-Engine count = %d, want 1", got)
	}
	if got := countInventoryUID(t, updated, playerSaveEquipField, equipSaveItemField, 8); got != 0 {
		t.Errorf("Drive Disc shared only among deleted characters remains %d times", got)
	}
	if got := countInventoryUID(t, updated, playerSaveEquipField, equipSaveItemField, 20); got != 1 {
		t.Errorf("kept character's Drive Disc count = %d, want 1", got)
	}

	basicIndex, err := uniqueLengthDelimitedFieldIndex(rootFields, playerSaveBasicField)
	if err != nil {
		t.Fatal(err)
	}
	basicFields, err := parseProtobufFields(updated[rootFields[basicIndex].payloadFrom:rootFields[basicIndex].payloadTo])
	if err != nil {
		t.Fatal(err)
	}
	if len(basicFields) != 1 || basicFields[0].value != 1041 {
		t.Errorf("basic character reference = %+v, want selected character 1041", basicFields)
	}
}

func TestDeleteCharacterFromPlayerSaveRejectsMissingCharacter(t *testing.T) {
	avatar := appendVarintField(nil, avatarItemIDField, 1041)
	avatarSave := appendLengthDelimitedField(nil, avatarSaveItemField, avatar)
	playerSave := appendLengthDelimitedField(nil, playerSaveAvatarField, avatarSave)

	if _, _, _, err := deleteCharacterFromPlayerSave(playerSave, 1011); err == nil {
		t.Fatal("expected an error when the character is absent")
	}
}

func TestDeleteCharacterFromPlayerSaveRejectsLastCharacter(t *testing.T) {
	avatar := appendVarintField(nil, avatarItemIDField, 1011)
	avatarSave := appendLengthDelimitedField(nil, avatarSaveItemField, avatar)
	playerSave := appendLengthDelimitedField(nil, playerSaveAvatarField, avatarSave)

	if _, _, _, err := deleteCharacterFromPlayerSave(playerSave, 1011); err == nil {
		t.Fatal("expected an error when deleting the only character")
	}
}

func TestRemoveAvatarIDFromPackedQuickTeam(t *testing.T) {
	packedIDs := appendProtobufVarint(nil, 1011)
	packedIDs = appendProtobufVarint(packedIDs, 1041)
	team := appendVarintField(nil, 1, 1)
	team = appendLengthDelimitedField(team, quickTeamAvatarIDField, packedIDs)

	updated, changed, err := removeAvatarIDFromQuickTeam(team, 1011)
	if err != nil {
		t.Fatal(err)
	}
	if !changed {
		t.Fatal("expected packed quick team to be updated")
	}
	fields, err := parseProtobufFields(updated)
	if err != nil {
		t.Fatal(err)
	}
	if len(fields) != 2 || fields[1].number != quickTeamAvatarIDField || fields[1].wireType != 2 {
		t.Fatalf("updated quick team fields = %+v, want packed character IDs", fields)
	}
	values, err := readPackedVarints(updated[fields[1].payloadFrom:fields[1].payloadTo])
	if err != nil {
		t.Fatal(err)
	}
	if len(values) != 1 || values[0] != 1041 {
		t.Fatalf("remaining packed character IDs = %v, want [1041]", values)
	}
}

func TestParseSaveInventory(t *testing.T) {
	const (
		avatarID  = uint64(1011)
		weaponUID = uint64(7)
		diskUID   = uint64(8)
	)
	avatar := appendVarintField(nil, avatarItemIDField, avatarID)
	avatar = appendVarintField(avatar, avatarWeaponUIDField, weaponUID)
	avatar = appendVarintField(avatar, avatarEquipmentField, equipmentUIDBase+diskUID)
	avatarSave := appendLengthDelimitedField(nil, avatarSaveItemField, avatar)

	weapon := appendVarintField(nil, 1, weaponUID)
	weapon = appendVarintField(weapon, 2, 14160)
	weapon = appendVarintField(weapon, 3, 60)
	weapon = appendVarintField(weapon, 4, 5)
	weapon = appendVarintField(weapon, 5, 3)
	weaponSave := appendLengthDelimitedField(nil, 1, weapon)

	disk := appendVarintField(nil, 1, diskUID)
	disk = appendVarintField(disk, 2, 33041)
	disk = appendVarintField(disk, 3, 15)
	disk = appendVarintField(disk, 4, 5)
	equipSave := appendLengthDelimitedField(nil, equipSaveItemField, disk)

	playerSave := appendLengthDelimitedField(nil, playerSaveAvatarField, avatarSave)
	playerSave = appendLengthDelimitedField(playerSave, playerSaveWeaponField, weaponSave)
	playerSave = appendLengthDelimitedField(playerSave, playerSaveEquipField, equipSave)

	inventory, err := parseSaveInventory(playerSave)
	if err != nil {
		t.Fatal(err)
	}
	if len(inventory.Characters) != 1 || inventory.Characters[0] != uint32(avatarID) {
		t.Fatalf("saved character IDs = %v, want [%d]", inventory.Characters, avatarID)
	}
	if len(inventory.Weapons) != 1 {
		t.Fatalf("W-Engine inventory count = %d, want 1", len(inventory.Weapons))
	}
	gotWeapon := inventory.Weapons[0]
	if gotWeapon.UID != uint32(weaponUID) || gotWeapon.ID != 14160 || gotWeapon.Level != 60 ||
		gotWeapon.Rank != 5 || gotWeapon.Refinement != 3 || len(gotWeapon.EquippedToAgentIDs) != 1 ||
		gotWeapon.EquippedToAgentIDs[0] != uint32(avatarID) {
		t.Errorf("parsed W-Engine = %+v", gotWeapon)
	}
	if len(inventory.Disks) != 1 {
		t.Fatalf("Drive Disc inventory count = %d, want 1", len(inventory.Disks))
	}
	gotDisk := inventory.Disks[0]
	if gotDisk.UID != uint32(diskUID) || gotDisk.SetID != 33000 || gotDisk.Slot != 1 ||
		gotDisk.Rank != 4 || gotDisk.Level != 15 || len(gotDisk.EquippedToAgentIDs) != 1 ||
		gotDisk.EquippedToAgentIDs[0] != uint32(avatarID) {
		t.Errorf("parsed Drive Disc = %+v", gotDisk)
	}
}

func TestDeleteInventoryItemFromPlayerSaveRemovesReferences(t *testing.T) {
	const (
		avatarID  = uint64(1011)
		weaponUID = uint64(7)
		diskUID   = uint64(8)
	)
	avatar := appendVarintField(nil, avatarItemIDField, avatarID)
	avatar = appendVarintField(avatar, avatarWeaponUIDField, weaponUID)
	avatar = appendVarintField(avatar, avatarEquipmentField, equipmentUIDBase+diskUID)
	avatar = appendVarintField(avatar, avatarEquipmentField, equipmentUIDBase+9)
	avatarSave := appendLengthDelimitedField(nil, avatarSaveItemField, avatar)
	weapon := appendVarintField(nil, 1, weaponUID)
	weapon = appendVarintField(weapon, 2, 14160)
	weaponSave := appendLengthDelimitedField(nil, 1, weapon)
	otherWeapon := appendVarintField(nil, 1, 10)
	otherWeapon = appendVarintField(otherWeapon, 2, 14150)
	weaponSave = appendLengthDelimitedField(weaponSave, 1, otherWeapon)
	disk := appendVarintField(nil, 1, diskUID)
	disk = appendVarintField(disk, 2, 33041)
	diskSave := appendLengthDelimitedField(nil, equipSaveItemField, disk)
	otherDisk := appendVarintField(nil, 1, 9)
	otherDisk = appendVarintField(otherDisk, 2, 33042)
	diskSave = appendLengthDelimitedField(diskSave, equipSaveItemField, otherDisk)
	playerSave := appendLengthDelimitedField(nil, playerSaveAvatarField, avatarSave)
	playerSave = appendLengthDelimitedField(playerSave, playerSaveWeaponField, weaponSave)
	playerSave = appendLengthDelimitedField(playerSave, playerSaveEquipField, diskSave)

	withoutWeapon, affected, err := deleteInventoryItemFromPlayerSave(playerSave, "weapon", weaponUID)
	if err != nil {
		t.Fatal(err)
	}
	if len(affected) != 1 || affected[0] != uint32(avatarID) {
		t.Fatalf("affected Agents = %v, want [%d]", affected, avatarID)
	}
	if got := countInventoryUID(t, withoutWeapon, playerSaveWeaponField, 1, weaponUID); got != 0 {
		t.Errorf("deleted W-Engine remains in inventory %d times", got)
	}
	rootFields, err := parseProtobufFields(withoutWeapon)
	if err != nil {
		t.Fatal(err)
	}
	avatarFieldIndex, _ := uniqueLengthDelimitedFieldIndex(rootFields, playerSaveAvatarField)
	avatarItems, err := parseProtobufFields(withoutWeapon[rootFields[avatarFieldIndex].payloadFrom:rootFields[avatarFieldIndex].payloadTo])
	if err != nil {
		t.Fatal(err)
	}
	avatarFields, err := parseProtobufFields(withoutWeapon[rootFields[avatarFieldIndex].payloadFrom+avatarItems[0].payloadFrom : rootFields[avatarFieldIndex].payloadFrom+avatarItems[0].payloadTo])
	if err != nil {
		t.Fatal(err)
	}
	for _, field := range avatarFields {
		if field.number == avatarWeaponUIDField {
			t.Error("deleted W-Engine is still equipped")
		}
	}

	withoutDisk, affected, err := deleteInventoryItemFromPlayerSave(playerSave, "disk", diskUID)
	if err != nil {
		t.Fatal(err)
	}
	if len(affected) != 1 || affected[0] != uint32(avatarID) {
		t.Fatalf("affected Agents = %v, want [%d]", affected, avatarID)
	}
	if got := countInventoryUID(t, withoutDisk, playerSaveEquipField, equipSaveItemField, diskUID); got != 0 {
		t.Errorf("deleted Drive Disc remains in inventory %d times", got)
	}
	rootFields, err = parseProtobufFields(withoutDisk)
	if err != nil {
		t.Fatal(err)
	}
	avatarFieldIndex, _ = uniqueLengthDelimitedFieldIndex(rootFields, playerSaveAvatarField)
	avatarItems, err = parseProtobufFields(withoutDisk[rootFields[avatarFieldIndex].payloadFrom:rootFields[avatarFieldIndex].payloadTo])
	if err != nil {
		t.Fatal(err)
	}
	avatarFields, err = parseProtobufFields(withoutDisk[rootFields[avatarFieldIndex].payloadFrom+avatarItems[0].payloadFrom : rootFields[avatarFieldIndex].payloadFrom+avatarItems[0].payloadTo])
	if err != nil {
		t.Fatal(err)
	}
	var remainingDiskRefs int
	for _, field := range avatarFields {
		if field.number == avatarEquipmentField {
			remainingDiskRefs++
			if field.value == equipmentUIDBase+diskUID {
				t.Error("deleted Drive Disc is still equipped")
			}
		}
	}
	if remainingDiskRefs != 1 || avatarFields[len(avatarFields)-1].value != equipmentUIDBase+9 {
		t.Errorf("remaining Drive Disc equipment references = %+v", avatarFields)
	}
}

func TestDeleteAllInventoryItemsSaveCreatesOneBackupAndUnequipsAll(t *testing.T) {
	const playerUID = uint32(666)
	serverDir := t.TempDir()
	savePath := savePlayerPath(serverDir, playerUID)
	if err := os.MkdirAll(filepath.Dir(savePath), 0o700); err != nil {
		t.Fatal(err)
	}

	avatar := appendVarintField(nil, avatarItemIDField, 1011)
	avatar = appendVarintField(avatar, avatarWeaponUIDField, 7)
	avatar = appendVarintField(avatar, avatarEquipmentField, equipmentUIDBase+8)
	avatarSave := appendLengthDelimitedField(nil, avatarSaveItemField, avatar)

	weapon := appendVarintField(nil, 1, 7)
	weapon = appendVarintField(weapon, 2, 14160)
	weapon = appendVarintField(weapon, 3, 60)
	weapon = appendVarintField(weapon, 4, 5)
	weapon = appendVarintField(weapon, 5, 3)
	weaponSave := appendLengthDelimitedField(nil, 1, weapon)
	otherWeapon := appendVarintField(nil, 1, 9)
	otherWeapon = appendVarintField(otherWeapon, 2, 14150)
	otherWeapon = appendVarintField(otherWeapon, 3, 1)
	otherWeapon = appendVarintField(otherWeapon, 4, 4)
	otherWeapon = appendVarintField(otherWeapon, 5, 1)
	weaponSave = appendLengthDelimitedField(weaponSave, 1, otherWeapon)

	disk := appendVarintField(nil, 1, 8)
	disk = appendVarintField(disk, 2, 33041)
	disk = appendVarintField(disk, 3, 15)
	disk = appendVarintField(disk, 4, 5)
	diskSave := appendLengthDelimitedField(nil, equipSaveItemField, disk)
	otherDisk := appendVarintField(nil, 1, 10)
	otherDisk = appendVarintField(otherDisk, 2, 33042)
	otherDisk = appendVarintField(otherDisk, 3, 1)
	otherDisk = appendVarintField(otherDisk, 4, 4)
	diskSave = appendLengthDelimitedField(diskSave, equipSaveItemField, otherDisk)

	original := appendLengthDelimitedField(nil, playerSaveAvatarField, avatarSave)
	original = appendLengthDelimitedField(original, playerSaveWeaponField, weaponSave)
	original = appendLengthDelimitedField(original, playerSaveEquipField, diskSave)
	if err := os.WriteFile(savePath, original, 0o600); err != nil {
		t.Fatal(err)
	}

	backupPath, removedDisks, removedWeapons, affected, err := deleteAllInventoryItemsSave(serverDir, playerUID)
	if err != nil {
		t.Fatal(err)
	}
	if removedDisks != 2 || removedWeapons != 2 {
		t.Fatalf("removed %d discs and %d W-Engines, want 2 of each", removedDisks, removedWeapons)
	}
	if len(affected) != 1 || affected[0] != 1011 {
		t.Fatalf("affected Agents = %v, want [1011]", affected)
	}
	backup, err := os.ReadFile(backupPath)
	if err != nil {
		t.Fatalf("could not read backup: %v", err)
	}
	if string(backup) != string(original) {
		t.Fatal("backup does not contain the original save")
	}
	updated, err := os.ReadFile(savePath)
	if err != nil {
		t.Fatal(err)
	}
	if got := countInventoryUID(t, updated, playerSaveWeaponField, 1, 7); got != 0 {
		t.Errorf("W-Engine remains in inventory %d times", got)
	}
	if got := countInventoryUID(t, updated, playerSaveWeaponField, 1, 9); got != 0 {
		t.Errorf("unequipped W-Engine remains in inventory %d times", got)
	}
	if got := countInventoryUID(t, updated, playerSaveEquipField, equipSaveItemField, 8); got != 0 {
		t.Errorf("Drive Disc remains in inventory %d times", got)
	}
	if got := countInventoryUID(t, updated, playerSaveEquipField, equipSaveItemField, 10); got != 0 {
		t.Errorf("unequipped Drive Disc remains in inventory %d times", got)
	}
	inventory, err := parseSaveInventory(updated)
	if err != nil {
		t.Fatal(err)
	}
	if len(inventory.Weapons) != 0 || len(inventory.Disks) != 0 {
		t.Fatalf("inventory after bulk delete = %+v, want empty", inventory)
	}
	rootFields, err := parseProtobufFields(updated)
	if err != nil {
		t.Fatal(err)
	}
	avatarSaveIndex, err := uniqueLengthDelimitedFieldIndex(rootFields, playerSaveAvatarField)
	if err != nil {
		t.Fatal(err)
	}
	avatarSaveFields, err := parseProtobufFields(updated[rootFields[avatarSaveIndex].payloadFrom:rootFields[avatarSaveIndex].payloadTo])
	if err != nil {
		t.Fatal(err)
	}
	avatarStart := rootFields[avatarSaveIndex].payloadFrom + avatarSaveFields[0].payloadFrom
	avatarEnd := rootFields[avatarSaveIndex].payloadFrom + avatarSaveFields[0].payloadTo
	avatarFields, err := parseProtobufFields(updated[avatarStart:avatarEnd])
	if err != nil {
		t.Fatal(err)
	}
	for _, field := range avatarFields {
		if field.number == avatarWeaponUIDField || field.number == avatarEquipmentField {
			t.Errorf("equipment reference remains after bulk delete: %+v", field)
		}
	}
}

func TestDeleteCharacterSaveCreatesBackup(t *testing.T) {
	serverDir := t.TempDir()
	savePath := savePlayerPath(serverDir, 666)
	if err := os.MkdirAll(filepath.Dir(savePath), 0o700); err != nil {
		t.Fatal(err)
	}
	avatar := appendVarintField(nil, avatarItemIDField, 1011)
	otherAvatar := appendVarintField(nil, avatarItemIDField, 1041)
	avatarSave := appendLengthDelimitedField(nil, avatarSaveItemField, avatar)
	avatarSave = appendLengthDelimitedField(avatarSave, avatarSaveItemField, otherAvatar)
	original := appendLengthDelimitedField(nil, playerSaveAvatarField, avatarSave)
	if err := os.WriteFile(savePath, original, 0o600); err != nil {
		t.Fatal(err)
	}

	backupPath, _, _, err := deleteCharacterSave(serverDir, 666, 1011)
	if err != nil {
		t.Fatal(err)
	}
	backup, err := os.ReadFile(backupPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(backup) != string(original) {
		t.Fatal("backup does not match the original account save")
	}
}

func countInventoryUID(t *testing.T, playerSave []byte, rootFieldNumber, itemFieldNumber uint64, uid uint64) int {
	t.Helper()
	rootFields, err := parseProtobufFields(playerSave)
	if err != nil {
		t.Fatal(err)
	}
	rootIndex, err := uniqueLengthDelimitedFieldIndex(rootFields, rootFieldNumber)
	if err != nil || rootIndex < 0 {
		t.Fatalf("inventory field %d missing or invalid: %v", rootFieldNumber, err)
	}
	inventoryField := rootFields[rootIndex]
	inventory := playerSave[inventoryField.payloadFrom:inventoryField.payloadTo]
	items, err := parseProtobufFields(inventory)
	if err != nil {
		t.Fatal(err)
	}
	count := 0
	for _, field := range items {
		if field.number != itemFieldNumber {
			continue
		}
		itemFields, err := parseProtobufFields(inventory[field.payloadFrom:field.payloadTo])
		if err != nil {
			t.Fatal(err)
		}
		for _, itemField := range itemFields {
			if itemField.number == 1 && itemField.wireType == 0 && itemField.value == uid {
				count++
			}
		}
	}
	return count
}
