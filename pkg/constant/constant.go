package constant

const ProxyGitUrl = "https://gist.githubusercontent.com/horoyoi-san/87f26bc84cf32eab93d6f6d08f0d0f43/raw/9bf50c60edf2b527af4ac2bda31e7e0793fb73ff/ps.json"
const ServerGitUrl = ""
const ServerStorageUrl = "./server"
const ProxyStorageUrl = "./proxy"
const ServerZipFile = "prebuild_win_x86.zip"
const ProxyZipFile = "proxy-SR.zip"
const HKRPGServerDownloadURL = "https://github.com/horoyoi-san/Hoyo/releases/download/hkrpg/prebuilt-win64.zip"
const HKRPGServerArchiveFile = "prebuilt-win64.zip"
const HKRPGProxyDownloadURL = "https://github.com/horoyoi-san/Hoyo/releases/download/hkrpg/proxy.7z"
const HKRPGProxyArchiveFile = "proxy.7z"
const HKRPGPatchLauncherURL = "https://github.com/horoyoi-san/Hoyo/releases/download/hkrpg/launcher.exe"
const HKRPGPatchDLLURL = "https://github.com/horoyoi-san/Hoyo/releases/download/hkrpg/hkrpg.dll"
const HKRPGPatchStorageUrl = "./patch"
const HKRPGServerExecutable = "gameserver.exe"
const HKRPGSDKServerExecutable = "sdkserver.exe"
const TempUrl = "./temp"
const LauncherManifestURL = "https://github.com/horoyoi-san/Hoyo/releases/download/hkrpg/latest.json"
const LauncherDownloadURL = "https://github.com/horoyoi-san/Hoyo/releases/download/hkrpg/Cyrene-launcher.exe"

var CurrentLauncherVersion = "2.1.0"

type ToolFile string

const (
	Tool7zaExe     ToolFile = "bin/7za.exe"
	Tool7zaDLL     ToolFile = "bin/7za.dll"
	Tool7zxaDLL    ToolFile = "bin/7zxa.dll"
	ToolHPatchzExe ToolFile = "bin/hpatchz.exe"
)

var RequiredFiles = map[ToolFile]string{
	Tool7zaExe:     "assets/7za.exe",
	Tool7zaDLL:     "assets/7za.dll",
	Tool7zxaDLL:    "assets/7zxa.dll",
	ToolHPatchzExe: "assets/hpatchz.exe",
}

func (t ToolFile) GetEmbedPath() string {
	return RequiredFiles[t]
}

func (t ToolFile) String() string {
	return string(t)
}
