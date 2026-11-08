package hoyoService

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"sunbringer-launcher/pkg/constant"
)

const (
	nanokaManifestURL = "https://static.nanoka.cc/manifest.json"
	nanokaDataBaseURL = "https://static.nanoka.cc/zzz"
)

type nanokaManifest struct {
	ZZZ struct {
		Latest string `json:"latest"`
	} `json:"zzz"`
}

type CatalogItem struct {
	ID              uint32   `json:"id"`
	Name            string   `json:"name"`
	ImageID         string   `json:"imageId"`
	ImagePath       string   `json:"imagePath"`
	Rank            uint32   `json:"rank"`
	Specialty       uint32   `json:"specialty,omitempty"`
	Element         uint32   `json:"element,omitempty"`
	TwoPieceEffect  string   `json:"twoPieceEffect,omitempty"`
	FourPieceEffect string   `json:"fourPieceEffect,omitempty"`
	PotentialIDs    []uint32 `json:"potentialIds,omitempty"`
	SkinIDs         []uint32 `json:"skinIds,omitempty"`
}

type HoyoCatalog struct {
	Characters    []CatalogItem `json:"characters"`
	Weapons       []CatalogItem `json:"weapons"`
	Disks         []CatalogItem `json:"disks"`
	SkinDataError string        `json:"skinDataError,omitempty"`
}

var avatarSkinEntryPattern = regexp.MustCompile(`\{\s*\.id\s*=\s*(\d+)\s*,\s*\.avatar_id\s*=\s*(\d+)\s*\}`)

var characterIDs = []uint32{
	1401, 1011, 1111, 1501, 1311, 1471, 1121, 1081,
	1171, 1071, 1521, 1611, 1061, 1481, 1191, 1321,
	1181, 1201, 1291, 1261, 1391, 1101, 1161, 1451,
	1151, 1141, 1441, 1091, 1511, 1021, 1031, 1571,
	1301, 1421, 1641, 1281, 1541, 1351, 1551, 1251,
	1581, 1211, 1661, 1621, 1461, 1271, 1631, 1591,
	1381, 1041, 1131, 1531, 1601, 1491, 1361, 1561,
	1331, 1221, 1431, 1051, 1371, 1411, 1341, 1241,
	1651,
}

var characterImageFiles = map[uint32]string{
	1401: "Alice Thymefield.webp",
	1011: "Anby Demara.webp",
	1111: "Anton Ivanov.webp",
	1501: "Aria.webp",
	1311: "Astra Yao.webp",
	1471: "Banyue.webp",
	1121: "Ben Bigger.webp",
	1081: "Billy Kid.webp",
	1171: "Burnice White.webp",
	1071: "Caesar King.webp",
	1521: "Cissia.webp",
	1611: "Claret Flint.webp",
	1061: "Corin Wickes.webp",
	1481: "Dialyn.webp",
	1191: "Ellen Joe.webp",
	1321: "Evelyn Chevalier.webp",
	1181: "Grace Howard.webp",
	1201: "Asaba Harumasa.webp",
	1291: "Hugo Vlad.webp",
	1261: "Jane Doe.webp",
	1391: "Ju Fufu.webp",
	1101: "Koleda Belobog.webp",
	1161: "Lighter.webp",
	1451: "Lucia Elowen.webp",
	1151: "Luciana de Montefio.webp",
	1141: "Von Lycaon.webp",
	1441: "Komano Manato.webp",
	1091: "Hoshimi Miyabi.webp",
	1511: "Nangong Yu.webp",
	1021: "Nekomiya Mana.webp",
	1031: "Nicole Demara.webp",
	1571: "Norma Hollowell.webp",
	1301: "Orphie Magnusson & Magus.webp",
	1421: "Pan Yinhu.webp",
	1641: "Phoenix Reffaella.webp",
	1281: "Piper.webp",
	1541: "Promeia.webp",
	1351: "Pulchra Fellini.webp",
	1551: "Pyrois.webp",
	1251: "Qingyi.webp",
	1581: "Remielle Dan.webp",
	1211: "Alexandrina Sebastiane.webp",
	1661: "Robin.webp",
	1621: "Roxy Ifrita Pryce.webp",
	1461: "Seed.webp",
	1271: "Seth Lowell.webp",
	1631: "Severian Lowell.webp",
	1591: "Sigrid de Lazur.webp",
	1381: "Soldier 0 - Anby.webp",
	1041: "Soldier 11.webp",
	1131: "Soukaku.webp",
	1531: "Starlight - Billy.webp",
	1601: "Sunbringer.webp",
	1491: "Sunna.webp",
	1361: "Trigger.webp",
	1561: "Velina Airgid.webp",
	1331: "Vivian Banshee.webp",
	1221: "Tsukishiro Yanagi.webp",
	1431: "Ye Shunguang.webp",
	1051: "Yidhari Murphy.webp",
	1371: "Yixuan.webp",
	1411: "Ukinami Yuzuha.webp",
	1341: "Zhao.webp",
	1241: "Zhu Yuan.webp",
	1651: "Kafka.webp",
}

var weaponIDs = []uint32{
	12015, 12013, 12014, 12002, 12003, 12001, 12016, 12010,
	12011, 12012, 12004, 12005, 12006, 12008, 12009, 12007,
	14150, 13113, 14130, 13112, 14116, 13021, 13018, 13135,
	13010, 13022, 14001, 13017, 13019, 14157, 14143, 14146,
	14162, 14161, 14119, 13101, 14145, 13111, 13009, 14131,
	14117, 14133, 14154, 14118, 13013, 13144, 14109, 14134,
	14132, 14110, 13106, 14125, 14163, 14156, 13115, 14159,
	14105, 13015, 14141, 14129, 14151, 14158, 13007, 13127,
	14164, 14140, 13006, 13012, 14137, 13014, 13003, 13016,
	14124, 14139, 13128, 14166, 14152, 14138, 14126, 14003,
	13002, 14155, 14160, 14136, 13011, 13004, 13108, 14153,
	13005, 14102, 13001, 14104, 14114, 13020, 13103, 14149,
	14122, 13142, 14107, 14002, 14121, 13008, 14147, 14148,
	14120, 14165,
}

var weaponImageFileOverrides = map[uint32]string{
	13112: "Big Cylinde.webp",
}

var diskSetIDs = []uint32{
	34300, 34400, 32800, 32700, 33700, 31800, 32300, 33300,
	32600, 34100, 31300, 31400, 32200, 33200, 33400, 33800,
	33000, 32500, 31900, 31100, 32900, 33600, 31200, 31500,
	31600, 34000, 34200, 32400, 33500, 31000, 33900, 33100,
}

type remoteIcon struct {
	Icon      string   `json:"icon"`
	Name      string   `json:"en"`
	Rank      uint32   `json:"rank"`
	Specialty uint32   `json:"type"`
	Element   uint32   `json:"element"`
	Potential []uint32 `json:"potential"`
}

type remoteEquipment struct {
	Icon string `json:"icon"`
	Name struct {
		Name  string `json:"name"`
		Desc2 string `json:"desc2"`
		Desc4 string `json:"desc4"`
	} `json:"en"`
}

type HoyoService struct {
	catalogMu      sync.Mutex
	cachedCatalog  HoyoCatalog
	catalogExpires time.Time
}

func (s *HoyoService) GetCatalog() (HoyoCatalog, string) {
	s.catalogMu.Lock()
	if time.Now().Before(s.catalogExpires) {
		catalog := s.cachedCatalog
		s.catalogMu.Unlock()
		return catalog, ""
	}
	s.catalogMu.Unlock()

	catalog, err := loadCatalog()
	if err != nil {
		return HoyoCatalog{}, err.Error()
	}
	if err := addAvatarSkins(&catalog, filepath.Join(constant.RemielleStorageDir, "assets", "filecfg", "AvatarSkinBaseTemplateTb.zon")); err != nil {
		catalog.SkinDataError = err.Error()
	}

	s.catalogMu.Lock()
	s.cachedCatalog = catalog
	s.catalogExpires = time.Now().Add(30 * time.Minute)
	s.catalogMu.Unlock()

	return catalog, ""
}

func addAvatarSkins(catalog *HoyoCatalog, templatePath string) error {
	data, err := os.ReadFile(templatePath)
	if err != nil {
		return fmt.Errorf("could not load Remielle skin data from %s: %w", templatePath, err)
	}

	skins, err := parseAvatarSkinIDs(data)
	if err != nil {
		return fmt.Errorf("could not parse Remielle skin data from %s: %w", templatePath, err)
	}
	for index := range catalog.Characters {
		catalog.Characters[index].SkinIDs = append([]uint32(nil), skins[catalog.Characters[index].ID]...)
	}
	return nil
}

func parseAvatarSkinIDs(data []byte) (map[uint32][]uint32, error) {
	matches := avatarSkinEntryPattern.FindAllSubmatch(data, -1)
	if len(matches) == 0 {
		return nil, fmt.Errorf("template contains no avatar skin entries")
	}

	skins := make(map[uint32][]uint32)
	seen := make(map[uint32]struct{}, len(matches))
	for _, match := range matches {
		skinID, err := strconv.ParseUint(string(match[1]), 10, 32)
		if err != nil || skinID == 0 {
			return nil, fmt.Errorf("template contains invalid skin ID %q", match[1])
		}
		avatarID, err := strconv.ParseUint(string(match[2]), 10, 32)
		if err != nil || avatarID == 0 {
			return nil, fmt.Errorf("template contains invalid avatar ID %q", match[2])
		}
		if _, exists := seen[uint32(skinID)]; exists {
			return nil, fmt.Errorf("template contains duplicate skin ID %d", skinID)
		}
		seen[uint32(skinID)] = struct{}{}
		skins[uint32(avatarID)] = append(skins[uint32(avatarID)], uint32(skinID))
	}
	for avatarID := range skins {
		sort.Slice(skins[avatarID], func(i, j int) bool {
			return skins[avatarID][i] < skins[avatarID][j]
		})
	}
	return skins, nil
}

func loadCatalog() (HoyoCatalog, error) {
	dataURL, err := latestNanokaDataURL(nanokaManifestURL)
	if err != nil {
		return HoyoCatalog{}, err
	}
	return loadCatalogFrom(dataURL)
}

func latestNanokaDataURL(manifestURL string) (string, error) {
	manifest, err := fetchJSON[nanokaManifest](manifestURL)
	if err != nil {
		return "", err
	}

	version := strings.TrimSpace(manifest.ZZZ.Latest)
	if version == "" {
		return "", fmt.Errorf("Nanoka manifest has no latest ZZZ version")
	}
	hasDigit := false
	for _, character := range version {
		switch {
		case character >= '0' && character <= '9':
			hasDigit = true
		case character == '.' || character == '+' || character == '-':
		default:
			return "", fmt.Errorf("Nanoka manifest has invalid latest ZZZ version %q", version)
		}
	}
	if !hasDigit || version == "." || version == ".." {
		return "", fmt.Errorf("Nanoka manifest has invalid latest ZZZ version %q", version)
	}

	return nanokaDataBaseURL + "/" + version, nil
}

func loadCatalogFrom(dataURL string) (HoyoCatalog, error) {
	var characters map[string]remoteIcon
	var weapons map[string]remoteIcon
	var disks map[string]remoteEquipment
	var characterErr, weaponErr, diskErr error

	var wait sync.WaitGroup
	wait.Add(3)
	go func() {
		defer wait.Done()
		characters, characterErr = fetchJSON[map[string]remoteIcon](dataURL + "/character.json")
	}()
	go func() {
		defer wait.Done()
		weapons, weaponErr = fetchJSON[map[string]remoteIcon](dataURL + "/weapon.json")
	}()
	go func() {
		defer wait.Done()
		disks, diskErr = fetchJSON[map[string]remoteEquipment](dataURL + "/equipment.json")
	}()
	wait.Wait()

	for _, fetchErr := range []error{characterErr, weaponErr, diskErr} {
		if fetchErr != nil {
			return HoyoCatalog{}, fetchErr
		}
	}

	catalog := HoyoCatalog{
		Characters: make([]CatalogItem, 0, len(characterIDs)),
		Weapons:    make([]CatalogItem, 0, len(weaponIDs)),
		Disks:      make([]CatalogItem, 0, len(diskSetIDs)),
	}

	for _, id := range characterIDs {
		record := characters[fmt.Sprint(id)]
		item, err := newCatalogItem(id, record.Name, record.Icon)
		if err != nil {
			return HoyoCatalog{}, fmt.Errorf("character %d: %w", id, err)
		}
		item.ImagePath = characterImagePath(id)
		item.Rank = record.Rank
		item.Specialty = record.Specialty
		item.Element = record.Element
		item.PotentialIDs = append([]uint32(nil), record.Potential...)
		catalog.Characters = append(catalog.Characters, item)
	}
	for _, id := range weaponIDs {
		record := weapons[fmt.Sprint(id)]
		item, err := newCatalogItem(id, record.Name, record.Icon)
		if err != nil {
			return HoyoCatalog{}, fmt.Errorf("weapon %d: %w", id, err)
		}
		item.ImagePath = weaponLocalImagePath(id, record.Name, item.ImagePath)
		item.Rank = record.Rank
		catalog.Weapons = append(catalog.Weapons, item)
	}
	for _, id := range diskSetIDs {
		record := disks[fmt.Sprint(id)]
		item, err := newCatalogItem(id, record.Name.Name, record.Icon)
		if err != nil {
			return HoyoCatalog{}, fmt.Errorf("disk set %d: %w", id, err)
		}
		item.TwoPieceEffect = cleanEquipmentDescription(record.Name.Desc2)
		item.FourPieceEffect = cleanEquipmentDescription(record.Name.Desc4)
		catalog.Disks = append(catalog.Disks, item)
	}

	sort.Slice(catalog.Characters, func(i, j int) bool {
		return catalog.Characters[i].Name < catalog.Characters[j].Name
	})
	sort.Slice(catalog.Weapons, func(i, j int) bool {
		return catalog.Weapons[i].Name < catalog.Weapons[j].Name
	})
	sort.Slice(catalog.Disks, func(i, j int) bool {
		return catalog.Disks[i].Name < catalog.Disks[j].Name
	})

	return catalog, nil
}

var equipmentMarkupPattern = regexp.MustCompile(`<[^>]*>`)

func cleanEquipmentDescription(description string) string {
	return strings.TrimSpace(equipmentMarkupPattern.ReplaceAllString(description, ""))
}

func fetchJSON[T any](endpoint string) (T, error) {
	var data T
	client := &http.Client{Timeout: 8 * time.Second}
	response, err := client.Get(endpoint)
	if err != nil {
		return data, fmt.Errorf("could not load Nanoka data from %s: %w", endpoint, err)
	}
	defer response.Body.Close()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return data, fmt.Errorf("Nanoka returned HTTP %d for %s", response.StatusCode, endpoint)
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 16<<20)).Decode(&data); err != nil {
		return data, fmt.Errorf("could not decode Nanoka data from %s: %w", endpoint, err)
	}
	return data, nil
}

func newCatalogItem(id uint32, name, icon string) (CatalogItem, error) {
	imageID, imagePath, err := catalogImagePath(icon)
	if err != nil {
		return CatalogItem{}, err
	}
	if strings.TrimSpace(name) == "" {
		name = fmt.Sprintf("Item %d", id)
	}
	return CatalogItem{ID: id, Name: name, ImageID: imageID, ImagePath: imagePath}, nil
}

func catalogImagePath(icon string) (string, string, error) {
	icon = strings.TrimSpace(icon)
	if icon == "" {
		return "", "", nil
	}
	if strings.Contains(icon, "\\") || strings.HasPrefix(icon, "/") {
		return "", "", fmt.Errorf("invalid Nanoka image path %q", icon)
	}
	for _, segment := range strings.Split(icon, "/") {
		if segment == ".." {
			return "", "", fmt.Errorf("invalid Nanoka image path %q", icon)
		}
	}

	filename := path.Base(icon)
	extension := strings.ToLower(path.Ext(filename))
	switch extension {
	case ".png", ".webp", ".jpg", ".jpeg":
		filename = strings.TrimSuffix(filename, path.Ext(filename))
	}
	if filename == "" || filename == "." || filename == ".." {
		return "", "", fmt.Errorf("invalid Nanoka image name %q", icon)
	}
	for _, character := range filename {
		if !(character >= 'a' && character <= 'z') &&
			!(character >= 'A' && character <= 'Z') &&
			!(character >= '0' && character <= '9') &&
			character != '_' && character != '-' && character != '.' && character != '&' {
			return "", "", fmt.Errorf("invalid Nanoka image name %q", icon)
		}
	}

	category := "disks"
	switch {
	case strings.HasPrefix(filename, "IconRole"):
		category = "characters"
	case strings.HasPrefix(filename, "Weapon_"):
		category = "weapons"
	}
	return filename, "/hoyo/" + category + "/" + filename + ".webp", nil
}

func characterImagePath(id uint32) string {
	filename, ok := characterImageFiles[id]
	if !ok {
		return ""
	}
	return "/hoyo/characters/" + filename
}

func weaponLocalImagePath(id uint32, name, fallbackPath string) string {
	filename, ok := weaponImageFileOverrides[id]
	if !ok {
		filename = strings.TrimSpace(strings.ReplaceAll(name, "'", ""))
		if filename == "" || filename == "." || filename == ".." || strings.HasPrefix(filename, "Item_") {
			return fallbackPath
		}
		for _, character := range filename {
			if !(character >= 'a' && character <= 'z') &&
				!(character >= 'A' && character <= 'Z') &&
				!(character >= '0' && character <= '9') &&
				character != ' ' && character != '_' && character != '-' &&
				character != '.' && character != '&' && character != '[' &&
				character != ']' && character != '(' && character != ')' {
				return fallbackPath
			}
		}
		filename += ".webp"
	}
	return "/hoyo/weapons/" + filename
}
