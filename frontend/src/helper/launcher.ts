import useLauncherStore from "@/stores/launcherStore";
import { AppService } from "@bindings/SilwerWolf999-launcher/internal/app-service";
import { sleep } from "./sleep";
import { GitService } from "@bindings/SilwerWolf999-launcher/internal/git-service";

export async function CheckUpdateLauncher(): Promise<{ isUpdate: boolean; isExists: boolean; version: string }> {
    const [currentOk, currentVersion] = await AppService.GetCurrentLauncherVersion()
    if (!currentOk) {
        throw new Error("Unable to read the current launcher version")
    }
    if (currentVersion === "Development") {
        return { isUpdate: false, isExists: false, version: currentVersion }
    }

    const [latestOk, latestVersion, latestError] = await GitService.GetLatestLauncherVersion()
    if (!latestOk) {
        throw new Error(latestError || "Unable to check for launcher updates")
    }

    const isUpdate = latestVersion !== currentVersion
    return { isUpdate, isExists: true, version: latestVersion }
}

export async function UpdateLauncher(launcherVersion: string): Promise<void> {
    const { setDownloadType } = useLauncherStore.getState()
    setDownloadType("update:launcher:downloading")

    try {
        const [ok, error] = await GitService.UpdateLauncherProgress(launcherVersion)
        if (!ok) {
            throw new Error(error || "Launcher update failed")
        }

        setDownloadType("update:launcher:success")
        const [closeOk, closeError] = await AppService.CloseAppAfterTimeout(5)
        if (!closeOk) {
            throw new Error(closeError || "Could not close launcher after updating")
        }
        await sleep(5000)
    } catch (error) {
        setDownloadType("update:launcher:failed")
        throw error
    }
}
