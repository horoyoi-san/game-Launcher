import useLauncherStore from '@/stores/launcherStore';
import useSettingStore from '@/stores/settingStore';
import { FSService } from '@bindings/sunbringer-launcher/internal/fs-service';
import { GitService } from '@bindings/sunbringer-launcher/internal/git-service';
import { toast } from 'react-toastify';

export async function CheckUpdateServer(
    _serverPath: string,
    _serverVersion: string
): Promise<{ isUpdate: boolean; isExists: boolean; version: string }> {
    const resolvedServerPath = "./server/remielle"
    const serverExists = await FSService.FileExists(`${resolvedServerPath}/build.zig`)
    const zigExists = await FSService.FileExists("./server/zig/zig-x86_64-windows-0.16.0/zig.exe")

    if (serverExists && zigExists) {
        const { setServerPath } = useSettingStore.getState()
        setServerPath(resolvedServerPath)
        return { isUpdate: _serverVersion !== "remielle-0.1.x", isExists: true, version: "remielle-0.1.x" }
    }

    return { isUpdate: false, isExists: false, version: "" }
}


export async function UpdateServer(): Promise<boolean> {
    const { setDownloadType } = useLauncherStore.getState()
    const { setServerPath, setServerVersion } = useSettingStore.getState()

    setDownloadType("Preparing Remielle 0.1.x and Zig 0.16.0...")
    const [downloaded, downloadError] = await GitService.DownloadNAPServerProgress()
    if (!downloaded) {
        toast.error(downloadError || "Could not prepare the Remielle server")
        setDownloadType("Prepare server failed")
        return false
    }

    setDownloadType("Building Remielle with Zig 0.16.0...")
    const [extracted, extractError] = await GitService.ExtractNAPServer()
    if (!extracted) {
        toast.error(extractError || "Could not build the Remielle server")
        setDownloadType("Build server failed")
        return false
    }

    setDownloadType("Remielle server is ready")
    setServerVersion("remielle-0.1.x")
    setServerPath("./server/remielle")
    return true
}
