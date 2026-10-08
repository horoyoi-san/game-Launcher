package appService

import (
	"Cyrene-launcher/pkg/constant"
	"testing"
)

func TestGetCurrentLauncherVersion(t *testing.T) {
	ok, version := (&AppService{}).GetCurrentLauncherVersion()
	if !ok {
		t.Fatal("GetCurrentLauncherVersion() returned false")
	}

	if constant.LauncherUpdatesEnabled && version != constant.CurrentLauncherVersion {
		t.Fatalf("version = %q, want production version %q", version, constant.CurrentLauncherVersion)
	}
	if !constant.LauncherUpdatesEnabled && version != "Development" {
		t.Fatalf("version = %q, want Development", version)
	}
}
