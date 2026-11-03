package hoyoService

import (
	"errors"
	"fmt"
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

func (s *HoyoService) ModifyCharacter(
	playerUID, avatarID, level uint32,
	skillLevels []uint32,
	mindscape int32,
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

	type change struct {
		field uint8
		value uint64
	}
	changes := make([]change, 0, 9)
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
	if len(changes) == 0 {
		return result(errors.New("choose a character level, one or more skill levels, or a mindscape"))
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
