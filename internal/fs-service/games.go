package fsService

import "fmt"

type GameConfig struct {
	ID      string              `json:"id"`
	Name    string              `json:"name"`
	Package string              `json:"package"`
	Region  string              `json:"region"`
	GameIDs map[string][]string `json:"gameIds"`
	Output  string              `json:"output"`
}

var gameConfigs = []GameConfig{
	{
		ID: "Impact3rd", Name: "Honkai Impact 3rd", Package: "game", Region: "CN | OS", Output: "GameData/HonkaiImpact3rd",
		GameIDs: map[string][]string{
			"gameid":                           {"gameid"},
			"OSREL Europe & Americas Servers":  {"5TIVvvcwtM"},
			"OSREL JP Server":                  {"g0mMIvshDb"},
			"OSREL KR Server":                  {"uxB4MC7nzC"},
			"OSREL SEA Server":                 {"bxPTXSET5t"},
			"OSREL Asia (Traditional Chinese)": {"wkE5P5WsIf"},
			"CNREL":                            {"osvnlOc0S8"},
		},
	},
	{
		ID: "Genshin", Name: "Genshin Impact", Package: "game", Region: "CN | OS", Output: "GameData/GenshinImpact",
		GameIDs: map[string][]string{"gameid": {"gameid"}, "OSREL": {"gopR6Cufr3"}, "CNREL": {"1Z8W5NHUQb"}},
	},
	{
		ID: "StarRail", Name: "Honkai: Star Rail", Package: "game", Region: "CN | OS", Output: "GameData/HonkaiStarRail",
		GameIDs: map[string][]string{"gameid": {"gameid"}, "OSREL": {"4ziysqXOQ8"}, "CNREL": {"64kMb5iAWu"}},
	},
	{
		ID: "Zenless", Name: "Zenless Zone Zero", Package: "game", Region: "CN | OS", Output: "GameData/ZenlessZoneZero",
		GameIDs: map[string][]string{"gameid": {"gameid"}, "OSREL": {"U5hbdsT9W7"}, "CNREL": {"x6znKlJ0xK"}},
	},
	{
		ID: "Nexusanima", Name: "Honkai: Nexus anima", Package: "game", Region: "CN | OS", Output: "GameData/HonkaiNexusanima",
		GameIDs: map[string][]string{
			"gameid": {"gameid"},
			"OSREL":  {"yneO4yGc4x"},
			"CNREL":  {"m8TGERqknS"},
			"OSBETA": {"4qvmDrMwKS", "IWISpEcDbC"},
			"CNBETA": {"j7rlly0oYR", "lgyIM35mz8"},
		},
	},
	{
		ID: "PetitPlanet", Name: "Petit Planet", Package: "game", Region: "CN | OS", Output: "GameData/PetitPlanet",
		GameIDs: map[string][]string{
			"gameid": {"gameid"},
			"OSREL":  {"viiywh5G2H", "a26PNg1Mgk"},
			"CNREL":  {"ERYDdvf0w8"},
			"OSBETA": {"679gqJWz4L"},
			"CNBETA": {"0fijU7nET7", "Dg5IUTLSzd"},
		},
	},
	{
		ID: "TheWeavers", Name: "The Weavers", Package: "game", Region: "CN | OS", Output: "GameData/TheWeavers",
		GameIDs: map[string][]string{"gameid": {"gameid"}, "CNBETA": {"pkMBmK7jxJ"}},
	},
}

func (f *FSService) GetGameConfig(gameID string) (GameConfig, error) {
	for _, game := range gameConfigs {
		if game.ID == gameID {
			return game, nil
		}
	}
	return GameConfig{}, fmt.Errorf("game configuration not found: %s", gameID)
}
