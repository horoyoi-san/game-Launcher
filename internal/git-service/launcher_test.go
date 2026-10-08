package gitService

import (
	"Cyrene-launcher/pkg/constant"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestFetchLauncherManifest(t *testing.T) {
	checksum := strings.Repeat("a", 64)
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		fmt.Fprintf(writer, `{"version":"2.1.1","sha256":"%s"}`, strings.ToUpper(checksum))
	}))
	defer server.Close()

	manifest, err := fetchLauncherManifest(server.URL)
	if err != nil {
		t.Fatalf("fetchLauncherManifest() error = %v", err)
	}
	if manifest.Version != "2.1.1" {
		t.Fatalf("version = %q, want %q", manifest.Version, "2.1.1")
	}
	if manifest.SHA256 != checksum {
		t.Fatalf("sha256 = %q, want lowercase checksum", manifest.SHA256)
	}
}

func TestFetchLauncherManifestRejectsInvalidFields(t *testing.T) {
	tests := []struct {
		name     string
		response string
	}{
		{name: "invalid version", response: `{"version":"latest","sha256":"` + strings.Repeat("a", 64) + `"}`},
		{name: "invalid checksum", response: `{"version":"2.1.1","sha256":"invalid"}`},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				fmt.Fprint(writer, test.response)
			}))
			defer server.Close()

			if _, err := fetchLauncherManifest(server.URL); err == nil {
				t.Fatal("fetchLauncherManifest() succeeded; want an error")
			}
		})
	}
}

func TestUpdateLauncherProgressDisabledInDevelopmentBuild(t *testing.T) {
	if constant.LauncherUpdatesEnabled {
		t.Skip("launcher updates are enabled in production builds")
	}

	if ok, err := (&GitService{}).UpdateLauncherProgress("2.1.1"); ok || err != "launcher updates are disabled in development builds" {
		t.Fatalf("UpdateLauncherProgress() = (%t, %q), want (false, development-build error)", ok, err)
	}
}
