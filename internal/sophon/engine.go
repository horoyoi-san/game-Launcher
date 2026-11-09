package sophon

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"hash"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/klauspost/compress/zstd"
	"google.golang.org/protobuf/encoding/protowire"
)

const (
	maxManifestSize = 128 << 20
	maxChunkSize    = 64 << 20
	downloadWorkers = 4
)

type BuildConfig struct {
	BranchesURL string
	BuildURL    string
	PlatformApp string
}

type Request struct {
	Config   BuildConfig
	GameID   string
	Package  string
	Version  string
	Output   string
	Region   string
	Branch   string
	Launcher string
}

type Progress struct {
	Stage           string `json:"stage"`
	CurrentFile     string `json:"currentFile,omitempty"`
	FilesDone       int64  `json:"filesDone"`
	FilesTotal      int64  `json:"filesTotal"`
	BytesDone       int64  `json:"bytesDone"`
	BytesTotal      int64  `json:"bytesTotal"`
	DownloadedBytes int64  `json:"downloadedBytes"`
	SpeedBytesSec   int64  `json:"speedBytesPerSecond"`
}

type Controls struct {
	Wait func(context.Context) error
}

type branchResponse struct {
	RetCode int    `json:"retcode"`
	Message string `json:"message"`
	Data    struct {
		GameBranches []struct {
			Game struct {
				ID string `json:"id"`
			} `json:"game"`
			Main        *branchBuild `json:"main"`
			PreDownload *branchBuild `json:"pre_download"`
		} `json:"game_branches"`
	} `json:"data"`
}

type branchBuild struct {
	PackageID string `json:"package_id"`
	Password  string `json:"password"`
	Tag       string `json:"tag"`
}

type buildResponse struct {
	RetCode int    `json:"retcode"`
	Message string `json:"message"`
	Data    struct {
		Tag       string          `json:"tag"`
		Manifests []manifestEntry `json:"manifests"`
	} `json:"data"`
}

type manifestEntry struct {
	MatchingField string `json:"matching_field"`
	Manifest      struct {
		ID       string `json:"id"`
		Checksum string `json:"checksum"`
	} `json:"manifest"`
	ManifestDownload downloadInfo `json:"manifest_download"`
	ChunkDownload    downloadInfo `json:"chunk_download"`
}

type downloadInfo struct {
	Encryption  int    `json:"encryption"`
	Compression int    `json:"compression"`
	URLPrefix   string `json:"url_prefix"`
	URLSuffix   string `json:"url_suffix"`
}

type asset struct {
	name   string
	size   int64
	hash   string
	isDir  bool
	chunks []chunk
}

type chunk struct {
	name         string
	hash         string
	offset       int64
	size         int64
	expandedSize int64
}

type transferState struct {
	root        string
	chunkURL    string
	chunkSuffix string
	compressed  bool
	client      *http.Client
	controls    Controls
	onProgress  func(Progress)
	totalBytes  int64
	totalFiles  int64
	bytesDone   atomic.Int64
	downloaded  atomic.Int64
	filesDone   atomic.Int64
	started     time.Time
}

func Download(ctx context.Context, request Request, controls Controls, onProgress func(Progress)) error {
	if request.Config.BranchesURL == "" || request.Config.BuildURL == "" || request.Config.PlatformApp == "" {
		return fmt.Errorf("incomplete Sophon endpoint configuration for region %s", request.Region)
	}
	if request.GameID == "" || request.Launcher == "" || request.Package == "" || request.Output == "" {
		return fmt.Errorf("game, launcher, package and output are required")
	}
	if request.Branch != "main" && request.Branch != "pre_download" {
		return fmt.Errorf("unsupported game branch %q", request.Branch)
	}

	root, err := filepath.Abs(request.Output)
	if err != nil {
		return fmt.Errorf("resolve install directory: %w", err)
	}
	if err := os.MkdirAll(root, 0755); err != nil {
		return fmt.Errorf("create install directory: %w", err)
	}

	client := &http.Client{
		Timeout: 2 * time.Minute,
		Transport: &http.Transport{
			Proxy:               http.ProxyFromEnvironment,
			MaxIdleConns:        downloadWorkers * 2,
			MaxIdleConnsPerHost: downloadWorkers,
			MaxConnsPerHost:     downloadWorkers,
			IdleConnTimeout:     90 * time.Second,
		},
	}
	defer client.CloseIdleConnections()

	state := &transferState{
		root:       root,
		client:     client,
		controls:   controls,
		onProgress: onProgress,
		started:    time.Now(),
	}
	state.emit("Resolving build", "")

	branch, err := fetchBranch(ctx, client, request)
	if err != nil {
		return err
	}
	build, err := fetchBuild(ctx, client, request, branch)
	if err != nil {
		return err
	}

	entry, ok := findManifest(build.Data.Manifests, request.Package)
	if !ok {
		return fmt.Errorf("package %q is not available for %s %s", request.Package, request.GameID, build.Data.Tag)
	}
	if entry.ManifestDownload.Encryption != 0 || entry.ChunkDownload.Encryption != 0 {
		return fmt.Errorf("encrypted Sophon packages are not supported")
	}
	if entry.ManifestDownload.Compression != 0 && entry.ManifestDownload.Compression != 1 {
		return fmt.Errorf("unsupported Sophon manifest compression %d", entry.ManifestDownload.Compression)
	}
	if entry.ChunkDownload.Compression != 0 && entry.ChunkDownload.Compression != 1 {
		return fmt.Errorf("unsupported Sophon chunk compression %d", entry.ChunkDownload.Compression)
	}

	manifestURL, err := joinDownloadURL(entry.ManifestDownload.URLPrefix, entry.Manifest.ID, entry.ManifestDownload.URLSuffix)
	if err != nil {
		return fmt.Errorf("invalid manifest URL: %w", err)
	}
	state.emit("Fetching manifest", "")
	manifestData, err := state.readURL(ctx, manifestURL, maxManifestSize)
	if err != nil {
		return fmt.Errorf("download manifest: %w", err)
	}
	if entry.ManifestDownload.Compression == 1 {
		manifestData, err = decompressZstd(manifestData, maxManifestSize)
		if err != nil {
			return fmt.Errorf("decompress manifest: %w", err)
		}
	}
	if entry.Manifest.Checksum != "" && !matchesMD5(manifestData, entry.Manifest.Checksum) {
		return fmt.Errorf("manifest checksum mismatch")
	}
	assets, err := parseManifest(manifestData)
	if err != nil {
		return fmt.Errorf("parse manifest: %w", err)
	}
	if len(assets) == 0 {
		return fmt.Errorf("manifest contains no files for package %q", request.Package)
	}

	chunkPrefix := strings.TrimRight(entry.ChunkDownload.URLPrefix, "/")
	if chunkPrefix == "" {
		return fmt.Errorf("Sophon build response has no chunk URL")
	}
	if err := validateDownloadURL(chunkPrefix); err != nil {
		return fmt.Errorf("invalid chunk URL: %w", err)
	}
	state.chunkURL = chunkPrefix + "/"
	state.chunkSuffix = entry.ChunkDownload.URLSuffix
	state.compressed = entry.ChunkDownload.Compression == 1
	seenPaths := make(map[string]struct{}, len(assets))
	for _, file := range assets {
		if file.size < 0 {
			return fmt.Errorf("manifest contains invalid size for %q", file.name)
		}
		path, err := safeAssetPath(root, file.name)
		if err != nil {
			return err
		}
		pathKey := strings.ToLower(filepath.Clean(path))
		if _, exists := seenPaths[pathKey]; exists {
			return fmt.Errorf("manifest contains duplicate path %q", file.name)
		}
		seenPaths[pathKey] = struct{}{}
		if file.hash != "" && !isMD5(file.hash) {
			return fmt.Errorf("manifest contains invalid MD5 for %q", file.name)
		}
		for _, part := range file.chunks {
			if err := validateChunkBounds(file, part); err != nil {
				return fmt.Errorf("invalid chunk in %q: %w", file.name, err)
			}
		}
		state.totalBytes += file.size
	}
	state.totalFiles = int64(len(assets))
	state.emit("Downloading files", "")
	return state.downloadAssets(ctx, assets)
}

func fetchBranch(ctx context.Context, client *http.Client, request Request) (*branchBuild, error) {
	branchURL, err := url.Parse(request.Config.BranchesURL)
	if err != nil {
		return nil, fmt.Errorf("invalid branches URL: %w", err)
	}
	query := branchURL.Query()
	query.Add("game_ids[]", request.GameID)
	query.Set("launcher_id", request.Launcher)
	branchURL.RawQuery = query.Encode()

	data, err := getJSON[branchResponse](ctx, client, branchURL.String(), 4<<20)
	if err != nil {
		return nil, fmt.Errorf("fetch game branch: %w", err)
	}
	if data.RetCode != 0 {
		return nil, fmt.Errorf("game branch API error %d: %s", data.RetCode, data.Message)
	}
	for _, item := range data.Data.GameBranches {
		if item.Game.ID != request.GameID {
			continue
		}
		build := item.Main
		if request.Branch == "pre_download" {
			build = item.PreDownload
		}
		if build == nil {
			return nil, fmt.Errorf("branch %q is not available for game %s", request.Branch, request.GameID)
		}
		if request.Version != "" && build.Tag != "" && build.Tag != request.Version {
			return nil, fmt.Errorf("selected version %s is no longer available; current version is %s", request.Version, build.Tag)
		}
		if build.PackageID == "" {
			return nil, fmt.Errorf("game branch response is missing package ID")
		}
		return build, nil
	}
	return nil, fmt.Errorf("game %s was not found in the branch response", request.GameID)
}

func fetchBuild(ctx context.Context, client *http.Client, request Request, branch *branchBuild) (*buildResponse, error) {
	buildURL, err := url.Parse(request.Config.BuildURL)
	if err != nil {
		return nil, fmt.Errorf("invalid build URL: %w", err)
	}
	apiBranch := request.Branch
	if apiBranch == "pre_download" {
		apiBranch = "predownload"
	}
	query := buildURL.Query()
	query.Set("branch", apiBranch)
	query.Set("package_id", branch.PackageID)
	query.Set("password", branch.Password)
	query.Set("plat_app", request.Config.PlatformApp)
	if request.Branch == "pre_download" && request.Version != "" {
		query.Set("tag", request.Version)
	}
	buildURL.RawQuery = query.Encode()

	data, err := getJSON[buildResponse](ctx, client, buildURL.String(), 8<<20)
	if err != nil {
		return nil, fmt.Errorf("fetch game build: %w", err)
	}
	if data.RetCode != 0 {
		return nil, fmt.Errorf("game build API error %d: %s", data.RetCode, data.Message)
	}
	if len(data.Data.Manifests) == 0 {
		return nil, fmt.Errorf("game build response contains no package manifests")
	}
	return data, nil
}

func findManifest(entries []manifestEntry, matchingField string) (manifestEntry, bool) {
	for _, entry := range entries {
		if entry.MatchingField == matchingField {
			return entry, true
		}
	}
	return manifestEntry{}, false
}

func (s *transferState) downloadAssets(ctx context.Context, assets []asset) error {
	jobs := make(chan asset)
	var workers sync.WaitGroup
	var firstErr error
	var errOnce sync.Once
	workerCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	for i := 0; i < downloadWorkers; i++ {
		workers.Add(1)
		go func() {
			defer workers.Done()
			for file := range jobs {
				if err := s.downloadAsset(workerCtx, file); err != nil {
					errOnce.Do(func() {
						firstErr = err
						cancel()
					})
					return
				}
			}
		}()
	}

enqueue:
	for _, file := range assets {
		select {
		case <-workerCtx.Done():
			break enqueue
		case jobs <- file:
		}
	}
	close(jobs)
	workers.Wait()
	if firstErr != nil {
		return firstErr
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	s.emit("Complete", "")
	return nil
}

func (s *transferState) downloadAsset(ctx context.Context, file asset) error {
	target, err := safeAssetPath(s.root, file.name)
	if err != nil {
		return err
	}
	if file.isDir {
		if err := ensureNoSymlinkParents(s.root, target); err != nil {
			return err
		}
		if info, err := os.Lstat(target); err == nil && info.Mode()&os.ModeSymlink != 0 {
			return fmt.Errorf("refusing to create directory through symbolic link %s", target)
		} else if err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("inspect game directory %s: %w", target, err)
		}
		if err := os.MkdirAll(target, 0755); err != nil {
			return fmt.Errorf("create game directory %q: %w", file.name, err)
		}
		s.filesDone.Add(1)
		s.emit("Downloading files", file.name)
		return nil
	}

	if existing, err := os.Open(target); err == nil {
		info, statErr := existing.Stat()
		if statErr != nil {
			_ = existing.Close()
			return fmt.Errorf("inspect existing file %q: %w", file.name, statErr)
		}
		if info.Size() == file.size && file.hash != "" {
			matches, hashErr := hasherMatches(existing, file.size, file.hash)
			_ = existing.Close()
			if hashErr != nil {
				return fmt.Errorf("verify existing file %q: %w", file.name, hashErr)
			}
			if matches {
				s.bytesDone.Add(file.size)
				s.filesDone.Add(1)
				s.emit("Downloading files", file.name)
				return nil
			}
		} else {
			_ = existing.Close()
		}
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("open existing file %q: %w", file.name, err)
	}

	if len(file.chunks) == 0 && file.size != 0 {
		return fmt.Errorf("manifest file %q has no chunks", file.name)
	}
	if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
		return fmt.Errorf("create directory for %q: %w", file.name, err)
	}
	if err := ensureNoSymlinkParents(s.root, target); err != nil {
		return err
	}
	tempPath := target + ".sophon-part"
	for _, path := range []string{target, tempPath} {
		if info, err := os.Lstat(path); err == nil && info.Mode()&os.ModeSymlink != 0 {
			return fmt.Errorf("refusing to write through symbolic link %s", path)
		} else if err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("inspect download path %s: %w", path, err)
		}
	}
	output, err := os.OpenFile(tempPath, os.O_CREATE|os.O_RDWR, 0644)
	if err != nil {
		return fmt.Errorf("create temporary file for %q: %w", file.name, err)
	}
	defer output.Close()
	if err := output.Truncate(file.size); err != nil {
		return fmt.Errorf("size temporary file for %q: %w", file.name, err)
	}

	if old, err := os.Open(target); err == nil {
		info, statErr := old.Stat()
		if statErr != nil {
			_ = old.Close()
			return fmt.Errorf("inspect existing file %q: %w", file.name, statErr)
		}
		copySize := info.Size()
		if copySize > file.size {
			copySize = file.size
		}
		_, copyErr := io.CopyN(output, old, copySize)
		closeErr := old.Close()
		if copyErr != nil {
			return fmt.Errorf("reuse existing file %q: %w", file.name, copyErr)
		}
		if closeErr != nil {
			return fmt.Errorf("close existing file %q: %w", file.name, closeErr)
		}
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("open existing file %q for reuse: %w", file.name, err)
	}
	for _, part := range file.chunks {
		if err := s.wait(ctx); err != nil {
			return err
		}
		if err := validateChunkBounds(file, part); err != nil {
			return fmt.Errorf("invalid chunk in %q: %w", file.name, err)
		}
		if part.hash != "" {
			matches, err := rangeMatches(output, part.offset, part.expandedSize, part.hash)
			if err != nil {
				return fmt.Errorf("verify chunk in %q: %w", file.name, err)
			}
			if matches {
				s.bytesDone.Add(part.expandedSize)
				s.emit("Downloading files", file.name)
				continue
			}
		}
		chunkURL := s.chunkURL + url.PathEscape(part.name) + s.chunkSuffix
		payload, err := s.readURL(ctx, chunkURL, maxChunkSize)
		if err != nil {
			return fmt.Errorf("download chunk %q for %q: %w", part.name, file.name, err)
		}
		if part.size > 0 && int64(len(payload)) != part.size {
			return fmt.Errorf("chunk %q downloaded as %d bytes, expected %d", part.name, len(payload), part.size)
		}
		if s.compressed {
			payload, err = decompressZstd(payload, maxChunkSize)
			if err != nil {
				return fmt.Errorf("decompress chunk %q: %w", part.name, err)
			}
		}
		if int64(len(payload)) != part.expandedSize {
			return fmt.Errorf("chunk %q expanded to %d bytes, expected %d", part.name, len(payload), part.expandedSize)
		}
		if part.hash != "" && !matchesMD5(payload, part.hash) {
			return fmt.Errorf("chunk %q checksum mismatch", part.name)
		}
		if _, err := output.WriteAt(payload, part.offset); err != nil {
			return fmt.Errorf("write chunk %q into %q: %w", part.name, file.name, err)
		}
		s.bytesDone.Add(part.expandedSize)
		s.downloaded.Add(part.expandedSize)
		s.emit("Downloading files", file.name)
	}

	if err := output.Sync(); err != nil {
		return fmt.Errorf("flush temporary file %q: %w", file.name, err)
	}
	if file.hash != "" {
		matches, err := hasherMatches(output, file.size, file.hash)
		if err != nil {
			return fmt.Errorf("verify file %q: %w", file.name, err)
		}
		if !matches {
			return fmt.Errorf("file checksum mismatch: %s", file.name)
		}
	}
	if err := output.Close(); err != nil {
		return fmt.Errorf("close temporary file %q: %w", file.name, err)
	}
	if err := os.Rename(tempPath, target); err != nil {
		return fmt.Errorf("install downloaded file %q: %w", file.name, err)
	}
	s.filesDone.Add(1)
	s.emit("Downloading files", file.name)
	return nil
}

func (s *transferState) emit(stage, currentFile string) {
	if s.onProgress == nil {
		return
	}
	elapsed := time.Since(s.started).Seconds()
	bytesDone := s.bytesDone.Load()
	downloaded := s.downloaded.Load()
	speed := int64(0)
	if elapsed > 0 {
		speed = int64(float64(downloaded) / elapsed)
	}
	s.onProgress(Progress{
		Stage:           stage,
		CurrentFile:     currentFile,
		FilesDone:       s.filesDone.Load(),
		FilesTotal:      s.totalFiles,
		BytesDone:       bytesDone,
		BytesTotal:      s.totalBytes,
		DownloadedBytes: downloaded,
		SpeedBytesSec:   speed,
	})
}

func (s *transferState) wait(ctx context.Context) error {
	if s.controls.Wait == nil {
		return ctx.Err()
	}
	return s.controls.Wait(ctx)
}

func (s *transferState) readURL(ctx context.Context, address string, limit int64) ([]byte, error) {
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if err := s.wait(ctx); err != nil {
			return nil, err
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, address, nil)
		if err != nil {
			return nil, err
		}
		response, err := s.client.Do(req)
		if err == nil {
			if response.StatusCode >= 200 && response.StatusCode < 300 {
				data, readErr := io.ReadAll(io.LimitReader(response.Body, limit+1))
				closeErr := response.Body.Close()
				if readErr != nil {
					return nil, readErr
				}
				if closeErr != nil {
					return nil, closeErr
				}
				if int64(len(data)) > limit {
					return nil, fmt.Errorf("response exceeds %d bytes", limit)
				}
				return data, nil
			}
			lastErr = fmt.Errorf("server returned %s", response.Status)
			_ = response.Body.Close()
			if response.StatusCode < 500 && response.StatusCode != http.StatusTooManyRequests {
				return nil, lastErr
			}
		} else {
			lastErr = requestError(address, err)
		}
		if attempt < 2 {
			if err := waitBeforeRetry(ctx, attempt); err != nil {
				return nil, err
			}
		}
	}
	return nil, lastErr
}

func getJSON[T any](ctx context.Context, client *http.Client, address string, limit int64) (*T, error) {
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		request, err := http.NewRequestWithContext(ctx, http.MethodGet, address, nil)
		if err != nil {
			return nil, err
		}
		response, err := client.Do(request)
		if err != nil {
			lastErr = requestError(address, err)
		} else {
			body, readErr := io.ReadAll(io.LimitReader(response.Body, limit+1))
			closeErr := response.Body.Close()
			if readErr != nil {
				lastErr = readErr
			} else if closeErr != nil {
				lastErr = closeErr
			} else if response.StatusCode < 200 || response.StatusCode >= 300 {
				lastErr = fmt.Errorf("server returned %s", response.Status)
				if response.StatusCode < 500 && response.StatusCode != http.StatusTooManyRequests {
					return nil, lastErr
				}
			} else {
				if int64(len(body)) > limit {
					return nil, fmt.Errorf("response exceeds %d bytes", limit)
				}
				var result T
				if err := json.Unmarshal(body, &result); err != nil {
					return nil, err
				}
				return &result, nil
			}
		}
		if attempt < 2 {
			if err := waitBeforeRetry(ctx, attempt); err != nil {
				return nil, err
			}
		}
	}
	return nil, lastErr
}

func waitBeforeRetry(ctx context.Context, attempt int) error {
	timer := time.NewTimer(time.Duration(attempt+1) * time.Second)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func requestError(address string, err error) error {
	host := "configured server"
	if parsed, parseErr := url.Parse(address); parseErr == nil && parsed.Host != "" {
		host = parsed.Host
	}
	var urlErr *url.Error
	if errors.As(err, &urlErr) && urlErr.Err != nil {
		err = urlErr.Err
	}
	return fmt.Errorf("request to %s failed: %w", host, err)
}

func joinDownloadURL(prefix, id, suffix string) (string, error) {
	parsed, err := url.Parse(strings.TrimRight(prefix, "/") + "/" + url.PathEscape(id) + suffix)
	if err != nil {
		return "", err
	}
	if err := validateDownloadURL(parsed.String()); err != nil {
		return "", err
	}
	return parsed.String(), nil
}

func validateDownloadURL(address string) error {
	parsed, err := url.Parse(address)
	if err != nil {
		return err
	}
	if parsed.Host == "" || parsed.User != nil || parsed.Fragment != "" || (parsed.Scheme != "https" && !isLoopbackHTTP(parsed)) {
		return fmt.Errorf("download URL must use HTTPS")
	}
	return nil
}

func isLoopbackHTTP(parsed *url.URL) bool {
	if parsed.Scheme != "http" {
		return false
	}
	host := parsed.Hostname()
	return host == "localhost" || (net.ParseIP(host) != nil && net.ParseIP(host).IsLoopback())
}

func decompressZstd(data []byte, limit int64) ([]byte, error) {
	decoder, err := zstd.NewReader(nil, zstd.WithDecoderMaxMemory(uint64(limit)))
	if err != nil {
		return nil, err
	}
	defer decoder.Close()
	decoded, err := decoder.DecodeAll(data, nil)
	if err != nil {
		return nil, err
	}
	if int64(len(decoded)) > limit {
		return nil, fmt.Errorf("decompressed response exceeds %d bytes", limit)
	}
	return decoded, nil
}

func parseManifest(data []byte) ([]asset, error) {
	var assets []asset
	for len(data) > 0 {
		number, wireType, n := protowire.ConsumeTag(data)
		if n < 0 {
			return nil, protowire.ParseError(n)
		}
		data = data[n:]
		if number == 1 && wireType == protowire.BytesType {
			value, n := protowire.ConsumeBytes(data)
			if n < 0 {
				return nil, protowire.ParseError(n)
			}
			file, err := parseAsset(value)
			if err != nil {
				return nil, err
			}
			assets = append(assets, file)
			data = data[n:]
			continue
		}
		n = protowire.ConsumeFieldValue(number, wireType, data)
		if n < 0 {
			return nil, protowire.ParseError(n)
		}
		data = data[n:]
	}
	return assets, nil
}

func parseAsset(data []byte) (asset, error) {
	var file asset
	for len(data) > 0 {
		number, wireType, n := protowire.ConsumeTag(data)
		if n < 0 {
			return asset{}, protowire.ParseError(n)
		}
		data = data[n:]
		if (number == 1 || number == 2 || number == 5) && wireType == protowire.BytesType {
			value, n := protowire.ConsumeBytes(data)
			if n < 0 {
				return asset{}, protowire.ParseError(n)
			}
			switch number {
			case 1:
				file.name = string(value)
			case 2:
				part, err := parseChunk(value)
				if err != nil {
					return asset{}, err
				}
				file.chunks = append(file.chunks, part)
			case 5:
				file.hash = string(value)
			}
			data = data[n:]
			continue
		}
		if number == 3 && wireType == protowire.VarintType {
			value, n := protowire.ConsumeVarint(data)
			if n < 0 {
				return asset{}, protowire.ParseError(n)
			}
			file.isDir = value != 0
			data = data[n:]
			continue
		}
		if number == 4 && wireType == protowire.VarintType {
			value, n := protowire.ConsumeVarint(data)
			if n < 0 {
				return asset{}, protowire.ParseError(n)
			}
			file.size = int64(value)
			data = data[n:]
			continue
		}
		n = protowire.ConsumeFieldValue(number, wireType, data)
		if n < 0 {
			return asset{}, protowire.ParseError(n)
		}
		data = data[n:]
	}
	if file.name == "" {
		return asset{}, fmt.Errorf("manifest asset has no name")
	}
	return file, nil
}

func parseChunk(data []byte) (chunk, error) {
	var result chunk
	for len(data) > 0 {
		number, wireType, n := protowire.ConsumeTag(data)
		if n < 0 {
			return chunk{}, protowire.ParseError(n)
		}
		data = data[n:]
		if (number == 1 || number == 2) && wireType == protowire.BytesType {
			value, n := protowire.ConsumeBytes(data)
			if n < 0 {
				return chunk{}, protowire.ParseError(n)
			}
			if number == 1 {
				result.name = string(value)
			} else {
				result.hash = string(value)
			}
			data = data[n:]
			continue
		}
		if number >= 3 && number <= 5 && wireType == protowire.VarintType {
			value, n := protowire.ConsumeVarint(data)
			if n < 0 {
				return chunk{}, protowire.ParseError(n)
			}
			switch number {
			case 3:
				result.offset = int64(value)
			case 4:
				result.size = int64(value)
			case 5:
				result.expandedSize = int64(value)
			}
			data = data[n:]
			continue
		}
		n = protowire.ConsumeFieldValue(number, wireType, data)
		if n < 0 {
			return chunk{}, protowire.ParseError(n)
		}
		data = data[n:]
	}
	if result.name == "" {
		return chunk{}, fmt.Errorf("manifest chunk has no name")
	}
	return result, nil
}

func validateChunkBounds(file asset, part chunk) error {
	if part.offset < 0 || part.size < 0 || part.expandedSize < 0 || part.offset > file.size || part.expandedSize > file.size-part.offset {
		return fmt.Errorf("chunk %q exceeds file bounds", part.name)
	}
	if part.expandedSize > 0 && part.size == 0 {
		return fmt.Errorf("chunk %q has no compressed data", part.name)
	}
	if part.hash != "" && !isMD5(part.hash) {
		return fmt.Errorf("chunk %q has invalid MD5", part.name)
	}
	return nil
}

func safeAssetPath(root, name string) (string, error) {
	if name == "" || strings.ContainsRune(name, 0) {
		return "", fmt.Errorf("manifest contains an invalid file path")
	}
	name = strings.ReplaceAll(name, "\\", "/")
	local := filepath.FromSlash(name)
	if !filepath.IsLocal(local) {
		return "", fmt.Errorf("manifest path escapes install directory: %q", name)
	}
	full := filepath.Join(root, local)
	relative, err := filepath.Rel(root, full)
	if err != nil || !filepath.IsLocal(relative) {
		return "", fmt.Errorf("manifest path escapes install directory: %q", name)
	}
	return full, nil
}

func ensureNoSymlinkParents(root, target string) error {
	current := filepath.Dir(target)
	for {
		info, err := os.Lstat(current)
		if err == nil && info.Mode()&os.ModeSymlink != 0 {
			return fmt.Errorf("refusing to write through symbolic link %s", current)
		}
		if err != nil && !os.IsNotExist(err) {
			return err
		}
		if current == root {
			return nil
		}
		parent := filepath.Dir(current)
		if parent == current {
			return fmt.Errorf("target path is outside install directory")
		}
		current = parent
	}
}

func rangeMatches(file *os.File, offset, size int64, expected string) (bool, error) {
	if expected == "" {
		return false, nil
	}
	if _, err := file.Seek(offset, io.SeekStart); err != nil {
		return false, err
	}
	digest := md5.New()
	if _, err := io.CopyN(digest, file, size); err != nil {
		if err == io.EOF || err == io.ErrUnexpectedEOF {
			return false, nil
		}
		return false, err
	}
	return equalHash(digest, expected), nil
}

func hasherMatches(file *os.File, size int64, expected string) (bool, error) {
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return false, err
	}
	digest := md5.New()
	if _, err := io.CopyN(digest, file, size); err != nil {
		if size == 0 && err == io.EOF {
			return equalHash(digest, expected), nil
		}
		return false, err
	}
	return equalHash(digest, expected), nil
}

func matchesMD5(data []byte, expected string) bool {
	if !isMD5(expected) {
		return false
	}
	digest := md5.Sum(data)
	return hex.EncodeToString(digest[:]) == strings.ToLower(expected)
}

func isMD5(value string) bool {
	if len(value) != md5.Size*2 {
		return false
	}
	_, err := hex.DecodeString(value)
	return err == nil
}

func equalHash(digest hash.Hash, expected string) bool {
	return isMD5(expected) && hex.EncodeToString(digest.Sum(nil)) == strings.ToLower(expected)
}
