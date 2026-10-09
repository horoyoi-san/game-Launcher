import useLauncherStore from "@/stores/launcherStore";
import useSettingStore from "@/stores/settingStore";
import { FSService } from "@bindings/Cyrene-launcher/internal/fs-service";
import { GitService } from "@bindings/Cyrene-launcher/internal/git-service";
import { toast } from "react-toastify";

export async function CheckUpdateProxy(proxyPath: string, proxyVersion: string): Promise<{isUpdate: boolean, isExists: boolean, version: string}> {
    const resolvedProxyPath = proxyPath || "./proxy/Proxy.exe"
    const isExists = await FSService.FileExists(resolvedProxyPath)

    if (isExists) {
        const { setProxyPath } = useSettingStore.getState()
        if (!proxyPath) {
            setProxyPath(resolvedProxyPath)
        }
        return { isUpdate: proxyVersion !== "hkrpg", isExists: true, version: "hkrpg" }
    }

    return { isUpdate: false, isExists, version: "" }
}

export async function UpdateProxy(_proxyVersion: string): Promise<boolean> {
    const { setDownloadType } = useLauncherStore.getState()
    const { setProxyPath, setProxyVersion } = useSettingStore.getState()

    setDownloadType("Downloading HKRPG proxy...")
    const [downloaded, downloadError] = await GitService.DownloadHKRPGProxyProgress()
    if (!downloaded) {
        toast.error(downloadError || "Could not download the proxy")
        setDownloadType("Download proxy failed")
        return false
    }

    setDownloadType("Extracting proxy...")
    const [extracted, extractError] = await GitService.ExtractHKRPGProxy()
    if (!extracted) {
        toast.error(extractError || "Could not extract the proxy")
        setDownloadType("Extract proxy failed")
        return false
    }

    setDownloadType("Proxy is ready")
    setProxyVersion("hkrpg")
    setProxyPath("./proxy/Proxy.exe")
    return true
}
