package hoyoService

import (
	"errors"
	"fmt"
	"time"

	"sunbringer-launcher/pkg/constant"
)

type statDefinition struct {
	mainValue        uint32
	subValue         uint32
	allowedMainSlots map[uint32]bool
}

var diskStats = map[uint32]statDefinition{
	11103: {mainValue: 550, subValue: 112, allowedMainSlots: slots(1)},
	11102: {mainValue: 750, subValue: 300, allowedMainSlots: slots(4, 5, 6)},
	12103: {mainValue: 79, subValue: 19, allowedMainSlots: slots(2)},
	12102: {mainValue: 750, subValue: 300, allowedMainSlots: slots(4, 5, 6)},
	13103: {mainValue: 46, subValue: 15, allowedMainSlots: slots(3)},
	13102: {mainValue: 1200, subValue: 480, allowedMainSlots: slots(4, 5, 6)},
	23203: {subValue: 9},
	23103: {mainValue: 600, allowedMainSlots: slots(5)},
	31402: {mainValue: 750, allowedMainSlots: slots(6)},
	31203: {mainValue: 23, subValue: 9, allowedMainSlots: slots(4)},
	21103: {mainValue: 1200, subValue: 480, allowedMainSlots: slots(4)},
	20103: {mainValue: 600, subValue: 240, allowedMainSlots: slots(4)},
	30502: {mainValue: 1500, allowedMainSlots: slots(6)},
	12202: {mainValue: 450, allowedMainSlots: slots(6)},
	31803: {mainValue: 750, allowedMainSlots: slots(5)},
	31903: {mainValue: 750, allowedMainSlots: slots(5)},
	31603: {mainValue: 750, allowedMainSlots: slots(5)},
	31703: {mainValue: 750, allowedMainSlots: slots(5)},
	31503: {mainValue: 750, allowedMainSlots: slots(5)},
	32303: {mainValue: 750, allowedMainSlots: slots(5)},
}

func slots(values ...uint32) map[uint32]bool {
	result := make(map[uint32]bool, len(values))
	for _, value := range values {
		result[value] = true
	}
	return result
}

func containsID(values []uint32, target uint32) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func result(err error) (bool, string) {
	if err != nil {
		return false, err.Error()
	}
	return true, ""
}

func (s *HoyoService) CreateDisk(
	playerUID, setID, rank, slot, mainStat uint32,
	subStatIDs, subRolls []uint32,
) (bool, string) {
	userdata, err := randomUserdata()
	if err != nil {
		return result(err)
	}
	packet, err := buildCreateDiskPacket(playerUID, setID, rank, slot, mainStat, subStatIDs, subRolls, userdata)
	if err != nil {
		return result(err)
	}
	return result(sendControlPacket(packet))
}

func (s *HoyoService) EquipDiskSet(
	playerUID, avatarID uint32,
	setIDs, ranks, slots, mainStats []uint32,
	subStatIDs, subRolls [][]uint32,
) (bool, string) {
	if playerUID == 0 || avatarID == 0 {
		return result(errors.New("player UID and character ID must be greater than zero"))
	}
	if !containsID(characterIDs, avatarID) {
		return result(fmt.Errorf("unknown character ID %d", avatarID))
	}
	count := len(setIDs)
	if count == 0 || count > 6 ||
		len(ranks) != count || len(slots) != count || len(mainStats) != count ||
		len(subStatIDs) != count || len(subRolls) != count {
		return result(errors.New("Drive Disc loadout data is incomplete or contains more than six discs"))
	}

	disks := make([]diskLoadoutItem, count)
	usedSlots := make(map[uint32]bool, count)
	for index := range disks {
		if usedSlots[slots[index]] {
			return result(fmt.Errorf("Drive Disc slot %d appears more than once", slots[index]))
		}
		usedSlots[slots[index]] = true
		disks[index] = diskLoadoutItem{
			setID:      setIDs[index],
			rank:       ranks[index],
			slot:       slots[index],
			mainStat:   mainStats[index],
			subStatIDs: subStatIDs[index],
			subRolls:   subRolls[index],
		}
		if _, err := buildCreateDiskPacket(
			playerUID, disks[index].setID, disks[index].rank, disks[index].slot,
			disks[index].mainStat, disks[index].subStatIDs, disks[index].subRolls, 1,
		); err != nil {
			return result(fmt.Errorf("invalid Drive Disc in slot %d: %w", disks[index].slot, err))
		}
	}

	if err := disconnectUIDBeforeSaveEdit(playerUID, "equipping discs"); err != nil {
		return result(err)
	}

	backupPath, err := equipDiskSetSave(constant.RemielleStorageDir, playerUID, avatarID, disks)
	if err != nil {
		return result(err)
	}
	return true, fmt.Sprintf("Equipped %d Drive Discs to character %d. Backup: %s. Reconnect UID %d to load the changes.", len(disks), avatarID, backupPath, playerUID)
}

func (s *HoyoService) CreateWeapon(playerUID, weaponID, level, refinement uint32) (bool, string) {
	userdata, err := randomUserdata()
	if err != nil {
		return result(err)
	}
	packet, err := buildCreateWeaponPacket(playerUID, weaponID, level, refinement, userdata)
	if err != nil {
		return result(err)
	}
	return result(sendControlPacket(packet))
}

func (s *HoyoService) UnlockCharacter(playerUID, avatarID uint32) (bool, string) {
	if playerUID == 0 {
		return result(errors.New("player UID must be greater than zero"))
	}
	if !containsID(characterIDs, avatarID) {
		return result(fmt.Errorf("unknown character ID %d", avatarID))
	}

	if err := disconnectUIDBeforeSaveEdit(playerUID, "unlocking a character"); err != nil {
		return result(err)
	}

	backupPath, added, err := unlockCharacterSave(constant.RemielleStorageDir, playerUID, avatarID)
	if err != nil {
		return result(err)
	}
	if !added {
		return true, "Character is already unlocked."
	}
	return true, fmt.Sprintf("Character unlocked. Backup: %s. Reconnect UID %d to use it.", backupPath, playerUID)
}

func (s *HoyoService) DeleteCharacterSave(playerUID, avatarID uint32) (bool, string) {
	if playerUID == 0 {
		return result(errors.New("player UID must be greater than zero"))
	}
	if !containsID(characterIDs, avatarID) {
		return result(fmt.Errorf("unknown character ID %d", avatarID))
	}
	if err := disconnectUIDBeforeSaveEdit(playerUID, "deleting a character"); err != nil {
		return result(err)
	}

	backupPath, removedDisks, removedWeapons, err := deleteCharacterSave(
		constant.RemielleStorageDir, playerUID, avatarID,
	)
	if err != nil {
		return result(err)
	}
	return true, fmt.Sprintf(
		"Character %d was deleted; removed %d equipped Drive Discs and %d equipped W-Engines from inventory. Gear still equipped to another character was preserved. Backup: %s.",
		avatarID, removedDisks, removedWeapons, backupPath,
	)
}

func (s *HoyoService) DeleteAllCharactersSave(playerUID, keepAvatarID uint32) (bool, string) {
	if playerUID == 0 || keepAvatarID == 0 {
		return result(errors.New("player UID and character ID to keep must be greater than zero"))
	}
	if !containsID(characterIDs, keepAvatarID) {
		return result(fmt.Errorf("unknown character ID %d", keepAvatarID))
	}
	if err := disconnectUIDBeforeSaveEdit(playerUID, "deleting all other characters"); err != nil {
		return result(err)
	}

	backupPath, removedCharacters, removedDisks, removedWeapons, err := deleteAllCharactersSave(
		constant.RemielleStorageDir, playerUID, keepAvatarID,
	)
	if err != nil {
		return result(err)
	}
	if removedCharacters == 0 {
		return true, fmt.Sprintf("Character %d is the only character in the save; nothing was deleted.", keepAvatarID)
	}
	return true, fmt.Sprintf(
		"Deleted %d characters, keeping character %d. Removed %d Drive Discs and %d W-Engines. Backup: %s.",
		removedCharacters, keepAvatarID, removedDisks, removedWeapons, backupPath,
	)
}

func (s *HoyoService) GetSaveInventory(playerUID uint32) (SaveInventory, string) {
	inventory, err := readSaveInventory(constant.RemielleStorageDir, playerUID)
	if err != nil {
		return SaveInventory{}, err.Error()
	}
	return inventory, ""
}

func (s *HoyoService) DeleteInventoryItem(playerUID uint32, itemType string, itemUID uint32) (bool, string) {
	if playerUID == 0 {
		return result(errors.New("player UID must be greater than zero"))
	}
	if itemType != "disk" && itemType != "weapon" {
		return result(fmt.Errorf("unsupported inventory item type %q", itemType))
	}
	if itemUID == 0 {
		return result(errors.New("inventory item UID must be greater than zero"))
	}
	if err := disconnectUIDBeforeSaveEdit(playerUID, "deleting an inventory item"); err != nil {
		return result(err)
	}

	backupPath, affectedAvatarIDs, err := deleteInventoryItemSave(
		constant.RemielleStorageDir, playerUID, itemType, itemUID,
	)
	if err != nil {
		return result(err)
	}
	itemName := "Drive Disc"
	if itemType == "weapon" {
		itemName = "W-Engine"
	}
	message := fmt.Sprintf(
		"%s UID %d deleted from inventory. Backup: %s.",
		itemName, itemUID, backupPath,
	)
	if len(affectedAvatarIDs) > 0 {
		message += fmt.Sprintf(" Unequipped from %d character(s).", len(affectedAvatarIDs))
	}
	return true, message
}

func (s *HoyoService) DeleteAllInventoryItems(playerUID uint32) (bool, string) {
	if playerUID == 0 {
		return result(errors.New("player UID must be greater than zero"))
	}
	if err := disconnectUIDBeforeSaveEdit(playerUID, "deleting all inventory items"); err != nil {
		return result(err)
	}

	backupPath, removedDisks, removedWeapons, affectedAvatarIDs, err := deleteAllInventoryItemsSave(
		constant.RemielleStorageDir, playerUID,
	)
	if err != nil {
		return result(err)
	}
	if removedDisks+removedWeapons == 0 {
		return true, "No Drive Discs or W-Engines were found in this account save."
	}

	message := fmt.Sprintf(
		"Deleted %d Drive Discs and %d W-Engines. Backup: %s.",
		removedDisks, removedWeapons, backupPath,
	)
	if len(affectedAvatarIDs) > 0 {
		message += fmt.Sprintf(" Unequipped items from %d character(s).", len(affectedAvatarIDs))
	}
	return true, message
}

func disconnectUIDBeforeSaveEdit(playerUID uint32, action string) error {
	if playerUID == 0 {
		return errors.New("player UID must be greater than zero")
	}
	if err := ensureRemielleStopped(controlAddress); err == nil {
		return nil
	}

	userdata, err := randomUserdata()
	if err != nil {
		return err
	}
	packet, err := buildPlayerKickPacket(playerUID, userdata)
	if err != nil {
		return err
	}
	if err := sendControlPacket(packet); err != nil {
		return fmt.Errorf("could not save and disconnect UID %d before %s: %w", playerUID, action, err)
	}
	time.Sleep(time.Second)
	return nil
}

func (s *HoyoService) ModifyCharacter(
	playerUID, avatarID, level uint32,
	skillLevels []uint32,
	mindscape, potentialLevel int32,
	skinID uint32,
) (bool, string) {
	if playerUID == 0 {
		return result(errors.New("player UID must be greater than zero"))
	}
	if !containsID(characterIDs, avatarID) {
		return result(fmt.Errorf("unknown character ID %d", avatarID))
	}
	if level > 60 {
		return result(errors.New("character level must be between 1 and 60"))
	}
	if len(skillLevels) != 7 {
		return result(errors.New("exactly seven skill levels are required"))
	}
	if mindscape < -1 || mindscape > 6 {
		return result(errors.New("mindscape must be between 0 and 6"))
	}
	if potentialLevel < -1 || potentialLevel > 6 {
		return result(errors.New("Potential Vision must be between P0 and P6"))
	}

	type change struct {
		field uint8
		value uint64
	}
	changes := make([]change, 0, 10)
	if level > 0 {
		changes = append(changes,
			change{field: 0, value: uint64(level)},
			change{field: 2, value: uint64((level-1)/10 + 1)},
		)
	}
	for skillID, skillLevel := range skillLevels {
		if skillLevel == 0 {
			continue
		}
		maxLevel := uint32(12)
		if skillID == 5 {
			maxLevel = 7
		}
		if skillLevel > maxLevel {
			return result(fmt.Errorf("skill %d level must be between 1 and %d", skillID, maxLevel))
		}
		value := uint64(skillID) | uint64(skillLevel)<<32
		changes = append(changes, change{field: 5, value: value})
	}
	if mindscape >= 0 {
		changes = append(changes, change{field: 3, value: uint64(mindscape)})
	}
	if potentialLevel >= 0 {
		potentialID := uint32(0)
		if potentialLevel > 0 {
			catalog, message := s.GetCatalog()
			if message != "" {
				return result(fmt.Errorf("load Potential Vision data: %s", message))
			}
			var found bool
			potentialID, found = resolvePotentialID(avatarID, potentialLevel, catalog.Characters)
			if !found {
				return result(fmt.Errorf("character %d has no Potential Vision data for P%d", avatarID, potentialLevel))
			}
		}
		changes = append(changes, change{field: modAvatarFieldAwakening, value: uint64(potentialID)})
	}
	if skinID != 0 {
		catalog, message := s.GetCatalog()
		if message != "" {
			return result(fmt.Errorf("load character skin data: %s", message))
		}
		if catalog.SkinDataError != "" {
			return result(fmt.Errorf("load Remielle skin data: %s", catalog.SkinDataError))
		}
		if !resolveSkinID(avatarID, skinID, catalog.Characters) {
			return result(fmt.Errorf("skin %d is not available for character %d in the current Remielle data", skinID, avatarID))
		}
		changes = append(changes, change{field: modAvatarFieldSkin, value: uint64(skinID)})
	}
	if len(changes) == 0 {
		return result(errors.New("choose a character level, one or more skill levels, a mindscape, Potential Vision, or a skin"))
	}

	for index, change := range changes {
		userdata, err := randomUserdata()
		if err != nil {
			return result(fmt.Errorf("character update stopped after %d of %d operations: %w", index, len(changes), err))
		}
		packet, err := buildModAvatarPacket(playerUID, avatarID, change.field, change.value, userdata)
		if err == nil {
			err = sendControlPacket(packet)
		}
		if err != nil {
			return result(fmt.Errorf("character update stopped after %d of %d operations: %w", index, len(changes), err))
		}
	}
	return true, ""
}

func resolveSkinID(avatarID, skinID uint32, characters []CatalogItem) bool {
	for _, character := range characters {
		if character.ID == avatarID {
			return containsID(character.SkinIDs, skinID)
		}
	}
	return false
}

func resolvePotentialID(avatarID uint32, potentialLevel int32, characters []CatalogItem) (uint32, bool) {
	if potentialLevel < 1 || potentialLevel > 6 {
		return 0, false
	}
	for _, character := range characters {
		if character.ID == avatarID && int(potentialLevel) <= len(character.PotentialIDs) {
			potentialID := character.PotentialIDs[potentialLevel-1]
			return potentialID, potentialID != 0
		}
	}
	return 0, false
}
