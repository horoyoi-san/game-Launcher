package constant

const ServerGitUrl = ""
const ServerStorageUrl = "./server"
const ServerZipFile = "prebuild_win_x86.zip"
const RemielleRepositoryURL = "https://git.xeondev.com/remielle/remielle.git"
const RemielleBranch = "0.1.x"
const RemielleServerVersion = "remielle-0.1.x"
const RemielleStorageDir = "./server/remielle"
const ZigDownloadURL = "https://ziglang.org/download/0.16.0/zig-x86_64-windows-0.16.0.zip"
const ZigArchiveFile = "zig-x86_64-windows-0.16.0.zip"
const ZigStorageDir = "./server/zig"
const ZigExecutable = "./server/zig/zig-x86_64-windows-0.16.0/zig.exe"
const EldredaRepositoryURL = "https://git.xeondev.com/eldreda/eldreda.git"
const EldredaStorageDir = "./server/eldreda"
const EldredaZigDownloadURL = "https://ziglang.org/download/0.17.0/zig-x86_64-windows-0.17.0.zip"
const EldredaZigArchiveFile = "zig-x86_64-windows-0.17.0.zip"
const EldredaZigStorageDir = "./server/zig/zig-x86_64-windows-0.17.0"
const EldredaZigExecutable = "./server/zig/zig-x86_64-windows-0.17.0/zig.exe"
const NAPPatchSunbringerURL = "https://github.com/horoyoi-san/Hoyo/releases/download/nap/Sunbringer.exe"
const NAPPatchCovenantDLLURL = "https://github.com/horoyoi-san/Hoyo/releases/download/nap/Roscaelifer.dll"
const NAPPatchManifestURL = "https://github.com/horoyoi-san/Hoyo/releases/download/nap/patch-latest.json"
const NAPPatchStorageUrl = "./patch"
const NAPServerExecutable = "gameserver.exe"
const NAPSDKServerExecutable = "sdkserver.exe"
const TempUrl = "./temp"
const LauncherManifestURL = "https://github.com/horoyoi-san/Hoyo/releases/download/nap/latest.json"
const LauncherDownloadURL = "https://github.com/horoyoi-san/Hoyo/releases/download/nap/Sunbringer-launcher.exe"
const DiffUpdaterGitUrl = "https://github.com/horoyoi-san/Hoyo/releases/download/Sophon.Downloader/diff.zip"

var CurrentLauncherVersion = "1.0.0"

type ToolFile string

const (
	Tool7zaExe     ToolFile = "bin/7za.exe"
	Tool7zaDLL     ToolFile = "bin/7za.dll"
	Tool7zxaDLL    ToolFile = "bin/7zxa.dll"
	ToolHPatchzExe ToolFile = "bin/hpatchz.exe"
	ToolZiftExe    ToolFile = "bin/zift.exe"
)

var RequiredFiles = map[ToolFile]string{
	Tool7zaExe:     "assets/7za.exe",
	Tool7zaDLL:     "assets/7za.dll",
	Tool7zxaDLL:    "assets/7zxa.dll",
	ToolHPatchzExe: "assets/hpatchz.exe",
	ToolZiftExe:    "assets/zift.exe",
}

func (t ToolFile) GetEmbedPath() string {
	return RequiredFiles[t]
}

func (t ToolFile) String() string {
	return string(t)
}
