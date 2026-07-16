import useLauncherStore from '@/stores/launcherStore';
import useSettingStore from '@/stores/settingStore';
import { FSService } from '@bindings/Cyrene-launcher/internal/fs-service';
import { GitService } from '@bindings/Cyrene-launcher/internal/git-service';
import { toast } from 'react-toastify';

export async function CheckUpdateServer(
    serverPath: string,
    serverVersion: string
): Promise<{ isUpdate: boolean; isExists: boolean; version: string }> {
    const resolvedServerPath = serverPath || "./server/firefly-go_win.exe"
    const isExists = await FSService.FileExists(resolvedServerPath)

    if (isExists) {
        const { setServerPath } = useSettingStore.getState()
        if (!serverPath) {
            setServerPath(resolvedServerPath)
        }
        return { isUpdate: false, isExists: true, version: serverVersion }
    }

    return { isUpdate: false, isExists, version: "" }
}


export async function UpdateServer(serverVersion: string) : Promise<boolean> {
    const {setDownloadType } = useLauncherStore.getState()
    const {setServerPath, setServerVersion} = useSettingStore.getState()
    let targetVersion = serverVersion
    if (!targetVersion) {
        const [ok, latestVersion, error] = await GitService.GetLatestServerVersion()
        if (!ok) {
            toast.error("Server error: " + error)
            return false
        }
        targetVersion = latestVersion
    }

    setDownloadType("Downloading server...")
    const [ok, error] = await GitService.DownloadServerProgress(targetVersion)
    if (ok) {
        setDownloadType("Unzipping server...")
        GitService.UnzipServer()
        setDownloadType("Download server successfully")
        setServerVersion(targetVersion)
        setServerPath("./server/firefly-go_win.exe")
        return true
    } else {
        toast.error(error)
        setDownloadType("Download server failed")
        return false
    }
}
