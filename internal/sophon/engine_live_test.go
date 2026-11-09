package sophon

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestLiveSophonMetadataProtocol(t *testing.T) {
	if os.Getenv("SOPHON_LIVE_CHECK") != "1" {
		t.Skip("set SOPHON_LIVE_CHECK=1 to contact public game metadata endpoints")
	}

	request := Request{
		Config: BuildConfig{
			BranchesURL: "https://sg-hyp-api.hoyoverse.com/hyp/hyp-connect/api/getGameBranches",
			BuildURL:    "https://sg-public-api.hoyoverse.com/downloader/sophon_chunk/api/getBuild",
			PlatformApp: "ddxf6vlr1reo",
		},
		GameID:   "gopR6Cufr3",
		Package:  "game",
		Region:   "OSREL",
		Branch:   "main",
		Launcher: "VYTpXlbWo8",
	}
	client := newHTTPClient()
	defer client.CloseIdleConnections()
	branch, err := fetchBranch(context.Background(), client, request)
	if err != nil {
		t.Fatal(err)
	}
	build, err := fetchBuild(context.Background(), client, request, branch)
	if err != nil {
		t.Fatal(err)
	}
	entry, ok := findManifest(build.Data.Manifests, request.Package)
	if !ok {
		t.Fatal("live game build did not return the game package")
	}
	manifestURL, err := joinDownloadURL(entry.ManifestDownload.URLPrefix, entry.Manifest.ID, entry.ManifestDownload.URLSuffix)
	if err != nil {
		t.Fatal(err)
	}
	data, err := getBytes(context.Background(), client, manifestURL, maxManifestSize)
	if err != nil {
		t.Fatal(err)
	}
	if entry.ManifestDownload.Compression == 1 {
		data, err = decompressZstd(data, maxManifestSize)
		if err != nil {
			t.Fatal(err)
		}
	}
	if !matchesMD5(data, entry.Manifest.Checksum) {
		t.Fatal("live manifest checksum did not match")
	}
	assets, err := parseManifest(data)
	if err != nil {
		t.Fatal(err)
	}
	seenPaths := make(map[string]struct{}, len(assets))
	root := t.TempDir()
	for _, file := range assets {
		path, err := safeAssetPath(root, file.name)
		if err != nil {
			t.Fatal(err)
		}
		pathKey := strings.ToLower(filepath.Clean(path))
		if _, exists := seenPaths[pathKey]; exists {
			t.Fatalf("live manifest contains duplicate path %q", file.name)
		}
		seenPaths[pathKey] = struct{}{}
		for _, part := range file.chunks {
			if err := validateChunkBounds(file, part); err != nil {
				t.Fatalf("live manifest has invalid chunk in %q: %v", file.name, err)
			}
		}
	}
	var selected *asset
	for i := range assets {
		if !assets[i].isDir && len(assets[i].chunks) > 0 {
			selected = &assets[i]
			break
		}
	}
	if selected == nil {
		t.Fatal("live manifest contains no downloadable asset")
	}
	part := selected.chunks[0]
	chunkURL, err := joinDownloadURL(entry.ChunkDownload.URLPrefix, part.name, entry.ChunkDownload.URLSuffix)
	if err != nil {
		t.Fatal(err)
	}
	chunkData, err := getBytes(context.Background(), client, chunkURL, maxChunkSize)
	if err != nil {
		t.Fatal(err)
	}
	if int64(len(chunkData)) != part.size {
		t.Fatalf("live chunk size = %d, want %d", len(chunkData), part.size)
	}
	if entry.ChunkDownload.Compression == 1 {
		chunkData, err = decompressZstd(chunkData, maxChunkSize)
		if err != nil {
			t.Fatal(err)
		}
	}
	if int64(len(chunkData)) != part.expandedSize || !matchesMD5(chunkData, part.hash) {
		t.Fatal("live chunk size or checksum did not match")
	}
	t.Logf("live version %s contains %d assets", build.Data.Tag, len(assets))
}

func newHTTPClient() *http.Client {
	return &http.Client{Timeout: 45 * time.Second}
}

func getBytes(ctx context.Context, client *http.Client, address string, limit int64) ([]byte, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, address, nil)
	if err != nil {
		return nil, err
	}
	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("server returned %s", response.Status)
	}
	return io.ReadAll(io.LimitReader(response.Body, limit+1))
}
