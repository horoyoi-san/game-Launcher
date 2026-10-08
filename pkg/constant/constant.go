package constant

const ProxyGitUrl = "https://gist.githubusercontent.com/horoyoi-san/87f26bc84cf32eab93d6f6d08f0d0f43/raw/9bf50c60edf2b527af4ac2bda31e7e0793fb73ff/ps.json"
const ServerGitUrl = "https://git.kain.io.vn/api/v1/repos/Firefly-Shelter/FireflyGo_Local_Archive/releases"
const LauncherManifestURL = "https://github.com/horoyoi-san/Hoyo/releases/download/Sophon.Downloader/latest.json"
const SophonGitUrl = "https://github.com/horoyoi-san/Hoyo/releases/download/Sophon.Downloader/Sophon.Downloader.zip"
const DiffUpdaterGitUrl = "https://github.com/horoyoi-san/Hoyo/releases/download/Sophon.Downloader/diff.zip"
const ServerStorageUrl = "./server"
const SophonStorageUrl = "./Sophon"
const ServerZipFile = "prebuild_win_x86.zip"
const LauncherDownloadURL = "https://github.com/horoyoi-san/Hoyo/releases/download/Sophon.Downloader/SilwerWolf999-launcher.exe"
const SophonZipFile = "sophon.Downloader.zip"
const TempUrl = "./temp"

var CurrentLauncherVersion = "1.0.0"

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
