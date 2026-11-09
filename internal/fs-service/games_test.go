package fsService

import "testing"

func TestGameConfigsHaveLaunchExecutables(t *testing.T) {
	for _, config := range gameConfigs {
		t.Run(config.ID, func(t *testing.T) {
			if config.Executable == "" {
				t.Fatal("game executable is not configured")
			}
			if len(config.GameIDs) == 0 {
				t.Fatal("Sophon game IDs are not configured")
			}
		})
	}
}
