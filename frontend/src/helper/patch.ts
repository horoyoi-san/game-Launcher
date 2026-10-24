import useLauncherStore from "@/stores/launcherStore";
import useSettingStore from "@/stores/settingStore";
import { FSService } from "@bindings/sunbringer-launcher/internal/fs-service";
import { GitService } from "@bindings/sunbringer-launcher/internal/git-service";
import { toast } from "react-toastify";

function normalizedGameDir(gameDir: string): string {
    return gameDir.replace(/[\\/]+$/, "").toLowerCase();
}

export async function CheckPatchInstalled(gameDir: string, installedGameDir: string): Promise<boolean> {
    if (!gameDir || normalizedGameDir(gameDir) !== normalizedGameDir(installedGameDir)) {
        return false;
    }
    const launcherExists = await FSService.FileExists(`${gameDir}/Sunbringer.exe`);
    const dllExists = await FSService.FileExists(`${gameDir}/Roscaelifer.dll`);
    return launcherExists && dllExists;
}

export async function UpdatePatch(gameDir: string): Promise<boolean> {
    const { setDownloadType } = useLauncherStore.getState();
    if (!gameDir) {
        toast.error("Select a game folder before installing the patch");
        return false;
    }

    setDownloadType("Downloading NAP patch...")
    const [downloaded, downloadError] = await GitService.DownloadNAPPatchProgress();
    if (!downloaded) {
        toast.error(downloadError || "Could not download the NAP patch");
        setDownloadType("Download patch failed");
        return false;
    }

    setDownloadType("Installing NAP patch...")
    const [installed, installError] = await GitService.InstallNAPPatch(gameDir);
    if (!installed) {
        toast.error(installError || "Could not install the NAP patch");
        setDownloadType("Install patch failed");
        return false;
    }

    useSettingStore.getState().setPatchInstalledGameDir(gameDir);
    setDownloadType("NAP patch is ready");
    return true;
}
