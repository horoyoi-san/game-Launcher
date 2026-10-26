import useLauncherStore from '@/stores/launcherStore';
import useSettingStore from '@/stores/settingStore';
import { FSService } from '@bindings/sunbringer-launcher/internal/fs-service';
import { GitService } from '@bindings/sunbringer-launcher/internal/git-service';
import { toast } from 'react-toastify';

export type NAPServerChoice = "remielle" | "eldreda";

export async function CheckUpdateServer(
    _serverPath: string,
    _serverVersion: string,
    serverChoice: NAPServerChoice = "remielle"
): Promise<{ isUpdate: boolean; isExists: boolean; version: string }> {
    const isEldreda = serverChoice === "eldreda"
    const resolvedServerPath = isEldreda ? "./server/eldreda" : "./server/remielle"
    const version = isEldreda ? "eldreda-latest" : "remielle-0.1.x"
    const serverExists = isEldreda
        ? await FSService.FileExists(`${resolvedServerPath}/zig-out/bin/eldreda.exe`)
        : await FSService.FileExists(`${resolvedServerPath}/build.zig`)
    const zigExecutable = isEldreda
        ? "./server/zig/zig-x86_64-windows-0.17.0/zig.exe"
        : "./server/zig/zig-x86_64-windows-0.16.0/zig.exe"
    const zigExists = await FSService.FileExists(zigExecutable)

    if (serverExists && (isEldreda || zigExists)) {
        const { setServerPath, setServerVersion } = useSettingStore.getState()
        const isSameServer = _serverPath.replace(/[\\/]+$/, "").toLowerCase()
            === resolvedServerPath.replace(/[\\/]+$/, "").toLowerCase()
        setServerPath(resolvedServerPath)
        if (!isSameServer) setServerVersion(version)
        return { isUpdate: isSameServer && _serverVersion !== version, isExists: true, version }
    }

    return { isUpdate: false, isExists: false, version: "" }
}


export async function UpdateServer(serverChoice: NAPServerChoice = "remielle"): Promise<boolean> {
    const { setDownloadType, setProgressDownload, setDownloadProgressIndeterminate } = useLauncherStore.getState()
    const { setServerPath, setServerVersion } = useSettingStore.getState()

    const isEldreda = serverChoice === "eldreda"
    const serverName = isEldreda ? "Eldreda" : "Remielle"
    const serverVersion = isEldreda ? "eldreda-latest" : "remielle-0.1.x"

    setDownloadType(`Preparing ${serverName} and Zig ${isEldreda ? "0.17.0" : "0.16.0"}...`)
    const [downloaded, downloadError] = isEldreda
        ? await GitService.DownloadEldredaServerProgress()
        : await GitService.DownloadNAPServerProgress()
    if (!downloaded) {
        toast.error(downloadError || `Could not prepare the ${serverName} server`)
        setDownloadType("Prepare server failed")
        return false
    }

    setDownloadType(`Building ${serverName} with Zig ${isEldreda ? "0.17.0" : "0.16.0"}...`)
    setProgressDownload(0)
    setDownloadProgressIndeterminate(true)
    const [extracted, extractError] = isEldreda
        ? await GitService.BuildEldredaServer()
        : await GitService.ExtractNAPServer()
    setDownloadProgressIndeterminate(false)
    if (!extracted) {
        toast.error(extractError || `Could not build the ${serverName} server`)
        setDownloadType("Build server failed")
        return false
    }

    setDownloadType(`${serverName} server is ready`)
    setServerVersion(serverVersion)
    setServerPath(isEldreda ? "./server/eldreda" : "./server/remielle")
    return true
}
