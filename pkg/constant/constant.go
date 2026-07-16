package constant

const ProxyGitUrl = "https://gist.githubusercontent.com/horoyoi-san/87f26bc84cf32eab93d6f6d08f0d0f43/raw/9bf50c60edf2b527af4ac2bda31e7e0793fb73ff/ps.json"
const ServerGitUrl = ""
const LauncherGitUrl = ""
const ServerStorageUrl = "./server"
const ProxyStorageUrl = "./proxy"
const ServerZipFile = "prebuild_win_x86.zip"
const ProxyZipFile = "proxy-SR.zip"
const LauncherFile = ""
const TempUrl = "./temp"

const CurrentLauncherVersion = "2.1.0"

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
