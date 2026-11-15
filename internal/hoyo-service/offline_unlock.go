package hoyoService

import (
	"encoding/binary"
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

const (
	playerSaveAvatarField = 2
	playerSaveEquipField  = 4
	avatarSaveItemField   = 1
	avatarItemIDField     = 1
	avatarEquipmentField  = 11
	equipSaveItemField    = 1
	equipmentUIDBase      = 0x020000
)

type protobufField struct {
	number      uint64
	wireType    uint64
	start       int
	end         int
	payloadFrom int
	payloadTo   int
	value       uint64
}

func unlockCharacterSave(serverDir string, playerUID, avatarID uint32) (string, bool, error) {
	if playerUID == 0 {
		return "", false, errors.New("player UID must be greater than zero")
	}
	if avatarID == 0 {
		return "", false, errors.New("character ID must be greater than zero")
	}

	savePath := savePlayerPath(serverDir, playerUID)
	data, err := os.ReadFile(savePath)
	if err != nil {
		return "", false, fmt.Errorf("could not read Remielle account save %s: %w", savePath, err)
	}

	updated, added, err := appendAvatarToPlayerSave(data, avatarID)
	if err != nil {
		return "", false, fmt.Errorf("could not update Remielle account save: %w", err)
	}
	if !added {
		return "", false, nil
	}

	backupPath, err := writePlayerSaveUpdate(savePath, data, updated)
	if err != nil {
		return "", false, err
	}
	return backupPath, true, nil
}

func updateWeaponSave(
	serverDir string,
	playerUID, avatarID, weaponID, level, refinement uint32,
) (string, uint32, error) {
	if playerUID == 0 {
		return "", 0, errors.New("player UID must be greater than zero")
	}
	if avatarID != 0 && !containsID(characterIDs, avatarID) {
		return "", 0, fmt.Errorf("unknown character ID %d", avatarID)
	}
	packet, err := buildCreateWeaponPacket(playerUID, weaponID, level, refinement, 1)
	if err != nil {
		return "", 0, err
	}

	savePath := savePlayerPath(serverDir, playerUID)
	data, err := os.ReadFile(savePath)
	if err != nil {
		return "", 0, fmt.Errorf("could not read Remielle account save %s: %w", savePath, err)
	}

	updated := data
	if avatarID != 0 {
		updated, _, err = appendAvatarToPlayerSave(updated, avatarID)
		if err != nil {
			return "", 0, fmt.Errorf("could not prepare character save: %w", err)
		}
	}
	updated, weaponUID, err := appendWeaponToPlayerSave(updated, packet)
	if err != nil {
		return "", 0, fmt.Errorf("could not add W-Engine to the account save: %w", err)
	}
	if avatarID != 0 {
		updated, err = equipWeaponToAvatar(updated, avatarID, weaponUID)
		if err != nil {
			return "", 0, fmt.Errorf("could not equip W-Engine: %w", err)
		}
	}
	backupPath, err := writePlayerSaveUpdate(savePath, data, updated)
	if err != nil {
		return "", 0, err
	}
	return backupPath, weaponUID, nil
}

func equipAgentBuildSave(
	serverDir string,
	playerUID, avatarID uint32,
	disks []diskLoadoutItem,
	weaponID, level, refinement uint32,
) (string, uint32, error) {
	if playerUID == 0 || avatarID == 0 {
		return "", 0, errors.New("player UID and character ID must be greater than zero")
	}
	if !containsID(characterIDs, avatarID) {
		return "", 0, fmt.Errorf("unknown character ID %d", avatarID)
	}
	if len(disks) == 0 || len(disks) > 6 {
		return "", 0, errors.New("a Drive Disc loadout must contain between 1 and 6 discs")
	}
	packet, err := buildCreateWeaponPacket(playerUID, weaponID, level, refinement, 1)
	if err != nil {
		return "", 0, err
	}

	savePath := savePlayerPath(serverDir, playerUID)
	data, err := os.ReadFile(savePath)
	if err != nil {
		return "", 0, fmt.Errorf("could not read Remielle account save %s: %w", savePath, err)
	}
	updated, _, err := appendAvatarToPlayerSave(data, avatarID)
	if err != nil {
		return "", 0, fmt.Errorf("could not prepare character save: %w", err)
	}
	updated, err = appendAndEquipDisks(updated, avatarID, disks)
	if err != nil {
		return "", 0, fmt.Errorf("could not equip Drive Discs: %w", err)
	}
	updated, weaponUID, err := appendWeaponToPlayerSave(updated, packet)
	if err != nil {
		return "", 0, fmt.Errorf("could not add W-Engine to the account save: %w", err)
	}
	updated, err = equipWeaponToAvatar(updated, avatarID, weaponUID)
	if err != nil {
		return "", 0, fmt.Errorf("could not equip W-Engine: %w", err)
	}
	backupPath, err := writePlayerSaveUpdate(savePath, data, updated)
	if err != nil {
		return "", 0, err
	}
	return backupPath, weaponUID, nil
}

func appendWeaponToPlayerSave(playerSave, packet []byte) ([]byte, uint32, error) {
	rootFields, err := parseProtobufFields(playerSave)
	if err != nil {
		return nil, 0, fmt.Errorf("invalid player save: %w", err)
	}
	weaponSaveIndex, err := uniqueLengthDelimitedFieldIndex(rootFields, playerSaveWeaponField)
	if err != nil {
		return nil, 0, err
	}

	var weaponSave []byte
	usedUIDs := make(map[uint64]bool)
	if weaponSaveIndex >= 0 {
		field := rootFields[weaponSaveIndex]
		weaponSave = append([]byte(nil), playerSave[field.payloadFrom:field.payloadTo]...)
		items, err := parseProtobufFields(weaponSave)
		if err != nil {
			return nil, 0, fmt.Errorf("invalid W-Engine inventory: %w", err)
		}
		for _, itemField := range items {
			if itemField.number != 1 {
				continue
			}
			if itemField.wireType != 2 {
				return nil, 0, errors.New("W-Engine inventory contains an invalid item")
			}
			item, err := parseSaveWeaponItem(weaponSave[itemField.payloadFrom:itemField.payloadTo], nil)
			if err != nil {
				return nil, 0, err
			}
			usedUIDs[uint64(item.UID)] = true
		}
	}
	nextUID, ok := firstAvailableInventoryUID(usedUIDs)
	if !ok {
		return nil, 0, errors.New("account has reached the maximum W-Engine UID")
	}

	metadata := binary.LittleEndian.Uint16(packet[18:20])
	weapon := appendVarintField(nil, 1, nextUID)
	weapon = appendVarintField(weapon, 2, uint64(binary.LittleEndian.Uint16(packet[16:18])))
	weapon = appendVarintField(weapon, 3, uint64(metadata&0x3f))
	weapon = appendVarintField(weapon, 4, uint64(metadata>>6&0x07))
	weapon = appendVarintField(weapon, 5, uint64(metadata>>9&0x07))
	weaponSave = appendLengthDelimitedField(weaponSave, 1, weapon)

	var updated []byte
	if weaponSaveIndex < 0 {
		updated = appendLengthDelimitedField(playerSave, playerSaveWeaponField, weaponSave)
	} else {
		updated, err = replaceLengthDelimitedField(playerSave, weaponSaveIndex, weaponSave)
		if err != nil {
			return nil, 0, err
		}
	}
	return updated, uint32(nextUID), nil
}

func equipWeaponToAvatar(playerSave []byte, avatarID, weaponUID uint32) ([]byte, error) {
	if uint64(weaponUID) > uint64(^uint16(0)) {
		return nil, errors.New("W-Engine UID is outside the supported range")
	}
	rootFields, err := parseProtobufFields(playerSave)
	if err != nil {
		return nil, fmt.Errorf("invalid player save: %w", err)
	}
	avatarSaveIndex, err := uniqueLengthDelimitedFieldIndex(rootFields, playerSaveAvatarField)
	if err != nil {
		return nil, err
	}
	if avatarSaveIndex < 0 {
		return nil, errors.New("player save has no character data")
	}

	avatarField := rootFields[avatarSaveIndex]
	avatarSave := playerSave[avatarField.payloadFrom:avatarField.payloadTo]
	avatarFields, err := parseProtobufFields(avatarSave)
	if err != nil {
		return nil, fmt.Errorf("invalid character save: %w", err)
	}
	avatarItemIndex := -1
	for index, itemField := range avatarFields {
		if itemField.number != avatarSaveItemField {
			continue
		}
		if itemField.wireType != 2 {
			return nil, errors.New("account save has an invalid character entry")
		}
		item := avatarSave[itemField.payloadFrom:itemField.payloadTo]
		id, _, _, err := readAvatarSaveEquipment(item)
		if err != nil {
			return nil, err
		}
		if id == uint64(avatarID) {
			if avatarItemIndex >= 0 {
				return nil, fmt.Errorf("character %d appears more than once in the account save", avatarID)
			}
			avatarItemIndex = index
		}
	}
	if avatarItemIndex < 0 {
		return nil, fmt.Errorf("character %d could not be found in the account save", avatarID)
	}

	avatarItemField := avatarFields[avatarItemIndex]
	avatarItem := avatarSave[avatarItemField.payloadFrom:avatarItemField.payloadTo]
	itemFields, err := parseProtobufFields(avatarItem)
	if err != nil {
		return nil, fmt.Errorf("invalid character entry: %w", err)
	}
	var updatedAvatarItem []byte
	for _, field := range itemFields {
		if field.number == avatarWeaponUIDField {
			continue
		}
		updatedAvatarItem = append(updatedAvatarItem, avatarItem[field.start:field.end]...)
	}
	updatedAvatarItem = appendVarintField(updatedAvatarItem, avatarWeaponUIDField, weaponUIDBase+uint64(weaponUID))

	updatedAvatarSave, err := replaceLengthDelimitedField(avatarSave, avatarItemIndex, updatedAvatarItem)
	if err != nil {
		return nil, err
	}
	return replaceLengthDelimitedField(playerSave, avatarSaveIndex, updatedAvatarSave)
}

func firstAvailableInventoryUID(usedUIDs map[uint64]bool) (uint64, bool) {
	for uid := uint64(0); uid <= uint64(^uint16(0)); uid++ {
		if !usedUIDs[uid] {
			return uid, true
		}
	}
	return 0, false
}

type SaveInventory struct {
	Characters []uint32            `json:"characters"`
	Weapons    []SaveInventoryItem `json:"weapons"`
	Disks      []SaveInventoryItem `json:"disks"`
}

type SaveInventoryItem struct {
	UID                uint32   `json:"uid"`
	ID                 uint32   `json:"id"`
	Level              uint32   `json:"level"`
	Rank               uint32   `json:"rank"`
	Refinement         uint32   `json:"refinement,omitempty"`
	Slot               uint32   `json:"slot,omitempty"`
	SetID              uint32   `json:"setId,omitempty"`
	EquippedToAgentIDs []uint32 `json:"equippedToAgentIds,omitempty"`
}

func readSaveInventory(serverDir string, playerUID uint32) (SaveInventory, error) {
	if playerUID == 0 {
		return SaveInventory{}, errors.New("player UID must be greater than zero")
	}
	savePath := savePlayerPath(serverDir, playerUID)
	data, err := os.ReadFile(savePath)
	if err != nil {
		return SaveInventory{}, fmt.Errorf("could not read Remielle account save %s: %w", savePath, err)
	}
	return parseSaveInventory(data)
}

func parseSaveInventory(playerSave []byte) (SaveInventory, error) {
	inventory := SaveInventory{
		Characters: make([]uint32, 0),
		Weapons:    make([]SaveInventoryItem, 0),
		Disks:      make([]SaveInventoryItem, 0),
	}
	rootFields, err := parseProtobufFields(playerSave)
	if err != nil {
		return inventory, fmt.Errorf("invalid player save: %w", err)
	}

	equippedWeaponByUID := make(map[uint64][]uint32)
	equippedDiskByUID := make(map[uint64][]uint32)
	avatarSaveIndex, err := uniqueLengthDelimitedFieldIndex(rootFields, playerSaveAvatarField)
	if err != nil {
		return inventory, err
	}
	if avatarSaveIndex >= 0 {
		avatarField := rootFields[avatarSaveIndex]
		avatarSave := playerSave[avatarField.payloadFrom:avatarField.payloadTo]
		avatarFields, err := parseProtobufFields(avatarSave)
		if err != nil {
			return inventory, fmt.Errorf("invalid character save: %w", err)
		}
		for _, avatarField := range avatarFields {
			if avatarField.number != avatarSaveItemField {
				continue
			}
			if avatarField.wireType != 2 {
				return inventory, errors.New("account save has an invalid character entry")
			}
			avatar := avatarSave[avatarField.payloadFrom:avatarField.payloadTo]
			avatarID, weaponUID, diskUIDs, err := readAvatarSaveEquipment(avatar)
			if err != nil {
				return inventory, err
			}
			inventory.Characters = append(inventory.Characters, uint32(avatarID))
			if inventoryUID, ok := weaponInventoryUID(weaponUID); ok {
				equippedWeaponByUID[inventoryUID] = append(equippedWeaponByUID[inventoryUID], uint32(avatarID))
			}
			for _, uid := range diskUIDs {
				if uid < equipmentUIDBase {
					continue
				}
				equippedDiskByUID[uid-equipmentUIDBase] = append(
					equippedDiskByUID[uid-equipmentUIDBase], uint32(avatarID),
				)
			}
		}
	}

	weaponSaveIndex, err := uniqueLengthDelimitedFieldIndex(rootFields, playerSaveWeaponField)
	if err != nil {
		return inventory, err
	}
	if weaponSaveIndex >= 0 {
		field := rootFields[weaponSaveIndex]
		items, err := parseProtobufFields(playerSave[field.payloadFrom:field.payloadTo])
		if err != nil {
			return inventory, fmt.Errorf("invalid W-Engine inventory: %w", err)
		}
		weaponInventory := playerSave[field.payloadFrom:field.payloadTo]
		for _, itemField := range items {
			if itemField.number != 1 {
				continue
			}
			if itemField.wireType != 2 {
				return inventory, errors.New("W-Engine inventory contains an invalid item")
			}
			item, err := parseSaveWeaponItem(
				weaponInventory[itemField.payloadFrom:itemField.payloadTo],
				equippedWeaponByUID,
			)
			if err != nil {
				return inventory, err
			}
			inventory.Weapons = append(inventory.Weapons, item)
		}
	}

	equipSaveIndex, err := uniqueLengthDelimitedFieldIndex(rootFields, playerSaveEquipField)
	if err != nil {
		return inventory, err
	}
	if equipSaveIndex >= 0 {
		field := rootFields[equipSaveIndex]
		items, err := parseProtobufFields(playerSave[field.payloadFrom:field.payloadTo])
		if err != nil {
			return inventory, fmt.Errorf("invalid Drive Disc inventory: %w", err)
		}
		diskInventory := playerSave[field.payloadFrom:field.payloadTo]
		for _, itemField := range items {
			if itemField.number != equipSaveItemField {
				continue
			}
			if itemField.wireType != 2 {
				return inventory, errors.New("Drive Disc inventory contains an invalid item")
			}
			item, err := parseSaveDiskItem(
				diskInventory[itemField.payloadFrom:itemField.payloadTo],
				equippedDiskByUID,
			)
			if err != nil {
				return inventory, err
			}
			inventory.Disks = append(inventory.Disks, item)
		}
	}
	return inventory, nil
}

func parseSaveWeaponItem(item []byte, equippedTo map[uint64][]uint32) (SaveInventoryItem, error) {
	fields, err := parseProtobufFields(item)
	if err != nil {
		return SaveInventoryItem{}, fmt.Errorf("invalid W-Engine item: %w", err)
	}
	values, err := readInventoryItemValues(fields, map[uint64]bool{1: true, 2: true, 3: true, 4: true, 5: true})
	if err != nil {
		return SaveInventoryItem{}, err
	}
	for _, field := range []uint64{1, 2, 3, 4, 5} {
		if _, ok := values[field]; !ok {
			return SaveInventoryItem{}, fmt.Errorf("W-Engine item is missing field %d", field)
		}
	}
	return SaveInventoryItem{
		UID:                uint32(values[1]),
		ID:                 uint32(values[2]),
		Level:              uint32(values[3]),
		Rank:               uint32(values[4]),
		Refinement:         uint32(values[5]),
		EquippedToAgentIDs: equippedTo[values[1]],
	}, nil
}

func parseSaveDiskItem(item []byte, equippedTo map[uint64][]uint32) (SaveInventoryItem, error) {
	fields, err := parseProtobufFields(item)
	if err != nil {
		return SaveInventoryItem{}, fmt.Errorf("invalid Drive Disc item: %w", err)
	}
	values, err := readInventoryItemValues(fields, map[uint64]bool{1: true, 2: true, 3: true, 4: true})
	if err != nil {
		return SaveInventoryItem{}, err
	}
	for _, field := range []uint64{1, 2, 3, 4} {
		if _, ok := values[field]; !ok {
			return SaveInventoryItem{}, fmt.Errorf("Drive Disc item is missing field %d", field)
		}
	}
	itemID := values[2]
	rank := itemID % 100 / 10
	slot := itemID % 10
	if rank < 2 || rank > 4 || slot < 1 || slot > 6 {
		return SaveInventoryItem{}, fmt.Errorf("Drive Disc item %d has an invalid rank or slot", itemID)
	}
	return SaveInventoryItem{
		UID:                uint32(values[1]),
		ID:                 uint32(itemID),
		Level:              uint32(values[3]),
		Rank:               uint32(rank),
		Slot:               uint32(slot),
		SetID:              uint32(itemID - rank*10 - slot),
		EquippedToAgentIDs: equippedTo[values[1]],
	}, nil
}

func readInventoryItemValues(fields []protobufField, selected map[uint64]bool) (map[uint64]uint64, error) {
	values := make(map[uint64]uint64, len(selected))
	for _, field := range fields {
		if !selected[field.number] {
			continue
		}
		if field.wireType != 0 {
			return nil, fmt.Errorf("inventory item field %d has an invalid wire type", field.number)
		}
		if _, exists := values[field.number]; exists {
			return nil, fmt.Errorf("inventory item field %d is duplicated", field.number)
		}
		values[field.number] = field.value
	}
	return values, nil
}

func equipDiskSetSave(serverDir string, playerUID, avatarID uint32, disks []diskLoadoutItem) (string, error) {
	if playerUID == 0 || avatarID == 0 {
		return "", errors.New("player UID and character ID must be greater than zero")
	}
	if len(disks) == 0 || len(disks) > 6 {
		return "", errors.New("a Drive Disc loadout must contain between 1 and 6 discs")
	}

	savePath := savePlayerPath(serverDir, playerUID)
	data, err := os.ReadFile(savePath)
	if err != nil {
		return "", fmt.Errorf("could not read Remielle account save %s: %w", savePath, err)
	}
	updated, _, err := appendAvatarToPlayerSave(data, avatarID)
	if err != nil {
		return "", fmt.Errorf("could not prepare character save: %w", err)
	}
	updated, err = appendAndEquipDisks(updated, avatarID, disks)
	if err != nil {
		return "", fmt.Errorf("could not equip Drive Discs: %w", err)
	}
	return writePlayerSaveUpdate(savePath, data, updated)
}

func writePlayerSaveUpdate(savePath string, original, updated []byte) (string, error) {
	backupPath, err := backupPlayerSave(savePath, original)
	if err != nil {
		return "", err
	}

	temp, err := os.CreateTemp(filepath.Dir(savePath), ".player-save-*.tmp")
	if err != nil {
		return "", fmt.Errorf("could not create temporary account save: %w", err)
	}
	tempPath := temp.Name()
	defer os.Remove(tempPath)

	if _, err := temp.Write(updated); err != nil {
		_ = temp.Close()
		return "", fmt.Errorf("could not write updated account save: %w", err)
	}
	if err := temp.Sync(); err != nil {
		_ = temp.Close()
		return "", fmt.Errorf("could not flush updated account save: %w", err)
	}
	if err := temp.Close(); err != nil {
		return "", fmt.Errorf("could not close updated account save: %w", err)
	}
	if err := os.Rename(tempPath, savePath); err != nil {
		return "", fmt.Errorf("could not replace account save; the original is preserved at %s: %w", backupPath, err)
	}
	return backupPath, nil
}

type diskLoadoutItem struct {
	setID      uint32
	rank       uint32
	slot       uint32
	mainStat   uint32
	subStatIDs []uint32
	subRolls   []uint32
}

func appendAndEquipDisks(playerSave []byte, avatarID uint32, disks []diskLoadoutItem) ([]byte, error) {
	rootFields, err := parseProtobufFields(playerSave)
	if err != nil {
		return nil, err
	}

	avatarSaveIndex, equipSaveIndex := -1, -1
	for index, field := range rootFields {
		if field.number == playerSaveAvatarField && field.wireType != 2 ||
			field.number == playerSaveEquipField && field.wireType != 2 {
			return nil, errors.New("player save has invalid avatar or equipment data")
		}
		if field.number == playerSaveAvatarField && avatarSaveIndex >= 0 ||
			field.number == playerSaveEquipField && equipSaveIndex >= 0 {
			return nil, errors.New("player save contains duplicate avatar or equipment data")
		}
		if field.wireType != 2 {
			continue
		}
		switch field.number {
		case playerSaveAvatarField:
			avatarSaveIndex = index
		case playerSaveEquipField:
			equipSaveIndex = index
		}
	}
	if avatarSaveIndex < 0 {
		return nil, errors.New("player save has no avatar data")
	}

	avatarSaveField := rootFields[avatarSaveIndex]
	avatarSave := playerSave[avatarSaveField.payloadFrom:avatarSaveField.payloadTo]
	avatarFields, err := parseProtobufFields(avatarSave)
	if err != nil {
		return nil, err
	}
	avatarItemIndex := -1
	for index, itemField := range avatarFields {
		if itemField.number != avatarSaveItemField || itemField.wireType != 2 {
			continue
		}
		item := avatarSave[itemField.payloadFrom:itemField.payloadTo]
		itemFields, parseErr := parseProtobufFields(item)
		if parseErr != nil {
			return nil, parseErr
		}
		for _, field := range itemFields {
			if field.number == avatarItemIDField && field.wireType == 0 && field.value == uint64(avatarID) {
				avatarItemIndex = index
				break
			}
		}
		if avatarItemIndex >= 0 {
			break
		}
	}
	if avatarItemIndex < 0 {
		return nil, fmt.Errorf("character %d could not be found in the account save", avatarID)
	}

	equipSave := []byte(nil)
	equipFields := []protobufField(nil)
	equipmentUIDs := make([]uint64, 6)
	usedUIDs := make(map[uint64]bool)
	if equipSaveIndex >= 0 {
		equipSaveField := rootFields[equipSaveIndex]
		equipSave = playerSave[equipSaveField.payloadFrom:equipSaveField.payloadTo]
		equipFields, err = parseProtobufFields(equipSave)
		if err != nil {
			return nil, err
		}
		for _, field := range equipFields {
			if field.number != equipSaveItemField {
				continue
			}
			if field.wireType != 2 {
				return nil, errors.New("player save has an invalid equipment item")
			}
			itemFields, parseErr := parseProtobufFields(equipSave[field.payloadFrom:field.payloadTo])
			if parseErr != nil {
				return nil, parseErr
			}
			for _, itemField := range itemFields {
				if itemField.number == 1 && itemField.wireType == 0 {
					usedUIDs[itemField.value] = true
				}
			}
		}
	}

	avatarItemField := avatarFields[avatarItemIndex]
	avatarItem := append([]byte(nil), avatarSave[avatarItemField.payloadFrom:avatarItemField.payloadTo]...)
	itemFields, err := parseProtobufFields(avatarItem)
	if err != nil {
		return nil, err
	}
	for _, field := range itemFields {
		if field.number != avatarEquipmentField {
			continue
		}
		if field.wireType != 0 {
			return nil, errors.New("character save has an invalid equipment UID")
		}
	}
	for slotIndex := range equipmentUIDs {
		var values []uint64
		for _, field := range itemFields {
			if field.number == avatarEquipmentField && field.wireType == 0 {
				values = append(values, field.value)
			}
		}
		if slotIndex < len(values) {
			equipmentUIDs[slotIndex] = values[slotIndex]
		}
	}

	var newItems []byte
	equipItemCount := 0
	for _, field := range equipFields {
		if field.number == equipSaveItemField {
			if field.wireType != 2 {
				return nil, errors.New("player save has an invalid equipment item")
			}
			equipItemCount++
		}
	}
	if equipItemCount+len(disks) > 3000 {
		return nil, errors.New("Drive Disc inventory is full; Remielle supports at most 3000 equipment items")
	}

	usedSlots := make(map[uint32]bool, len(disks))
	for _, disk := range disks {
		if disk.slot < 1 || disk.slot > 6 {
			return nil, fmt.Errorf("invalid Drive Disc slot %d", disk.slot)
		}
		if usedSlots[disk.slot] {
			return nil, fmt.Errorf("duplicate Drive Disc slot %d", disk.slot)
		}
		usedSlots[disk.slot] = true
		packet, packetErr := buildCreateDiskPacket(
			1, disk.setID, disk.rank, disk.slot, disk.mainStat,
			disk.subStatIDs, disk.subRolls, 1,
		)
		if packetErr != nil {
			return nil, packetErr
		}
		nextUID, ok := firstAvailableInventoryUID(usedUIDs)
		if !ok {
			return nil, errors.New("account has reached the maximum Drive Disc UID")
		}
		uid := nextUID
		usedUIDs[uid] = true
		equipmentUIDs[disk.slot-1] = equipmentUIDBase + uid
		equipItem := encodeDiskSaveItem(uid, packet)
		newItems = appendLengthDelimitedField(newItems, equipSaveItemField, equipItem)
	}

	var updatedAvatarItem []byte
	for _, field := range itemFields {
		if field.number == avatarEquipmentField {
			continue
		}
		updatedAvatarItem = append(updatedAvatarItem, avatarItem[field.start:field.end]...)
	}
	for _, uid := range equipmentUIDs {
		updatedAvatarItem = appendVarintField(updatedAvatarItem, avatarEquipmentField, uid)
	}
	updatedAvatarSave, err := replaceLengthDelimitedField(avatarSave, avatarItemIndex, updatedAvatarItem)
	if err != nil {
		return nil, err
	}
	updatedPlayerSave, err := replaceLengthDelimitedField(playerSave, avatarSaveIndex, updatedAvatarSave)
	if err != nil {
		return nil, err
	}

	if equipSaveIndex < 0 {
		return appendLengthDelimitedField(updatedPlayerSave, playerSaveEquipField, newItems), nil
	}
	updatedEquipSave := append(append([]byte(nil), equipSave...), newItems...)
	return replaceLengthDelimitedField(updatedPlayerSave, equipSaveIndex, updatedEquipSave)
}

func encodeDiskSaveItem(uid uint64, packet []byte) []byte {
	itemID := uint64(binary.LittleEndian.Uint16(packet[36:38]))
	meta := binary.LittleEndian.Uint16(packet[38:40])
	item := appendVarintField(nil, 1, uid)
	item = appendVarintField(item, 2, itemID)
	item = appendVarintField(item, 3, uint64(meta&0x0f))
	item = appendVarintField(item, 4, uint64(meta>>4&0x07))
	for offset := 16; offset < 36; offset += 4 {
		encoded := binary.LittleEndian.Uint32(packet[offset : offset+4])
		property := appendVarintField(nil, 1, uint64(encoded&0xffff))
		property = appendVarintField(property, 2, uint64(encoded>>16&0x0fff))
		property = appendVarintField(property, 3, uint64(encoded>>28&0x0f))
		item = appendLengthDelimitedField(item, 5, property)
	}
	return item
}

func replaceLengthDelimitedField(data []byte, fieldIndex int, replacement []byte) ([]byte, error) {
	fields, err := parseProtobufFields(data)
	if err != nil {
		return nil, err
	}
	if fieldIndex < 0 || fieldIndex >= len(fields) || fields[fieldIndex].wireType != 2 {
		return nil, errors.New("cannot replace an invalid protobuf message field")
	}
	field := fields[fieldIndex]
	out := make([]byte, 0, len(data)+len(replacement))
	out = append(out, data[:field.start]...)
	out = appendLengthDelimitedField(out, field.number, replacement)
	out = append(out, data[field.end:]...)
	return out, nil
}

func ensureRemielleStopped(address string) error {
	listener, err := net.ListenPacket("udp4", address)
	if err != nil {
		return fmt.Errorf("stop Remielle before editing the account save (%s is in use): %w", address, err)
	}
	if err := listener.Close(); err != nil {
		return fmt.Errorf("could not release the Remielle control port %s: %w", address, err)
	}
	return nil
}

func backupPlayerSave(savePath string, data []byte) (string, error) {
	stamp := time.Now().Format("20060102-150405.000000000")
	backupPath := savePath + "." + stamp + ".bak"
	file, err := os.OpenFile(backupPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return "", fmt.Errorf("could not create account save backup %s: %w", backupPath, err)
	}
	if _, err := file.Write(data); err != nil {
		_ = file.Close()
		return "", fmt.Errorf("could not write account save backup %s: %w", backupPath, err)
	}
	if err := file.Sync(); err != nil {
		_ = file.Close()
		return "", fmt.Errorf("could not flush account save backup %s: %w", backupPath, err)
	}
	if err := file.Close(); err != nil {
		return "", fmt.Errorf("could not close account save backup %s: %w", backupPath, err)
	}
	return backupPath, nil
}

func appendAvatarToPlayerSave(playerSave []byte, avatarID uint32) ([]byte, bool, error) {
	if len(playerSave) == 0 {
		return nil, false, errors.New("player save is empty")
	}
	rootFields, err := parseProtobufFields(playerSave)
	if err != nil {
		return nil, false, fmt.Errorf("invalid player save: %w", err)
	}

	avatarSaveIndex := -1
	for index, field := range rootFields {
		if field.number != playerSaveAvatarField {
			continue
		}
		if field.wireType != 2 {
			return nil, false, errors.New("player save has an invalid avatar field")
		}

		avatarSave := playerSave[field.payloadFrom:field.payloadTo]
		avatarFields, err := parseProtobufFields(avatarSave)
		if err != nil {
			return nil, false, fmt.Errorf("invalid avatar save: %w", err)
		}
		for _, itemField := range avatarFields {
			if itemField.number != avatarSaveItemField || itemField.wireType != 2 {
				continue
			}
			itemFields, err := parseProtobufFields(avatarSave[itemField.payloadFrom:itemField.payloadTo])
			if err != nil {
				return nil, false, fmt.Errorf("invalid avatar entry: %w", err)
			}
			for _, idField := range itemFields {
				if idField.number == avatarItemIDField && idField.wireType == 0 && idField.value == uint64(avatarID) {
					return playerSave, false, nil
				}
			}
		}
		avatarSaveIndex = index
	}

	item := encodeDefaultAvatar(avatarID)
	if avatarSaveIndex < 0 {
		avatarSave := appendLengthDelimitedField(nil, avatarSaveItemField, item)
		return appendLengthDelimitedField(playerSave, playerSaveAvatarField, avatarSave), true, nil
	}

	avatarField := rootFields[avatarSaveIndex]
	avatarSave := append([]byte(nil), playerSave[avatarField.payloadFrom:avatarField.payloadTo]...)
	avatarSave = appendLengthDelimitedField(avatarSave, avatarSaveItemField, item)
	replacement := appendLengthDelimitedField(nil, playerSaveAvatarField, avatarSave)
	out := make([]byte, 0, len(playerSave)+len(replacement))
	out = append(out, playerSave[:avatarField.start]...)
	out = append(out, replacement...)
	out = append(out, playerSave[avatarField.end:]...)
	return out, true, nil
}

func encodeDefaultAvatar(avatarID uint32) []byte {
	var item []byte
	item = appendVarintField(item, 1, uint64(avatarID))
	item = appendVarintField(item, 2, 1)
	item = appendVarintField(item, 3, 0)
	item = appendVarintField(item, 4, 1)
	item = appendVarintField(item, 5, 0)
	item = appendVarintField(item, 6, 0)
	item = appendVarintField(item, 7, 0)
	for range 7 {
		item = appendVarintField(item, 8, 1)
	}
	item = appendVarintField(item, 9, 0)
	item = appendVarintField(item, 12, 0)
	item = appendVarintField(item, 13, 0)
	item = appendVarintField(item, 14, 0)
	item = appendVarintField(item, 16, 0)
	item = appendVarintField(item, 10, 0)
	for range 6 {
		item = appendVarintField(item, 11, 0)
	}
	item = appendVarintField(item, 15, 255)
	return item
}

func parseProtobufFields(data []byte) ([]protobufField, error) {
	fields := make([]protobufField, 0)
	for offset := 0; offset < len(data); {
		start := offset
		key, err := readProtobufVarint(data, &offset)
		if err != nil {
			return nil, err
		}
		number, wireType := key>>3, key&7
		if number == 0 || number > (1<<29)-1 {
			return nil, errors.New("invalid protobuf field number")
		}

		field := protobufField{number: number, wireType: wireType, start: start}
		switch wireType {
		case 0:
			field.value, err = readProtobufVarint(data, &offset)
			if err != nil {
				return nil, err
			}
		case 1:
			if len(data)-offset < 8 {
				return nil, errors.New("truncated fixed64 protobuf field")
			}
			offset += 8
		case 2:
			length, lengthErr := readProtobufVarint(data, &offset)
			if lengthErr != nil {
				return nil, lengthErr
			}
			if length > uint64(len(data)-offset) {
				return nil, errors.New("truncated length-delimited protobuf field")
			}
			field.payloadFrom = offset
			offset += int(length)
			field.payloadTo = offset
		case 5:
			if len(data)-offset < 4 {
				return nil, errors.New("truncated fixed32 protobuf field")
			}
			offset += 4
		default:
			return nil, fmt.Errorf("unsupported protobuf wire type %d", wireType)
		}
		field.end = offset
		fields = append(fields, field)
	}
	return fields, nil
}

func readProtobufVarint(data []byte, offset *int) (uint64, error) {
	var value uint64
	for shift := uint(0); shift < 70; shift += 7 {
		if *offset >= len(data) {
			return 0, errors.New("truncated protobuf varint")
		}
		current := data[*offset]
		(*offset)++
		if shift == 63 && current > 1 {
			return 0, errors.New("protobuf varint overflows uint64")
		}
		value |= uint64(current&0x7f) << shift
		if current < 0x80 {
			return value, nil
		}
	}
	return 0, errors.New("protobuf varint is too long")
}

func appendVarintField(dst []byte, number uint64, value uint64) []byte {
	dst = appendProtobufVarint(dst, number<<3)
	return appendProtobufVarint(dst, value)
}

func appendLengthDelimitedField(dst []byte, number uint64, value []byte) []byte {
	dst = appendProtobufVarint(dst, number<<3|2)
	dst = appendProtobufVarint(dst, uint64(len(value)))
	return append(dst, value...)
}

func appendProtobufVarint(dst []byte, value uint64) []byte {
	for value >= 0x80 {
		dst = append(dst, byte(value)|0x80)
		value >>= 7
	}
	return append(dst, byte(value))
}

func savePlayerPath(serverDir string, playerUID uint32) string {
	return filepath.Join(serverDir, "Persistent", "LocalStorage", "USD_"+strconv.FormatUint(uint64(playerUID), 10)+".bin")
}
