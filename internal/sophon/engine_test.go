package sophon

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/klauspost/compress/zstd"
	"google.golang.org/protobuf/encoding/protowire"
)

func TestDownloadWritesAndReusesVerifiedFiles(t *testing.T) {
	want := []byte("native Sophon download")
	chunkHash := md5Hex(want)
	compressedChunk := compressTestData(t, want)
	manifestData := testManifest("Game/Assembly-CSharp.dll", want, chunkHash, "chunk-1", int64(len(compressedChunk)))
	compressedManifest := compressTestData(t, manifestData)
	var chunkRequests atomic.Int64

	var server *httptest.Server
	server = httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/branches":
			if request.URL.Query().Get("game_ids[]") != "game-id" || request.URL.Query().Get("launcher_id") != "launcher-id" {
				t.Errorf("branch query = %s", request.URL.RawQuery)
			}
			_, _ = writer.Write([]byte(`{"retcode":0,"data":{"game_branches":[{"game":{"id":"game-id"},"main":{"package_id":"package-id","password":"password","tag":"1.0.0"}}]}}`))
		case "/build":
			if request.URL.Query().Get("package_id") != "package-id" || request.URL.Query().Get("branch") != "main" {
				t.Errorf("build query = %s", request.URL.RawQuery)
			}
			response := map[string]any{
				"retcode": 0,
				"data": map[string]any{
					"tag": "1.0.0",
					"manifests": []any{map[string]any{
						"matching_field":    "game",
						"manifest":          map[string]any{"id": "manifest-id", "checksum": md5Hex(manifestData)},
						"manifest_download": map[string]any{"compression": 1, "url_prefix": server.URL + "/manifests"},
						"chunk_download":    map[string]any{"compression": 1, "url_prefix": server.URL + "/chunks", "url_suffix": "?token=test"},
					}},
				},
			}
			if err := json.NewEncoder(writer).Encode(response); err != nil {
				t.Errorf("write build response: %v", err)
			}
		case "/manifests/manifest-id":
			_, _ = writer.Write(compressedManifest)
		case "/chunks/chunk-1":
			if request.URL.Query().Get("token") != "test" {
				t.Errorf("chunk query = %s", request.URL.RawQuery)
			}
			chunkRequests.Add(1)
			_, _ = writer.Write(compressedChunk)
		default:
			http.NotFound(writer, request)
		}
	}))
	defer server.Close()

	request := Request{
		Config: BuildConfig{
			BranchesURL: server.URL + "/branches",
			BuildURL:    server.URL + "/build",
			PlatformApp: "platform",
		},
		GameID:   "game-id",
		Package:  "game",
		Version:  "1.0.0",
		Output:   t.TempDir(),
		Region:   "OSREL",
		Branch:   "main",
		Launcher: "launcher-id",
	}

	for run := 0; run < 2; run++ {
		if err := Download(context.Background(), request, Controls{}, nil); err != nil {
			t.Fatalf("Download() run %d error = %v", run+1, err)
		}
	}
	path := filepath.Join(request.Output, filepath.FromSlash("Game/Assembly-CSharp.dll"))
	if err := os.WriteFile(path, []byte("damaged"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := Download(context.Background(), request, Controls{}, nil); err != nil {
		t.Fatalf("Download() repair run error = %v", err)
	}
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, want) {
		t.Fatalf("downloaded file = %q, want %q", got, want)
	}
	if chunkRequests.Load() != 2 {
		t.Fatalf("chunk requests = %d, want 2", chunkRequests.Load())
	}
}

func TestParseManifestRejectsUnsafeAssetPaths(t *testing.T) {
	data := testManifest("../outside.bin", []byte("x"), md5Hex([]byte("x")), "chunk", 1)
	assets, err := parseManifest(data)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := safeAssetPath(t.TempDir(), assets[0].name); err == nil {
		t.Fatal("safeAssetPath() accepted a path traversal")
	}
}

func TestFindManifestSelectsRequestedPackage(t *testing.T) {
	entries := []manifestEntry{
		{MatchingField: "game"},
		{MatchingField: "en-us"},
	}
	selected, ok := findManifest(entries, "en-us")
	if !ok || selected.MatchingField != "en-us" {
		t.Fatalf("findManifest() = (%q, %t), want (en-us, true)", selected.MatchingField, ok)
	}
}

func TestGetJSONRetriesTransientServerErrors(t *testing.T) {
	var requests atomic.Int64
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if requests.Add(1) < 3 {
			http.Error(writer, "temporarily unavailable", http.StatusServiceUnavailable)
			return
		}
		_, _ = writer.Write([]byte(`{"retcode":0}`))
	}))
	defer server.Close()

	response, err := getJSON[struct {
		RetCode int `json:"retcode"`
	}](context.Background(), server.Client(), server.URL, 1024)
	if err != nil {
		t.Fatalf("getJSON() error = %v", err)
	}
	if response.RetCode != 0 {
		t.Fatalf("response retcode = %d, want 0", response.RetCode)
	}
	if requests.Load() != 3 {
		t.Fatalf("request count = %d, want 3", requests.Load())
	}
}

func TestRequestErrorDoesNotExposeURLQuery(t *testing.T) {
	address := "https://api.example.test/getBuild?password=private-value"
	err := requestError(address, &url.Error{
		Op:  "Get",
		URL: address,
		Err: errors.New("connection timed out"),
	})
	if strings.Contains(err.Error(), "private-value") {
		t.Fatalf("request error exposed query parameter: %v", err)
	}
	if !strings.Contains(err.Error(), "api.example.test") {
		t.Fatalf("request error omitted host: %v", err)
	}
}

func TestDecompressZstdHonorsLimit(t *testing.T) {
	data := compressTestData(t, []byte(strings.Repeat("x", 1024)))
	if _, err := decompressZstd(data, 32); err == nil {
		t.Fatal("decompressZstd() accepted output larger than the limit")
	}
}

func testManifest(name string, data []byte, digest, chunkName string, compressedSize int64) []byte {
	chunkData := protowire.AppendTag(nil, 1, protowire.BytesType)
	chunkData = protowire.AppendString(chunkData, chunkName)
	chunkData = protowire.AppendTag(chunkData, 2, protowire.BytesType)
	chunkData = protowire.AppendString(chunkData, digest)
	chunkData = protowire.AppendTag(chunkData, 3, protowire.VarintType)
	chunkData = protowire.AppendVarint(chunkData, 0)
	chunkData = protowire.AppendTag(chunkData, 4, protowire.VarintType)
	chunkData = protowire.AppendVarint(chunkData, uint64(compressedSize))
	chunkData = protowire.AppendTag(chunkData, 5, protowire.VarintType)
	chunkData = protowire.AppendVarint(chunkData, uint64(len(data)))

	assetData := protowire.AppendTag(nil, 1, protowire.BytesType)
	assetData = protowire.AppendString(assetData, name)
	assetData = protowire.AppendTag(assetData, 2, protowire.BytesType)
	assetData = protowire.AppendBytes(assetData, chunkData)
	assetData = protowire.AppendTag(assetData, 4, protowire.VarintType)
	assetData = protowire.AppendVarint(assetData, uint64(len(data)))
	assetData = protowire.AppendTag(assetData, 5, protowire.BytesType)
	assetData = protowire.AppendString(assetData, digest)

	manifest := protowire.AppendTag(nil, 1, protowire.BytesType)
	return protowire.AppendBytes(manifest, assetData)
}

func compressTestData(t *testing.T, data []byte) []byte {
	t.Helper()
	encoder, err := zstd.NewWriter(nil)
	if err != nil {
		t.Fatal(err)
	}
	defer encoder.Close()
	return encoder.EncodeAll(data, nil)
}

func md5Hex(data []byte) string {
	sum := md5.Sum(data)
	return hex.EncodeToString(sum[:])
}

func TestParseManifestRejectsMalformedProtobuf(t *testing.T) {
	_, err := parseManifest([]byte{0x0a, 0xff})
	if err == nil {
		t.Fatal("parseManifest() accepted malformed protobuf")
	}
}
