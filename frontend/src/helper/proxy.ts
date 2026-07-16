import useLauncherStore from "@/stores/launcherStore";
import useSettingStore from "@/stores/settingStore";
import { FSService } from "@bindings/Cyrene-launcher/internal/fs-service";
import { GitService } from "@bindings/Cyrene-launcher/internal/git-service";
import { toast } from "react-toastify";

export async function CheckUpdateProxy(proxyPath: string, proxyVersion: string) : Promise<{isUpdate: boolean, isExists: boolean, version: string}> {
    const resolvedProxyPath = proxyPath || "./proxy/Proxy.exe"
    const isExists = await FSService.FileExists(resolvedProxyPath)

    if (isExists) {
        const { setProxyPath } = useSettingStore.getState()
        if (!proxyPath) {
            setProxyPath(resolvedProxyPath)
        }
        return { isUpdate: false, isExists: true, version: proxyVersion }
    }

    return { isUpdate: false, isExists, version: "" }
}

export async function UpdateProxy(proxyVersion: string) : Promise<boolean> {
    const {setDownloadType } = useLauncherStore.getState()
    const {setProxyPath, setProxyVersion} = useSettingStore.getState()
    let targetVersion = proxyVersion
    if (!targetVersion) {
        const [ok, latestVersion, error] = await GitService.GetLatestProxyVersion()
        if (!ok) {
            toast.error("Proxy error: " + error)
            return false
        }
        targetVersion = latestVersion
    }

    setDownloadType("Downloading proxy...")
    const [ok, error] = await GitService.DownloadProxyProgress(targetVersion)
    if (ok) {
        setDownloadType("Unzipping proxy...")
        GitService.UnzipProxy()
        setDownloadType("Download proxy successfully")
        setProxyVersion(targetVersion)
        setProxyPath("./proxy/Proxy.exe")
        return true
    } else {
        toast.error(error)
        setDownloadType("Download proxy failed")
        return false
    }
}
