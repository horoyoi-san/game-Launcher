package hoyoService

import "testing"

func TestEquipDiskSetRejectsDuplicateSlots(t *testing.T) {
	service := &HoyoService{}
	ok, message := service.EquipDiskSet(
		1, 1011,
		[]uint32{33000, 33000},
		[]uint32{4, 4},
		[]uint32{1, 1},
		[]uint32{11103, 11103},
		[][]uint32{
			{12103, 13103, 23203, 20103},
			{12103, 13103, 23203, 20103},
		},
		[][]uint32{{0, 0, 0, 0}, {0, 0, 0, 0}},
	)
	if ok || message != "Drive Disc slot 1 appears more than once" {
		t.Fatalf("EquipDiskSet() = (%t, %q), want duplicate slot rejection", ok, message)
	}
}

func TestResolveSkinID(t *testing.T) {
	characters := []CatalogItem{
		{ID: 1011, SkinIDs: []uint32{3110110, 3110111}},
		{ID: 1041, SkinIDs: []uint32{3110410}},
	}
	tests := []struct {
		name     string
		avatarID uint32
		skinID   uint32
		want     bool
	}{
		{name: "skin belongs to character", avatarID: 1011, skinID: 3110111, want: true},
		{name: "default skin belongs to character", avatarID: 1011, skinID: 3110110, want: true},
		{name: "skin belongs to another character", avatarID: 1011, skinID: 3110410},
		{name: "unknown skin", avatarID: 1011, skinID: 9999999},
		{name: "unknown character", avatarID: 9999, skinID: 3110110},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := resolveSkinID(test.avatarID, test.skinID, characters); got != test.want {
				t.Errorf("resolveSkinID(%d, %d) = %t, want %t", test.avatarID, test.skinID, got, test.want)
			}
		})
	}
}

func TestResolvePotentialID(t *testing.T) {
	characters := []CatalogItem{
		{ID: 1041, PotentialIDs: []uint32{104100, 104101, 104102, 104103, 104104, 104105}},
		{ID: 1011},
	}

	tests := []struct {
		name        string
		avatarID    uint32
		level       int32
		wantID      uint32
		wantSuccess bool
	}{
		{name: "resolves selected level", avatarID: 1041, level: 6, wantID: 104105, wantSuccess: true},
		{name: "character does not have potential data", avatarID: 1011, level: 1},
		{name: "unknown character", avatarID: 9999, level: 1},
		{name: "level out of range", avatarID: 1041, level: 7},
		{name: "zero ID is invalid", avatarID: 1041, level: 1},
	}

	characters[0].PotentialIDs[0] = 0
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			gotID, ok := resolvePotentialID(test.avatarID, test.level, characters)
			if gotID != test.wantID || ok != test.wantSuccess {
				t.Errorf("resolvePotentialID(%d, %d) = (%d, %t), want (%d, %t)",
					test.avatarID, test.level, gotID, ok, test.wantID, test.wantSuccess)
			}
		})
	}
}
