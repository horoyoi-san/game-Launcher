package hoyoService

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestParseAvatarSkinIDs(t *testing.T) {
	data := []byte(`.{
		.{ .id = 3110110, .avatar_id = 1011 },
		.{ .id = 3110111, .avatar_id = 1011 },
		.{ .id = 3110410, .avatar_id = 1041 },
	}`)
	got, err := parseAvatarSkinIDs(data)
	if err != nil {
		t.Fatal(err)
	}
	if want := []uint32{3110110, 3110111}; !reflect.DeepEqual(got[1011], want) {
		t.Errorf("skins for avatar 1011 = %v, want %v", got[1011], want)
	}
	if want := []uint32{3110410}; !reflect.DeepEqual(got[1041], want) {
		t.Errorf("skins for avatar 1041 = %v, want %v", got[1041], want)
	}
}

func TestParseAvatarSkinIDsRejectsDuplicateIDs(t *testing.T) {
	data := []byte(`.{
		.{ .id = 3110110, .avatar_id = 1011 },
		.{ .id = 3110110, .avatar_id = 1041 },
	}`)
	if _, err := parseAvatarSkinIDs(data); err == nil {
		t.Fatal("expected duplicate skin ID to be rejected")
	}
}

func TestCatalogImagePath(t *testing.T) {
	tests := []struct {
		icon          string
		wantImageID   string
		wantImagePath string
	}{
		{icon: "IconRole1661", wantImageID: "IconRole1661", wantImagePath: "/hoyo/characters/IconRole1661.webp"},
		{icon: "Weapon_S_1661", wantImageID: "Weapon_S_1661", wantImagePath: "/hoyo/weapons/Weapon_S_1661.webp"},
		{
			icon:          "UI/Sprite/A1DynamicLoad/IconSuit/UnPacker/SuitWoodpeckerElectro.png",
			wantImageID:   "SuitWoodpeckerElectro",
			wantImagePath: "/hoyo/disks/SuitWoodpeckerElectro.webp",
		},
		{
			icon:          "UI/Sprite/A1DynamicLoad/IconSuit/UnPacker/SuitBranch&BladeSong.png",
			wantImageID:   "SuitBranch&BladeSong",
			wantImagePath: "/hoyo/disks/SuitBranch&BladeSong.webp",
		},
		{icon: "", wantImageID: "", wantImagePath: ""},
	}

	for _, test := range tests {
		gotImageID, gotImagePath, err := catalogImagePath(test.icon)
		if err != nil {
			t.Fatalf("catalogImagePath(%q) error = %v", test.icon, err)
		}
		if gotImageID != test.wantImageID || gotImagePath != test.wantImagePath {
			t.Errorf("catalogImagePath(%q) = (%q, %q), want (%q, %q)",
				test.icon, gotImageID, gotImagePath, test.wantImageID, test.wantImagePath)
		}
	}
}

func TestLatestNanokaDataURL(t *testing.T) {
	tests := []struct {
		name          string
		latestVersion string
		liveVersion   string
		wantURL       string
		wantErr       bool
	}{
		{
			name:          "uses latest Beta ZZZ version",
			latestVersion: "3.5.0+20270000",
			liveVersion:   "3.4.3+20266797",
			wantURL:       nanokaDataBaseURL + "/3.5.0+20270000",
		},
		{name: "missing latest version", liveVersion: "3.4.3+20266797", wantErr: true},
		{name: "rejects path segments", latestVersion: "../other", wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
				writer.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(writer).Encode(map[string]any{
					"zzz": map[string]string{
						"latest": test.latestVersion,
						"live":   test.liveVersion,
					},
				})
			}))
			defer server.Close()

			gotURL, err := latestNanokaDataURL(server.URL)
			if test.wantErr {
				if err == nil {
					t.Fatal("latestNanokaDataURL() succeeded, want an error")
				}
				return
			}
			if err != nil {
				t.Fatalf("latestNanokaDataURL() error = %v", err)
			}
			if gotURL != test.wantURL {
				t.Errorf("latestNanokaDataURL() = %q, want %q", gotURL, test.wantURL)
			}
		})
	}
}

func TestCharacterImagePathUsesLocalFilenames(t *testing.T) {
	seen := make(map[string]bool, len(characterImageFiles))
	for _, id := range characterIDs {
		filename, ok := characterImageFiles[id]
		if !ok {
			t.Errorf("character %d has no local image mapping", id)
			continue
		}
		if seen[filename] {
			t.Errorf("local character image %q is mapped more than once", filename)
		}
		seen[filename] = true
		if got, want := characterImagePath(id), "/hoyo/characters/"+filename; got != want {
			t.Errorf("characterImagePath(%d) = %q, want %q", id, got, want)
		}
	}
	if got := characterImagePath(0); got != "" {
		t.Errorf("characterImagePath(0) = %q, want empty for an unmapped character", got)
	}
}

func TestWeaponLocalImagePath(t *testing.T) {
	tests := []struct {
		id           uint32
		name         string
		fallbackPath string
		want         string
	}{
		{14150, "Angel in the Shell", "/hoyo/weapons/Weapon_S_1501.webp", "/hoyo/weapons/Angel in the Shell.webp"},
		{14159, "Knight's Extolment", "/hoyo/weapons/Weapon_S_1591.webp", "/hoyo/weapons/Knights Extolment.webp"},
		{13112, "Big Cylinder", "/hoyo/weapons/Weapon_A_1121.webp", "/hoyo/weapons/Big Cylinde.webp"},
		{14160, "Item_Weapon_S_1601_Name", "/hoyo/weapons/Weapon_S_1601.webp", "/hoyo/weapons/Weapon_S_1601.webp"},
		{99999, "../unsafe", "/hoyo/weapons/Weapon_S_Common_01.webp", "/hoyo/weapons/Weapon_S_Common_01.webp"},
	}
	for _, test := range tests {
		if got := weaponLocalImagePath(test.id, test.name, test.fallbackPath); got != test.want {
			t.Errorf("weaponLocalImagePath(%d, %q) = %q, want %q", test.id, test.name, got, test.want)
		}
	}

	for _, filename := range []string{"Big Cylinde.webp", "Grill OWisp.webp", "Krakens Cradle.webp"} {
		if _, err := os.Stat(filepath.Join("..", "..", "frontend", "public", "hoyo", "weapons", filename)); err != nil {
			t.Errorf("local weapon artwork %q is unavailable: %v", filename, err)
		}
	}
}

func TestCatalogImagePathRejectsUnsafePaths(t *testing.T) {
	for _, icon := range []string{"../secret.png", "images/../../secret.png", "/root.png", `a\b.png`} {
		if _, _, err := catalogImagePath(icon); err == nil {
			t.Errorf("catalogImagePath(%q) should reject the path", icon)
		}
	}
}

func TestLoadCatalog(t *testing.T) {
	characters := make(map[string]remoteIcon, len(characterIDs))
	weapons := make(map[string]remoteIcon, len(weaponIDs))
	disks := make(map[string]remoteEquipment, len(diskSetIDs))
	for _, id := range characterIDs {
		character := remoteIcon{Icon: fmt.Sprintf("IconRole%d", id), Name: fmt.Sprintf("Agent %d", id), Rank: 4, Specialty: 1, Element: 201}
		if id == 1011 {
			character.Rank = 3
		}
		if id == 1041 {
			character.Potential = []uint32{104100, 104101, 104102, 104103, 104104, 104105}
		}
		characters[fmt.Sprint(id)] = character
	}
	for _, id := range weaponIDs {
		name := fmt.Sprintf("Engine %d", id)
		icon := fmt.Sprintf("Weapon_S_%d", id)
		switch id {
		case 14150:
			name = "Angel in the Shell"
		case 13112:
			name = "Big Cylinder"
		case 14160:
			name = "Item_Weapon_S_1601_Name"
			icon = "Weapon_S_1601"
		}
		rank := uint32(id/1000 - 10)
		weapons[fmt.Sprint(id)] = remoteIcon{Icon: icon, Name: name, Rank: rank}
	}
	for _, id := range diskSetIDs {
		var entry remoteEquipment
		entry.Icon = fmt.Sprintf("UI/Sprite/Suit%d.png", id)
		if id == 34300 || id == 34400 {
			entry.Icon = ""
		} else if id == 32800 {
			entry.Icon = "UI/Sprite/A1DynamicLoad/IconSuit/UnPacker/SuitBranch&BladeSong.png"
		}
		entry.Name.Name = fmt.Sprintf("Set %d", id)
		if id == 32800 {
			entry.Name.Desc2 = "ATK +10%"
			entry.Name.Desc4 = "Gain <color=#FFFFFF>8%</color> DMG."
		}
		disks[fmt.Sprint(id)] = entry
	}

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/character.json":
			_ = json.NewEncoder(writer).Encode(characters)
		case "/weapon.json":
			_ = json.NewEncoder(writer).Encode(weapons)
		case "/equipment.json":
			_ = json.NewEncoder(writer).Encode(disks)
		default:
			http.NotFound(writer, request)
		}
	}))
	defer server.Close()

	catalog, err := loadCatalogFrom(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	if len(catalog.Characters) != len(characterIDs) || len(catalog.Weapons) != len(weaponIDs) || len(catalog.Disks) != len(diskSetIDs) {
		t.Fatalf("catalog counts = (%d, %d, %d), want (%d, %d, %d)",
			len(catalog.Characters), len(catalog.Weapons), len(catalog.Disks),
			len(characterIDs), len(weaponIDs), len(diskSetIDs),
		)
	}
	if catalog.Characters[0].ImageID == "" || catalog.Weapons[0].ImageID == "" || catalog.Disks[0].ImageID == "" {
		t.Fatal("catalog item image IDs must be populated")
	}
	if catalog.Characters[0].ImagePath == "" || catalog.Weapons[0].ImagePath == "" || catalog.Disks[0].ImagePath == "" {
		t.Fatal("catalog item image paths must be populated")
	}
	foundDiskEffects := false
	for _, disk := range catalog.Disks {
		if disk.ID == 32800 {
			foundDiskEffects = true
			if disk.TwoPieceEffect != "ATK +10%" || disk.FourPieceEffect != "Gain 8% DMG." {
				t.Fatalf("disk effects = (%q, %q), want markup-free descriptions", disk.TwoPieceEffect, disk.FourPieceEffect)
			}
		}
	}
	if !foundDiskEffects {
		t.Fatal("disk set 32800 was not found in the catalog")
	}
	for _, character := range catalog.Characters {
		if character.ID == 1041 {
			if character.Specialty != 1 || character.Element != 201 {
				t.Fatalf("character specialty/element = %d/%d, want 1/201", character.Specialty, character.Element)
			}
			if len(character.PotentialIDs) != 6 || character.PotentialIDs[5] != 104105 {
				t.Fatalf("character potential IDs = %v, want six IDs ending in 104105", character.PotentialIDs)
			}
			break
		}
	}
	for _, character := range catalog.Characters {
		if character.ID == 1011 && character.Rank != 3 {
			t.Errorf("character rank = %d, want 3", character.Rank)
		}
	}
	for _, weapon := range catalog.Weapons {
		if weapon.ID == 14150 && weapon.Rank != 4 {
			t.Errorf("weapon rank = %d, want 4", weapon.Rank)
		}
	}

	for _, item := range catalog.Characters {
		if want := characterImagePath(item.ID); item.ImagePath != want {
			t.Errorf("character %d image path = %q, want %q", item.ID, item.ImagePath, want)
		}
	}
	for _, test := range []struct {
		id       uint32
		name     string
		wantPath string
	}{
		{14150, "Angel in the Shell", "/hoyo/weapons/Angel in the Shell.webp"},
		{13112, "Big Cylinder", "/hoyo/weapons/Big Cylinde.webp"},
		{14160, "Item_Weapon_S_1601_Name", "/hoyo/weapons/Weapon_S_1601.webp"},
	} {
		for _, item := range catalog.Weapons {
			if item.ID == test.id {
				if item.ImagePath != test.wantPath {
					t.Errorf("weapon %d image path = %q, want %q", test.id, item.ImagePath, test.wantPath)
				}
				break
			}
		}
	}
	for _, id := range []uint32{34300, 34400} {
		found := false
		for _, item := range catalog.Disks {
			if item.ID == id {
				found = true
				if item.ImageID != "" || item.ImagePath != "" {
					t.Errorf("disk %d image = (%q, %q), want empty image metadata", id, item.ImageID, item.ImagePath)
				}
				break
			}
		}
		if !found {
			t.Errorf("catalog is missing disk %d", id)
		}
	}
	for _, item := range catalog.Disks {
		if item.ID == 32800 {
			if item.ImageID != "SuitBranch&BladeSong" || item.ImagePath != "/hoyo/disks/SuitBranch&BladeSong.webp" {
				t.Errorf("disk %d image = (%q, %q), want image basename and local path with ampersand",
					item.ID, item.ImageID, item.ImagePath)
			}
			return
		}
	}
	t.Error("catalog is missing disk 32800")
}
