package hoyoService

import (
	"errors"
	"fmt"
	"os"
)

const (
	playerSaveBasicField     = 1
	playerSaveWeaponField    = 3
	playerSaveQuickTeamField = 9
	avatarWeaponUIDField     = 10
	avatarSaveWeaponUIDField = 10
	quickTeamItemField       = 1
	quickTeamAvatarIDField   = 2
)

func deleteInventoryItemSave(serverDir string, playerUID uint32, itemType string, itemUID uint32) (string, []uint32, error) {
	if playerUID == 0 || itemUID == 0 {
		return "", nil, errors.New("player UID and inventory item UID must be greater than zero")
	}
	if itemType != "disk" && itemType != "weapon" {
		return "", nil, fmt.Errorf("unsupported inventory item type %q", itemType)
	}
	savePath := savePlayerPath(serverDir, playerUID)
	data, err := os.ReadFile(savePath)
	if err != nil {
		return "", nil, fmt.Errorf("could not read Remielle account save %s: %w", savePath, err)
	}
	updated, affectedAvatarIDs, err := deleteInventoryItemFromPlayerSave(data, itemType, uint64(itemUID))
	if err != nil {
		return "", nil, fmt.Errorf("could not delete inventory item: %w", err)
	}
	backupPath, err := writePlayerSaveUpdate(savePath, data, updated)
	if err != nil {
		return "", nil, err
	}
	return backupPath, affectedAvatarIDs, nil
}

func deleteInventoryItemFromPlayerSave(playerSave []byte, itemType string, itemUID uint64) ([]byte, []uint32, error) {
	if itemUID == 0 {
		return nil, nil, errors.New("inventory item UID must be greater than zero")
	}
	updated, affectedAvatarIDs, removed, err := deleteInventoryItemsFromPlayerSave(
		playerSave,
		itemType,
		map[uint64]bool{itemUID: true},
	)
	if err != nil {
		return nil, nil, err
	}
	if removed != 1 {
		return nil, nil, fmt.Errorf("inventory item UID %d was not found", itemUID)
	}
	return updated, affectedAvatarIDs, nil
}

func deleteAllInventoryItemsSave(serverDir string, playerUID uint32) (string, int, int, []uint32, error) {
	if playerUID == 0 {
		return "", 0, 0, nil, errors.New("player UID must be greater than zero")
	}
	savePath := savePlayerPath(serverDir, playerUID)
	data, err := os.ReadFile(savePath)
	if err != nil {
		return "", 0, 0, nil, fmt.Errorf("could not read Remielle account save %s: %w", savePath, err)
	}
	inventory, err := parseSaveInventory(data)
	if err != nil {
		return "", 0, 0, nil, fmt.Errorf("could not read account inventory: %w", err)
	}
	weaponUIDs := make(map[uint64]bool, len(inventory.Weapons))
	for _, item := range inventory.Weapons {
		weaponUIDs[uint64(item.UID)] = true
	}
	diskUIDs := make(map[uint64]bool, len(inventory.Disks))
	for _, item := range inventory.Disks {
		diskUIDs[uint64(item.UID)] = true
	}
	if len(weaponUIDs)+len(diskUIDs) == 0 {
		return "", 0, 0, nil, nil
	}

	updated, affectedWeapons, removedWeapons, err := deleteInventoryItemsFromPlayerSave(data, "weapon", weaponUIDs)
	if err != nil {
		return "", 0, 0, nil, fmt.Errorf("could not delete W-Engines: %w", err)
	}
	updated, affectedDisks, removedDisks, err := deleteInventoryItemsFromPlayerSave(updated, "disk", diskUIDs)
	if err != nil {
		return "", 0, 0, nil, fmt.Errorf("could not delete Drive Discs: %w", err)
	}
	affected := make(map[uint32]bool, len(affectedWeapons)+len(affectedDisks))
	for _, avatarID := range affectedWeapons {
		affected[avatarID] = true
	}
	for _, avatarID := range affectedDisks {
		affected[avatarID] = true
	}
	affectedAvatarIDs := make([]uint32, 0, len(affected))
	for avatarID := range affected {
		affectedAvatarIDs = append(affectedAvatarIDs, avatarID)
	}
	backupPath, err := writePlayerSaveUpdate(savePath, data, updated)
	if err != nil {
		return "", 0, 0, nil, err
	}
	return backupPath, removedDisks, removedWeapons, affectedAvatarIDs, nil
}

func deleteInventoryItemsFromPlayerSave(
	playerSave []byte,
	itemType string,
	itemUIDs map[uint64]bool,
) ([]byte, []uint32, int, error) {
	if len(itemUIDs) == 0 {
		return playerSave, nil, 0, nil
	}
	var inventoryRootField, itemField, uidField, avatarUIDField uint64
	switch itemType {
	case "weapon":
		inventoryRootField = playerSaveWeaponField
		itemField = 1
		uidField = 1
		avatarUIDField = avatarSaveWeaponUIDField
	case "disk":
		inventoryRootField = playerSaveEquipField
		itemField = equipSaveItemField
		uidField = 1
		avatarUIDField = avatarEquipmentField
	default:
		return nil, nil, 0, fmt.Errorf("unsupported inventory item type %q", itemType)
	}

	rootFields, err := parseProtobufFields(playerSave)
	if err != nil {
		return nil, nil, 0, err
	}
	inventoryIndex, err := uniqueLengthDelimitedFieldIndex(rootFields, inventoryRootField)
	if err != nil {
		return nil, nil, 0, err
	}
	if inventoryIndex < 0 {
		return nil, nil, 0, fmt.Errorf("%s inventory does not exist", itemType)
	}
	for itemUID := range itemUIDs {
		if _, err := findInventoryItem(playerSave, rootFields[inventoryIndex], itemField, uidField, itemUID); err != nil {
			return nil, nil, 0, err
		}
	}

	avatarIndex, err := uniqueLengthDelimitedFieldIndex(rootFields, playerSaveAvatarField)
	if err != nil {
		return nil, nil, 0, err
	}
	updated := playerSave
	affectedAvatarIDs := make([]uint32, 0)
	avatarUIDValues := make(map[uint64]bool, len(itemUIDs))
	for itemUID := range itemUIDs {
		avatarUIDValue := itemUID
		if itemType == "disk" {
			avatarUIDValue += equipmentUIDBase
		}
		avatarUIDValues[avatarUIDValue] = true
	}
	if avatarIndex >= 0 {
		avatarSaveField := rootFields[avatarIndex]
		avatarSave := playerSave[avatarSaveField.payloadFrom:avatarSaveField.payloadTo]
		avatarFields, err := parseProtobufFields(avatarSave)
		if err != nil {
			return nil, nil, 0, fmt.Errorf("invalid character save: %w", err)
		}
		updatedAvatarSave := make([]byte, 0, len(avatarSave))
		avatarSaveChanged := false
		for _, field := range avatarFields {
			if field.number != avatarSaveItemField {
				updatedAvatarSave = append(updatedAvatarSave, avatarSave[field.start:field.end]...)
				continue
			}
			if field.wireType != 2 {
				return nil, nil, 0, errors.New("account save has an invalid character entry")
			}
			avatarItem := avatarSave[field.payloadFrom:field.payloadTo]
			itemFields, err := parseProtobufFields(avatarItem)
			if err != nil {
				return nil, nil, 0, fmt.Errorf("invalid character entry: %w", err)
			}
			var avatarID uint64
			hasAvatarID, hasRemovedEquipment := false, false
			updatedAvatarItem := make([]byte, 0, len(avatarItem))
			for _, itemField := range itemFields {
				if itemField.number == avatarItemIDField {
					if itemField.wireType != 0 || hasAvatarID || itemField.value == 0 {
						return nil, nil, 0, errors.New("character entry has an invalid or duplicate ID")
					}
					avatarID, hasAvatarID = itemField.value, true
				}
				if itemField.number == avatarUIDField {
					if itemField.wireType != 0 {
						return nil, nil, 0, errors.New("character entry has an invalid equipment UID")
					}
					if avatarUIDValues[itemField.value] {
						hasRemovedEquipment = true
						continue
					}
				}
				updatedAvatarItem = append(updatedAvatarItem, avatarItem[itemField.start:itemField.end]...)
			}
			if !hasAvatarID {
				return nil, nil, 0, errors.New("character entry has no valid ID")
			}
			if hasRemovedEquipment {
				avatarSaveChanged = true
				affectedAvatarIDs = append(affectedAvatarIDs, uint32(avatarID))
				updatedAvatarSave = appendLengthDelimitedField(updatedAvatarSave, avatarSaveItemField, updatedAvatarItem)
			} else {
				updatedAvatarSave = append(updatedAvatarSave, avatarSave[field.start:field.end]...)
			}
		}
		if avatarSaveChanged {
			updated, err = replaceLengthDelimitedField(playerSave, avatarIndex, updatedAvatarSave)
			if err != nil {
				return nil, nil, 0, err
			}
		}
	}

	updatedRootFields, err := parseProtobufFields(updated)
	if err != nil {
		return nil, nil, 0, err
	}
	updatedInventoryIndex, err := uniqueLengthDelimitedFieldIndex(updatedRootFields, inventoryRootField)
	if err != nil {
		return nil, nil, 0, err
	}
	if updatedInventoryIndex < 0 {
		return nil, nil, 0, fmt.Errorf("%s inventory does not exist", itemType)
	}
	updated, removed, err := removeInventoryItems(
		updated, inventoryRootField, itemField, uidField, itemUIDs,
	)
	if err != nil {
		return nil, nil, 0, err
	}
	if removed != len(itemUIDs) {
		return nil, nil, 0, fmt.Errorf("removed %d of %d requested %s items", removed, len(itemUIDs), itemType)
	}
	return updated, affectedAvatarIDs, removed, nil
}

func findInventoryItem(
	playerSave []byte,
	inventoryField protobufField,
	itemField, uidField, targetUID uint64,
) ([]byte, error) {
	inventory := playerSave[inventoryField.payloadFrom:inventoryField.payloadTo]
	fields, err := parseProtobufFields(inventory)
	if err != nil {
		return nil, fmt.Errorf("invalid inventory save: %w", err)
	}
	for _, field := range fields {
		if field.number != itemField {
			continue
		}
		if field.wireType != 2 {
			return nil, errors.New("inventory contains an invalid item")
		}
		item := inventory[field.payloadFrom:field.payloadTo]
		uid, err := readInventoryItemUID(item, uidField)
		if err != nil {
			return nil, err
		}
		if uid == targetUID {
			return item, nil
		}
	}
	return nil, fmt.Errorf("inventory item UID %d was not found", targetUID)
}

func deleteCharacterSave(serverDir string, playerUID, avatarID uint32) (string, int, int, error) {
	if playerUID == 0 || avatarID == 0 {
		return "", 0, 0, errors.New("player UID and character ID must be greater than zero")
	}

	savePath := savePlayerPath(serverDir, playerUID)
	data, err := os.ReadFile(savePath)
	if err != nil {
		return "", 0, 0, fmt.Errorf("could not read Remielle account save %s: %w", savePath, err)
	}
	updated, removedDisks, removedWeapons, err := deleteCharacterFromPlayerSave(data, avatarID)
	if err != nil {
		return "", 0, 0, fmt.Errorf("could not remove character from account save: %w", err)
	}
	backupPath, err := writePlayerSaveUpdate(savePath, data, updated)
	if err != nil {
		return "", 0, 0, err
	}
	return backupPath, removedDisks, removedWeapons, nil
}

func deleteAllCharactersSave(serverDir string, playerUID, keepAvatarID uint32) (string, int, int, int, error) {
	if playerUID == 0 || keepAvatarID == 0 {
		return "", 0, 0, 0, errors.New("player UID and character ID to keep must be greater than zero")
	}
	savePath := savePlayerPath(serverDir, playerUID)
	data, err := os.ReadFile(savePath)
	if err != nil {
		return "", 0, 0, 0, fmt.Errorf("could not read Remielle account save %s: %w", savePath, err)
	}
	rootFields, err := parseProtobufFields(data)
	if err != nil {
		return "", 0, 0, 0, err
	}
	avatarSaveIndex, err := uniqueLengthDelimitedFieldIndex(rootFields, playerSaveAvatarField)
	if err != nil {
		return "", 0, 0, 0, err
	}
	if avatarSaveIndex < 0 {
		return "", 0, 0, 0, errors.New("account save has no character data")
	}
	avatarSaveField := rootFields[avatarSaveIndex]
	avatarSave := data[avatarSaveField.payloadFrom:avatarSaveField.payloadTo]
	avatarFields, err := parseProtobufFields(avatarSave)
	if err != nil {
		return "", 0, 0, 0, fmt.Errorf("invalid character save: %w", err)
	}
	avatarIDs := make([]uint32, 0, len(avatarFields))
	keepFound := false
	for _, field := range avatarFields {
		if field.number != avatarSaveItemField {
			continue
		}
		if field.wireType != 2 {
			return "", 0, 0, 0, errors.New("account save has an invalid character entry")
		}
		avatar := avatarSave[field.payloadFrom:field.payloadTo]
		avatarID, _, _, err := readAvatarSaveEquipment(avatar)
		if err != nil {
			return "", 0, 0, 0, err
		}
		if avatarID > uint64(^uint32(0)) {
			return "", 0, 0, 0, errors.New("account save contains a character ID outside the supported range")
		}
		if uint32(avatarID) == keepAvatarID {
			if keepFound {
				return "", 0, 0, 0, fmt.Errorf("character %d appears more than once in the account save", keepAvatarID)
			}
			keepFound = true
		}
		avatarIDs = append(avatarIDs, uint32(avatarID))
	}
	if !keepFound {
		return "", 0, 0, 0, fmt.Errorf("character %d could not be found in the account save", keepAvatarID)
	}
	if len(avatarIDs) == 1 {
		return "", 0, 0, 0, nil
	}

	updated := data
	removedDisks, removedWeapons, removedCharacters := 0, 0, 0
	for _, avatarID := range avatarIDs {
		if avatarID == keepAvatarID {
			continue
		}
		var disks, weapons int
		updated, disks, weapons, err = deleteCharacterFromPlayerSave(updated, avatarID)
		if err != nil {
			return "", 0, 0, 0, fmt.Errorf("could not delete character %d: %w", avatarID, err)
		}
		removedDisks += disks
		removedWeapons += weapons
		removedCharacters++
	}
	backupPath, err := writePlayerSaveUpdate(savePath, data, updated)
	if err != nil {
		return "", 0, 0, 0, err
	}
	return backupPath, removedCharacters, removedDisks, removedWeapons, nil
}

func deleteCharacterFromPlayerSave(playerSave []byte, avatarID uint32) ([]byte, int, int, error) {
	if avatarID == 0 {
		return nil, 0, 0, errors.New("character ID must be greater than zero")
	}

	rootFields, err := parseProtobufFields(playerSave)
	if err != nil {
		return nil, 0, 0, err
	}
	avatarSaveIndex, err := uniqueLengthDelimitedFieldIndex(rootFields, playerSaveAvatarField)
	if err != nil {
		return nil, 0, 0, err
	}
	if avatarSaveIndex < 0 {
		return nil, 0, 0, errors.New("account save has no character data")
	}

	avatarSaveField := rootFields[avatarSaveIndex]
	avatarSave := playerSave[avatarSaveField.payloadFrom:avatarSaveField.payloadTo]
	avatarFields, err := parseProtobufFields(avatarSave)
	if err != nil {
		return nil, 0, 0, fmt.Errorf("invalid character save: %w", err)
	}

	var targetWeaponUID uint64
	var targetDiskUIDs []uint64
	var fallbackAvatarID uint64
	sharedWeaponUIDs := make(map[uint64]bool)
	sharedDiskUIDs := make(map[uint64]bool)
	targetFound := false
	var updatedAvatarSave []byte
	for _, field := range avatarFields {
		if field.number != avatarSaveItemField {
			updatedAvatarSave = append(updatedAvatarSave, avatarSave[field.start:field.end]...)
			continue
		}
		if field.wireType != 2 {
			return nil, 0, 0, errors.New("account save has an invalid character entry")
		}
		item := avatarSave[field.payloadFrom:field.payloadTo]
		itemID, weaponUID, diskUIDs, parseErr := readAvatarSaveEquipment(item)
		if parseErr != nil {
			return nil, 0, 0, parseErr
		}
		if itemID == uint64(avatarID) {
			if targetFound {
				return nil, 0, 0, fmt.Errorf("character %d appears more than once in the account save", avatarID)
			}
			targetFound = true
			targetWeaponUID = weaponUID
			targetDiskUIDs = diskUIDs
			continue
		}
		if fallbackAvatarID == 0 {
			fallbackAvatarID = itemID
		}
		if weaponUID != 0 {
			sharedWeaponUIDs[weaponUID] = true
		}
		for _, uid := range diskUIDs {
			sharedDiskUIDs[diskInventoryUID(uid)] = true
		}
		updatedAvatarSave = append(updatedAvatarSave, avatarSave[field.start:field.end]...)
	}
	if !targetFound {
		return nil, 0, 0, fmt.Errorf("character %d could not be found in the account save", avatarID)
	}
	if fallbackAvatarID == 0 {
		return nil, 0, 0, errors.New("cannot delete the only character in the account save")
	}

	updated, err := replaceLengthDelimitedField(playerSave, avatarSaveIndex, updatedAvatarSave)
	if err != nil {
		return nil, 0, 0, err
	}
	updated, err = updateBasicSaveAvatarReferences(updated, uint64(avatarID), fallbackAvatarID)
	if err != nil {
		return nil, 0, 0, err
	}
	updated, err = removeCharacterFromQuickTeams(updated, uint64(avatarID))
	if err != nil {
		return nil, 0, 0, err
	}

	weaponUIDsToRemove := make(map[uint64]bool)
	if targetWeaponUID != 0 && !sharedWeaponUIDs[targetWeaponUID] {
		weaponUIDsToRemove[targetWeaponUID] = true
	}
	diskUIDsToRemove := make(map[uint64]bool)
	for _, uid := range targetDiskUIDs {
		inventoryUID := diskInventoryUID(uid)
		if inventoryUID != 0 && !sharedDiskUIDs[inventoryUID] {
			diskUIDsToRemove[inventoryUID] = true
		}
	}
	updated, removedWeapons, err := removeInventoryItems(
		updated, playerSaveWeaponField, 1, 1, weaponUIDsToRemove,
	)
	if err != nil {
		return nil, 0, 0, fmt.Errorf("could not remove equipped W-Engine: %w", err)
	}
	updated, removedDisks, err := removeInventoryItems(
		updated, playerSaveEquipField, equipSaveItemField, 1, diskUIDsToRemove,
	)
	if err != nil {
		return nil, 0, 0, fmt.Errorf("could not remove equipped Drive Discs: %w", err)
	}
	return updated, removedDisks, removedWeapons, nil
}

func diskInventoryUID(equipmentUID uint64) uint64 {
	if equipmentUID >= equipmentUIDBase {
		return equipmentUID - equipmentUIDBase
	}
	return equipmentUID
}

func readAvatarSaveEquipment(item []byte) (uint64, uint64, []uint64, error) {
	fields, err := parseProtobufFields(item)
	if err != nil {
		return 0, 0, nil, fmt.Errorf("invalid character entry: %w", err)
	}
	var avatarID, weaponUID uint64
	var hasAvatarID, hasWeaponUID bool
	var diskUIDs []uint64
	for _, field := range fields {
		switch field.number {
		case avatarItemIDField:
			if field.wireType != 0 || hasAvatarID {
				return 0, 0, nil, errors.New("character entry has an invalid or duplicate ID")
			}
			avatarID, hasAvatarID = field.value, true
		case avatarWeaponUIDField:
			if field.wireType != 0 || hasWeaponUID {
				return 0, 0, nil, errors.New("character entry has an invalid or duplicate W-Engine UID")
			}
			weaponUID, hasWeaponUID = field.value, true
		case avatarEquipmentField:
			if field.wireType != 0 {
				return 0, 0, nil, errors.New("character entry has an invalid Drive Disc UID")
			}
			diskUIDs = append(diskUIDs, field.value)
		}
	}
	if !hasAvatarID || avatarID == 0 {
		return 0, 0, nil, errors.New("character entry has no valid ID")
	}
	return avatarID, weaponUID, diskUIDs, nil
}

func removeInventoryItems(
	playerSave []byte,
	rootFieldNumber, itemFieldNumber, uidFieldNumber uint64,
	removedUIDs map[uint64]bool,
) ([]byte, int, error) {
	if len(removedUIDs) == 0 {
		return playerSave, 0, nil
	}
	rootFields, err := parseProtobufFields(playerSave)
	if err != nil {
		return nil, 0, err
	}
	rootIndex, err := uniqueLengthDelimitedFieldIndex(rootFields, rootFieldNumber)
	if err != nil || rootIndex < 0 {
		return playerSave, 0, err
	}
	inventoryField := rootFields[rootIndex]
	inventory := playerSave[inventoryField.payloadFrom:inventoryField.payloadTo]
	items, err := parseProtobufFields(inventory)
	if err != nil {
		return nil, 0, fmt.Errorf("invalid inventory save: %w", err)
	}

	removed := 0
	var updatedInventory []byte
	for _, itemField := range items {
		if itemField.number != itemFieldNumber {
			updatedInventory = append(updatedInventory, inventory[itemField.start:itemField.end]...)
			continue
		}
		if itemField.wireType != 2 {
			return nil, 0, errors.New("inventory contains an invalid item")
		}
		item := inventory[itemField.payloadFrom:itemField.payloadTo]
		uid, err := readInventoryItemUID(item, uidFieldNumber)
		if err != nil {
			return nil, 0, err
		}
		if removedUIDs[uid] {
			removed++
			continue
		}
		updatedInventory = append(updatedInventory, inventory[itemField.start:itemField.end]...)
	}
	if removed == 0 {
		return playerSave, 0, nil
	}
	updated, err := replaceLengthDelimitedField(playerSave, rootIndex, updatedInventory)
	if err != nil {
		return nil, 0, err
	}
	return updated, removed, nil
}

func readInventoryItemUID(item []byte, uidFieldNumber uint64) (uint64, error) {
	fields, err := parseProtobufFields(item)
	if err != nil {
		return 0, fmt.Errorf("invalid inventory item: %w", err)
	}
	var uid uint64
	found := false
	for _, field := range fields {
		if field.number != uidFieldNumber {
			continue
		}
		if field.wireType != 0 || found {
			return 0, errors.New("inventory item has an invalid or duplicate UID")
		}
		uid, found = field.value, true
	}
	if !found {
		return 0, errors.New("inventory item has no UID")
	}
	return uid, nil
}

func updateBasicSaveAvatarReferences(playerSave []byte, deletedAvatarID, fallbackAvatarID uint64) ([]byte, error) {
	rootFields, err := parseProtobufFields(playerSave)
	if err != nil {
		return nil, err
	}
	basicIndex, err := uniqueLengthDelimitedFieldIndex(rootFields, playerSaveBasicField)
	if err != nil || basicIndex < 0 {
		return playerSave, err
	}
	basicField := rootFields[basicIndex]
	basicSave := playerSave[basicField.payloadFrom:basicField.payloadTo]
	fields, err := parseProtobufFields(basicSave)
	if err != nil {
		return nil, fmt.Errorf("invalid basic save: %w", err)
	}
	var updatedBasic []byte
	changed := false
	for _, field := range fields {
		if (field.number == 2 || field.number == 3) && field.wireType == 0 && field.value == deletedAvatarID {
			updatedBasic = appendVarintField(updatedBasic, field.number, fallbackAvatarID)
			changed = true
			continue
		}
		updatedBasic = append(updatedBasic, basicSave[field.start:field.end]...)
	}
	if !changed {
		return playerSave, nil
	}
	return replaceLengthDelimitedField(playerSave, basicIndex, updatedBasic)
}

func removeCharacterFromQuickTeams(playerSave []byte, avatarID uint64) ([]byte, error) {
	rootFields, err := parseProtobufFields(playerSave)
	if err != nil {
		return nil, err
	}
	quickTeamIndex, err := uniqueLengthDelimitedFieldIndex(rootFields, playerSaveQuickTeamField)
	if err != nil || quickTeamIndex < 0 {
		return playerSave, err
	}
	quickTeamField := rootFields[quickTeamIndex]
	quickTeamSave := playerSave[quickTeamField.payloadFrom:quickTeamField.payloadTo]
	teamFields, err := parseProtobufFields(quickTeamSave)
	if err != nil {
		return nil, fmt.Errorf("invalid quick team save: %w", err)
	}
	var updatedQuickTeams []byte
	changed := false
	for _, teamField := range teamFields {
		if teamField.number != quickTeamItemField {
			updatedQuickTeams = append(updatedQuickTeams, quickTeamSave[teamField.start:teamField.end]...)
			continue
		}
		if teamField.wireType != 2 {
			return nil, errors.New("quick team save has an invalid team entry")
		}
		team := quickTeamSave[teamField.payloadFrom:teamField.payloadTo]
		updatedTeam, teamChanged, err := removeAvatarIDFromQuickTeam(team, avatarID)
		if err != nil {
			return nil, err
		}
		if teamChanged {
			changed = true
			updatedQuickTeams = appendLengthDelimitedField(updatedQuickTeams, quickTeamItemField, updatedTeam)
		} else {
			updatedQuickTeams = append(updatedQuickTeams, quickTeamSave[teamField.start:teamField.end]...)
		}
	}
	if !changed {
		return playerSave, nil
	}
	return replaceLengthDelimitedField(playerSave, quickTeamIndex, updatedQuickTeams)
}

func removeAvatarIDFromQuickTeam(team []byte, avatarID uint64) ([]byte, bool, error) {
	fields, err := parseProtobufFields(team)
	if err != nil {
		return nil, false, fmt.Errorf("invalid quick team entry: %w", err)
	}
	var updated []byte
	changed := false
	for _, field := range fields {
		if field.number != quickTeamAvatarIDField {
			updated = append(updated, team[field.start:field.end]...)
			continue
		}
		switch field.wireType {
		case 0:
			if field.value == avatarID {
				changed = true
				continue
			}
			updated = append(updated, team[field.start:field.end]...)
		case 2:
			values, err := readPackedVarints(team[field.payloadFrom:field.payloadTo])
			if err != nil {
				return nil, false, fmt.Errorf("invalid packed quick team character IDs: %w", err)
			}
			remaining := make([]uint64, 0, len(values))
			for _, value := range values {
				if value == avatarID {
					changed = true
					continue
				}
				remaining = append(remaining, value)
			}
			if len(remaining) > 0 {
				var packed []byte
				for _, value := range remaining {
					packed = appendProtobufVarint(packed, value)
				}
				updated = appendLengthDelimitedField(updated, quickTeamAvatarIDField, packed)
			}
		default:
			return nil, false, errors.New("quick team entry has an invalid character ID")
		}
	}
	return updated, changed, nil
}

func readPackedVarints(data []byte) ([]uint64, error) {
	values := make([]uint64, 0)
	for offset := 0; offset < len(data); {
		value, err := readProtobufVarint(data, &offset)
		if err != nil {
			return nil, err
		}
		values = append(values, value)
	}
	return values, nil
}

func uniqueLengthDelimitedFieldIndex(fields []protobufField, number uint64) (int, error) {
	index := -1
	for fieldIndex, field := range fields {
		if field.number != number {
			continue
		}
		if field.wireType != 2 {
			return -1, fmt.Errorf("protobuf field %d has an invalid wire type", number)
		}
		if index >= 0 {
			return -1, fmt.Errorf("protobuf field %d appears more than once", number)
		}
		index = fieldIndex
	}
	return index, nil
}
