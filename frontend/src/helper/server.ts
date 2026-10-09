import useLauncherStore from '@/stores/launcherStore';
import useSettingStore from '@/stores/settingStore';
import { FSService } from '@bindings/Cyrene-launcher/internal/fs-service';
import { GitService } from '@bindings/Cyrene-launcher/internal/git-service';
import { toast } from 'react-toastify';

export async function CheckUpdateServer(
    _serverPath: string,
    _serverVersion: string
): Promise<{ isUpdate: boolean; isExists: boolean; version: string }> {
    const resolvedServerPath = "./server/gameserver.exe"
    const serverExists = await FSService.FileExists(resolvedServerPath)
    const sdkServerExists = await FSService.FileExists("./server/sdkserver.exe")

    if (serverExists && sdkServerExists) {
        const { setServerPath } = useSettingStore.getState()
        setServerPath(resolvedServerPath)
        return { isUpdate: _serverVersion !== "hkrpg", isExists: true, version: "hkrpg" }
    }

    return { isUpdate: false, isExists: false, version: "" }
}


export async function UpdateServer(): Promise<boolean> {
    const { setDownloadType } = useLauncherStore.getState()
    const { setServerPath, setServerVersion } = useSettingStore.getState()

    setDownloadType("Downloading HKRPG server...")
    const [downloaded, downloadError] = await GitService.DownloadHKRPGServerProgress()
    if (!downloaded) {
        toast.error(downloadError || "Could not download the HKRPG server")
        setDownloadType("Download server failed")
        return false
    }

    setDownloadType("Extracting HKRPG server...")
    const [extracted, extractError] = await GitService.ExtractHKRPGServer()
    if (!extracted) {
        toast.error(extractError || "Could not extract the HKRPG server")
        setDownloadType("Extract server failed")
        return false
    }

    setDownloadType("HKRPG server is ready")
    setServerVersion("hkrpg")
    setServerPath("./server/gameserver.exe")
    return true
}
